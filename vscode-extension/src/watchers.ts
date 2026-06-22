import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitContext } from './gitContext';
import { EpisodeStore } from './episodeStore';
import { ApiClient } from './apiClient';
import { Redaction } from './redaction';
import { getAuthManager } from './auth';
import { NotificationService } from './NotificationService';
import { EventDeduplicator } from './EventDeduplicator';

export interface WatcherDeps {
  context: vscode.ExtensionContext;
  episodeStore: EpisodeStore;
  apiClient: typeof ApiClient;
  stateTreeProvider: any;
  statusBar: any;
}

const lastBranches: Record<string, string | null> = {};
const lastCommitMessages: Record<string, string> = {};
const branchCooldowns: Record<string, boolean> = {};
const commitDebounces: Record<string, ReturnType<typeof setTimeout> | null> = {};
// Fix 11: Guard against duplicate watcher registration
let watchersInitialized = false;
const deduplicator = new EventDeduplicator();
const notifier = NotificationService.getInstance();

/** Maximum diff size sent to sync engine (ENH-002) */
const MAX_DIFF_CHARS = 6000;

// ─── MAIN ENTRY POINT ─────────────────────────────────────
// Call once from activate() in extension.ts

export async function startWatchers(
  deps: WatcherDeps
): Promise<void> {
  // Fix 11: Prevent duplicate watcher registration
  if (watchersInitialized) return;

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) return;

  watchersInitialized = true;

  for (const folder of folders) {
    const workspaceRoot = folder.uri.fsPath;
    const gitDir = path.join(workspaceRoot, '.git');

    if (fs.existsSync(gitDir)) {
      watchBranch(gitDir, workspaceRoot, deps);
      watchCommits(gitDir, workspaceRoot, deps);
      await deps.episodeStore.ensureProject(workspaceRoot);
      await autoInitEpisode(deps, workspaceRoot);
    } else {
      watchForGitInit(workspaceRoot, deps);
    }
  }

  watchFileSaves(deps);
  watchFolderChanges(deps);
  startTokenRefresh(deps);
  startStaleEpisodeDetector(deps);
}

// ─── WATCHER 1: BRANCH ────────────────────────────────────
// Watches: .git/HEAD
// On branch switch: close episode, open new one with smart name
// Cost: 0 Gemini, 1 Firestore write

