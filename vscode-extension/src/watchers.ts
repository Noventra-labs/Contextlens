import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitContext } from './gitContext';
import { EpisodeStore } from './episodeStore';
import { ApiClient } from './apiClient';
import { Redaction } from './redaction';
import { getAuthManager } from './auth';

export interface WatcherDeps {
  context: vscode.ExtensionContext;
  episodeStore: EpisodeStore;
  apiClient: typeof ApiClient;
  stateTreeProvider: any;
  statusBar: any;
}

let lastBranch: string | null = null;
let lastCommitMessage: string = '';
let branchCooldown = false;
let commitDebounce: ReturnType<typeof setTimeout> | null = null;

/** Maximum diff size sent to sync engine (ENH-002) */
const MAX_DIFF_CHARS = 6000;

// ─── MAIN ENTRY POINT ─────────────────────────────────────
// Call once from activate() in extension.ts

export async function startWatchers(
  deps: WatcherDeps
): Promise<void> {
  const workspaceRoot =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  const gitDir = path.join(workspaceRoot, '.git');

  if (!fs.existsSync(gitDir)) {
    watchForGitInit(workspaceRoot, deps);
    return;
  }

  watchBranch(gitDir, deps);
  watchCommits(gitDir, deps);
  watchFileSaves(deps);
  watchFolderChanges(deps);
  startTokenRefresh(deps);
  startStaleEpisodeDetector(deps);
  await autoInitEpisode(deps);
}

// ─── WATCHER 1: BRANCH ────────────────────────────────────
// Watches: .git/HEAD
// On branch switch: close episode, open new one with smart name
// Cost: 0 Gemini, 1 Firestore write

function watchBranch(gitDir: string, deps: WatcherDeps): void {
  const headFile = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headFile)) return;

  const watcher = fs.watch(headFile, () => {
    if (branchCooldown) return;
    branchCooldown = true;

    // Wait 2s for rebase/merge to finish
    setTimeout(async () => {
      branchCooldown = false;
      try {
        const git = await GitContext.getContext();
        const branch = git.branch;

        if (!branch || branch === 'HEAD') return;
        if (!lastBranch) { lastBranch = branch; return; }
        if (branch === lastBranch) return;

        lastBranch = branch;

        // Close old episode silently (goes to sync queue)
        const episodeStore = deps.episodeStore;
        if (episodeStore.getActiveEpisode()) {
          await episodeStore.closeEpisodeSilent();
        }

        // ENH-001: Smart Episode Naming
        // Generate a readable name from branch + last commit
        const episodeName = await generateSmartEpisodeName(branch);

        // Auto-create new episode for new branch
        // Goes through sync queue — not immediate
        await episodeStore.autoCreateEpisode(episodeName, branch);

        deps.stateTreeProvider.refresh();
        deps.statusBar.render();

        vscode.window.showInformationMessage(
          `ContextLens: Branch "${branch}" — episode started.`
        );
      } catch { /* silent */ }
    }, 2000);
  });

  deps.context.subscriptions.push({
    dispose: () => watcher.close()
  });
}

// ─── WATCHER 2: COMMITS ───────────────────────────────────
// Watches: .git/COMMIT_EDITMSG
// On commit: log to sync queue (no Gemini, no immediate send)
// Cost: 0 Gemini, 1 Firestore write (batched)

