import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { GitContext } from './gitContext';
import { EpisodeStore } from './episodeStore';
import { ApiClient } from './apiClient';

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
  await autoInitEpisode(deps);
}

// ─── WATCHER 1: BRANCH ────────────────────────────────────
// Watches: .git/HEAD
// On branch switch: close episode, open new one
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

        // Auto-create new episode for new branch
        // Goes through sync queue — not immediate
        await episodeStore.autoCreateEpisode(branch, branch);

        deps.stateTreeProvider.refresh();
        deps.statusBar.render();

        vscode.window.showInformationMessage(
          `ContextLens: Branch "\${branch}" — episode started.`
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

        // Enqueue to sync buffer — NOT sent immediately
        // source: git_commit means backend skips Gemini
        episodeStore.enqueueCall({
          promptText: `git commit: \${message}`,
          modelResponse: '',
          source: 'git_commit',
          modelName: 'git',
          intentTag: message,
          branchName: git.branch,
          activeFilePath: '',
          relatedFiles: [],
          diffSnapshot: git.diff?.slice(0, 2000) || '',
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
        const codeExts = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java', '.kt', '.swift', '.rs', '.rb', '.php', '.cs'];
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
      await episodeStore.autoCreateEpisode(lastBranch, lastBranch);
    }
  } catch { /* silent */ }
}

// ─── TOKEN REFRESH ──────────────────────────────────────────

function startTokenRefresh(deps: WatcherDeps): void {
  // Logic to refresh token every 50m
  setInterval(async () => {
    // This is handled inside ApiClient/AuthManager on next request,
    // but we can force it here if needed.
  }, 50 * 60 * 1000);
}