function watchBranch(gitDir: string, workspaceRoot: string, deps: WatcherDeps): void {
  const headFile = path.join(gitDir, 'HEAD');
  if (!fs.existsSync(headFile)) return;

  const watcher = fs.watch(headFile, () => {
    if (branchCooldowns[workspaceRoot]) return;
    branchCooldowns[workspaceRoot] = true;

    // Wait 2s for rebase/merge to finish
    setTimeout(async () => {
      branchCooldowns[workspaceRoot] = false;
      try {
        const git = await GitContext.getContext(workspaceRoot);
        const branch = git.branch;

        if (!branch || branch === 'HEAD') return;
        if (!lastBranches[workspaceRoot]) { lastBranches[workspaceRoot] = branch; return; }
        if (branch === lastBranches[workspaceRoot]) return;

        lastBranches[workspaceRoot] = branch;

        // Close old episode silently (goes to sync queue)
        const episodeStore = deps.episodeStore;
        if (episodeStore.getActiveEpisode(workspaceRoot)) {
          await episodeStore.closeEpisodeSilent(workspaceRoot);
        }

        // ENH-001: Smart Episode Naming
        // Generate a readable name from branch + last commit
        const episodeName = await generateSmartEpisodeName(branch, workspaceRoot);

        // Auto-create new episode for new branch
        // Goes through sync queue — not immediate
        await episodeStore.autoCreateEpisode(episodeName, branch, workspaceRoot);

        deps.stateTreeProvider.refresh();
        deps.statusBar.render();

        const folder = vscode.workspace.workspaceFolders?.find(f => f.uri.fsPath === workspaceRoot);
        notifier.info(`Branch "${branch}" in ${folder?.name || 'project'} — episode started.`);
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

function watchCommits(gitDir: string, workspaceRoot: string, deps: WatcherDeps): void {
  const file = path.join(gitDir, 'COMMIT_EDITMSG');
  if (!fs.existsSync(file)) return;

  try {
    lastCommitMessages[workspaceRoot] = fs.readFileSync(file, 'utf8').trim();
  } catch { lastCommitMessages[workspaceRoot] = ''; }

  const watcher = fs.watch(file, () => {
    if (commitDebounces[workspaceRoot]) clearTimeout(commitDebounces[workspaceRoot]);

    commitDebounces[workspaceRoot] = setTimeout(async () => {
      try {
        const raw = fs.readFileSync(file, 'utf8').trim();
        const message = raw
          .split('\n')
          .filter((l: string) => !l.startsWith('#'))
          .join('\n')
          .trim();

        if (!message || message === lastCommitMessages[workspaceRoot]) return;
        lastCommitMessages[workspaceRoot] = message;

        const episodeStore = deps.episodeStore;
        const episode = episodeStore.getActiveEpisode(workspaceRoot);
        if (!episodeStore.getProjectId(workspaceRoot) || !episode) return;

        const git = await GitContext.getContext(workspaceRoot);

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
        }, workspaceRoot);

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
  deps.context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      try {
        const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
        if (!folder) return;
        const workspaceRoot = folder.uri.fsPath;
        const episodeStore = deps.episodeStore;
        if (!episodeStore.getActiveEpisode(workspaceRoot)) return;

        // Skip non-code
        const ext = path.extname(doc.uri.fsPath);
        const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.kt', '.swift', '.rs', '.rb', '.php', '.cs', '.c', '.cpp', '.h', '.hpp', '.vue', '.svelte', '.dart', '.lua', '.sh', '.bash', '.zsh', '.yaml', '.yml', '.json', '.toml', '.md', '.sql', '.graphql', '.proto'];
        if (!codeExts.includes(ext)) return;

        // Debounce per-file to avoid rapid-fire events
        deduplicator.debounce('file_save', doc.uri.fsPath, () => {
          // Fix 13: Store workspace-relative paths, not absolute
          const relativePath = path.relative(workspaceRoot, doc.uri.fsPath);
          episodeStore.addChangedFile(relativePath, workspaceRoot);
          deps.stateTreeProvider.refresh();
        });

      } catch { /* silent */ }
    })
  );
}

// ─── WATCHER 4: FOLDER CHANGES ─────────────────────────────

function watchFolderChanges(deps: WatcherDeps): void {
  deps.context.subscriptions.push(
    vscode.workspace.onDidChangeWorkspaceFolders(async (e) => {
      if (e.added.length > 0) {
        for (const folder of e.added) {
          const workspaceRoot = folder.uri.fsPath;
          const gitDir = path.join(workspaceRoot, '.git');
          if (fs.existsSync(gitDir)) {
            watchBranch(gitDir, workspaceRoot, deps);
            watchCommits(gitDir, workspaceRoot, deps);
            await deps.episodeStore.ensureProject(workspaceRoot);
            await autoInitEpisode(deps, workspaceRoot);
          } else {
            watchForGitInit(workspaceRoot, deps);
          }
        }
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

export async function autoInitEpisode(deps: WatcherDeps, workspaceRoot?: string): Promise<void> {
  try {
    const episodeStore = deps.episodeStore;
    const root = workspaceRoot || episodeStore.getActiveWorkspaceRoot();
    if (!root) return;

    if (episodeStore.getActiveEpisode(root)) {
      lastBranches[root] = episodeStore.getActiveEpisode(root)?.branchName || null;
      return;
    }

    if (!episodeStore.getProjectId(root)) return;

    const git = await GitContext.getContext(root);
    const branchName = git.branch || null;
    lastBranches[root] = branchName;

    if (branchName) {
      // ENH-001: Smart Episode Naming on auto-init too
      const episodeName = await generateSmartEpisodeName(branchName, root);
      await episodeStore.autoCreateEpisode(episodeName, branchName, root);
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
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) return;

      for (const folder of folders) {
        const root = folder.uri.fsPath;
        const episode = episodeStore.getActiveEpisode(root);
        if (!episode) continue;

        if (episodeStore.isStale(root)) {
          const elapsed = episodeStore.getElapsedTime(root) || 'a long time';
          const action = await vscode.window.showWarningMessage(
            `ContextLens: Episode "${episode.name}" in ${folder.name} has been open for ${elapsed} with no activity. Close it?`,
            'Close Episode',
            'Keep Open'
          );

          if (action === 'Close Episode') {
            await episodeStore.closeEpisode(root);
            deps.stateTreeProvider.refresh();
            deps.statusBar.render();
            notifier.success(`Stale episode in ${folder.name} closed.`);
          }
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
async function generateSmartEpisodeName(branch: string, workspaceRoot?: string): Promise<string> {
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
    const root = workspaceRoot || EpisodeStore.get().getActiveWorkspaceRoot();
    if (root) {
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      const { stdout } = await execAsync('git log -1 --pretty=%s', { cwd: root });
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