function watchCommits(gitDir: string, deps: WatcherDeps): void {
  const file = path.join(gitDir, 'COMMIT_EDITMSG');
  if (!fs.existsSync(file)) return;

  try {
    lastCommitMessage = fs.readFileSync(file, 'utf8').trim();
  } catch { lastCommitMessage = ''; }

  const watcher = fs.watch(file, () => {
    if (commitDebounce) clearTimeout(commitDebounce);

    commitDebounce = setTimeout(async () => {
      try {
        const raw = fs.readFileSync(file, 'utf8').trim();
        const message = raw
          .split('\n')
          .filter((l: string) => !l.startsWith('#'))
          .join('\n')
          .trim();

        if (!message || message === lastCommitMessage) return;
        lastCommitMessage = message;

        const episodeStore = deps.episodeStore;
        const episode = episodeStore.getActiveEpisode();
        if (!episodeStore.getProjectId() || !episode) return;

        const git = await GitContext.getContext();

        // ENH-002: Diff Size Guard — truncate before syncing
        const safeDiff = guardDiffSize(git.diff || '');

        // Apply redaction before sending
        const redactedDiff = Redaction.redact(safeDiff);
        const redactedMessage = Redaction.redact(message);

        // Enqueue to sync buffer — NOT sent immediately
        // source: git_commit means backend skips Gemini
        episodeStore.enqueueCall({
          promptText: `git commit: ${redactedMessage}`,
          modelResponse: '',
          source: 'git_commit',
          modelName: 'git',
          intentTag: redactedMessage,
          branchName: git.branch,
          activeFilePath: '',
          relatedFiles: [],
          diffSnapshot: redactedDiff,
          todoMatches: [],
        });

        deps.stateTreeProvider.refresh();
        deps.statusBar.render();

      } catch { /* silent */ }
    }, 1000); // 1s debounce
  });

  deps.context.subscriptions.push({
    dispose: () => watcher.close()
  });
}

// ─── WATCHER 3: FILE SAVES ────────────────────────────────
// Event: onDidSaveTextDocument
// On save: add file to in-memory list only
//          batched Firestore write every 30s via sync engine
// Cost: 0 Gemini, 1 Firestore write per 30s

function watchFileSaves(deps: WatcherDeps): void {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) return;

  deps.context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      try {
        const episodeStore = deps.episodeStore;
        if (!episodeStore.getActiveEpisode()) return;
        if (!doc.uri.fsPath.startsWith(workspaceRoot)) return;

        // Skip non-code
        const ext = path.extname(doc.uri.fsPath);
        const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.kt', '.swift', '.rs', '.rb', '.php', '.cs', '.c', '.cpp', '.h', '.hpp', '.vue', '.svelte', '.dart', '.lua', '.sh', '.bash', '.zsh', '.yaml', '.yml', '.json', '.toml', '.md', '.sql', '.graphql', '.proto'];
        if (!codeExts.includes(ext)) return;

        // Add to local list (which triggers refresh)
        episodeStore.addChangedFile(doc.uri.fsPath);
        deps.stateTreeProvider.refresh();

      } catch { /* silent */ }
    })
  );
}

// ─── WATCHER 4: FOLDER CHANGES ─────────────────────────────

function watchFolderChanges(deps: WatcherDeps): void {
  deps.context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
      if (e.added.length > 0) {
        await deps.episodeStore.ensureProject();
        await autoInitEpisode(deps);
        deps.stateTreeProvider.refresh();
        deps.statusBar.render();
      }
    })
  );
}

// ─── WATCHER 5: GIT INIT ───────────────────────────────────

function watchForGitInit(workspaceRoot: string, deps: WatcherDeps): void {
  const watcher = fs.watch(workspaceRoot, async (event, filename) => {
    if (filename === '.git') {
      const gitDir = path.join(workspaceRoot, '.git');
      if (fs.existsSync(gitDir)) {
        watcher.close();
        await startWatchers(deps);
      }
    }
  });
  deps.context.subscriptions.push({ dispose: () => watcher.close() });
}

// ─── AUTO INIT ──────────────────────────────────────────────

export async function autoInitEpisode(deps: WatcherDeps): Promise<void> {
  try {
    const episodeStore = deps.episodeStore;
    if (episodeStore.getActiveEpisode()) {
      lastBranch = episodeStore.getActiveEpisode()?.branchName || null;
      return;
    }

    if (!episodeStore.getProjectId()) return;

    const git = await GitContext.getContext();
    lastBranch = git.branch || null;

    if (lastBranch) {
      // ENH-001: Smart Episode Naming on auto-init too
      const episodeName = await generateSmartEpisodeName(lastBranch);
      await episodeStore.autoCreateEpisode(episodeName, lastBranch);
    }
  } catch { /* silent */ }
}

// ─── TOKEN REFRESH (KI-001 / KI-002) ───────────────────────
// Firebase ID tokens expire every 60 minutes.
// We proactively refresh every 45 minutes to prevent silent failures.

function startTokenRefresh(deps: WatcherDeps): void {
  const REFRESH_INTERVAL_MS = 45 * 60 * 1000; // 45 minutes

  const timer = setInterval(async () => {
    try {
      const authManager = getAuthManager();
      const authState = await authManager.loadAuthState();
      if (!authState) return; // Not signed in

      const refreshed = await authManager.tryRefreshToken();
      if (refreshed) {
        console.log('[ContextLens] Token refreshed successfully (scheduled).');
      } else {
        console.warn('[ContextLens] Scheduled token refresh failed — user may need to re-auth.');
      }
    } catch (err) {
      console.error('[ContextLens] Token refresh error:', err);
    }
  }, REFRESH_INTERVAL_MS);

  deps.context.subscriptions.push({
    dispose: () => clearInterval(timer),
  });
}

// ─── STALE EPISODE DETECTOR (ENH-006) ──────────────────────
// Checks every hour if the active episode has been idle for >24h.
// Prompts the user to close stale episodes.

function startStaleEpisodeDetector(deps: WatcherDeps): void {
  const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  const timer = setInterval(async () => {
    try {
      const episodeStore = deps.episodeStore;
      const episode = episodeStore.getActiveEpisode();
      if (!episode) return;

      if (episodeStore.isStale()) {
        const elapsed = episodeStore.getElapsedTime() || 'a long time';
        const action = await vscode.window.showWarningMessage(
          `ContextLens: Episode "${episode.name}" has been open for ${elapsed} with no activity. Close it?`,
          'Close Episode',
          'Keep Open'
        );

        if (action === 'Close Episode') {
          await episodeStore.closeEpisode();
          deps.stateTreeProvider.refresh();
          deps.statusBar.render();
          vscode.window.showInformationMessage('ContextLens: Stale episode closed.');
        }
      }
    } catch { /* silent */ }
  }, CHECK_INTERVAL_MS);

  deps.context.subscriptions.push({
    dispose: () => clearInterval(timer),
  });
}

// ─── HELPERS ──────────────────────────────────────────────

/**
 * ENH-001: Smart Episode Naming
 * Generates a readable episode name from the branch name and optionally the last commit.
 * Examples:
 *   "feat/login" + "add OAuth provider"  →  "Login — add OAuth provider"
 *   "fix/auth-bug"                        →  "Fix auth bug"
 *   "main"                                →  "main"
 */
async function generateSmartEpisodeName(branch: string): Promise<string> {
  // Clean up branch name
  let cleanBranch = branch
    .replace(/^(feat|fix|feature|bugfix|hotfix|chore|refactor|docs|style|test|ci|perf)\//i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Capitalize first letter
  if (cleanBranch.length > 0) {
    cleanBranch = cleanBranch.charAt(0).toUpperCase() + cleanBranch.slice(1);
  }

  // If the branch was just a prefix (e.g. "main", "develop"), return as-is
  if (cleanBranch === branch || !cleanBranch) {
    return branch;
  }

  // Try to get the last commit message for extra context
  try {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (workspaceRoot) {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync('git log -1 --pretty=%s', { cwd: workspaceRoot });
      const lastCommit = stdout.trim();

      // Only append if the commit message is short and adds useful context
      if (lastCommit && lastCommit.length < 60 && lastCommit.toLowerCase() !== cleanBranch.toLowerCase()) {
        return `${cleanBranch} — ${lastCommit}`;
      }
    }
  } catch { /* fallback to branch name only */ }

  return cleanBranch;
}

/**
 * ENH-002: Diff Size Guard
 * Auto-truncates diffs to MAX_DIFF_CHARS to prevent large-payload failures.
 * Logs a warning if truncation occurs.
 */
function guardDiffSize(diff: string): string {
  if (!diff || diff.length <= MAX_DIFF_CHARS) {
    return diff;
  }

  console.warn(
    `[ContextLens:DiffGuard] Diff truncated from ${diff.length} to ${MAX_DIFF_CHARS} chars.`
  );
  return diff.slice(0, MAX_DIFF_CHARS) + '\n\n... [TRUNCATED — diff exceeded 6,000 char limit]';
}
