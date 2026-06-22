import * as vscode from 'vscode';
import { EpisodeStore } from './episodeStore';
import { GitContext } from './gitContext';

export class StateTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor() {
    EpisodeStore.get().onDidChange(() => {
      this.refresh();
    });
  }

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (element) {
      return [];
    }

    if (!vscode.workspace.workspaceFolders?.length) {
      const item = new vscode.TreeItem('Open a folder to start tracking');
      item.iconPath = new vscode.ThemeIcon('folder-opened');
      item.command = {
        command: 'vscode.openFolder',
        title: 'Open Folder',
      };
      return [item];
    }

    const items: vscode.TreeItem[] = [];
    const store = EpisodeStore.get();
    const episode = store.getActiveEpisode();

    // ── Not signed in ────────────────────────────────────────────────────
    const { getAuthManager } = await import('./auth');
    let isSignedIn = false;
    try {
      const authState = await getAuthManager().loadAuthState();
      isSignedIn = !!authState;
    } catch {
      // AuthManager not yet initialized
    }

    if (!isSignedIn) {
      const signInItem = new vscode.TreeItem('Sign in to ContextLens', vscode.TreeItemCollapsibleState.None);
      signInItem.description = 'Google account required';
      signInItem.iconPath = new vscode.ThemeIcon('account');
      signInItem.command = { command: 'contextlens.signIn', title: 'Sign In' };
      items.push(signInItem);
      return items;
    }

    // ── Authenticated badge ──────────────────────────────────────────────
    const authBadge = new vscode.TreeItem('Status', vscode.TreeItemCollapsibleState.None);
    authBadge.description = 'Authenticated';
    authBadge.iconPath = new vscode.ThemeIcon('pass-filled');
    items.push(authBadge);

    // ── No active episode ────────────────────────────────────────────────
    if (!episode) {
      const noEpisode = new vscode.TreeItem('Status', vscode.TreeItemCollapsibleState.None);
      noEpisode.description = 'No Active Episode';
      noEpisode.iconPath = new vscode.ThemeIcon('info');
      items.push(noEpisode);

      const newEpAction = new vscode.TreeItem('New Episode', vscode.TreeItemCollapsibleState.None);
      newEpAction.command = { command: 'contextlens.newEpisode', title: 'New Episode' };
      newEpAction.iconPath = new vscode.ThemeIcon('add');
      items.push(newEpAction);

      const dashboardAction = new vscode.TreeItem('Open Dashboard', vscode.TreeItemCollapsibleState.None);
      dashboardAction.command = { command: 'contextlens.openDashboard', title: 'Open Dashboard' };
      dashboardAction.iconPath = new vscode.ThemeIcon('link-external');
      items.push(dashboardAction);

      return items;
    }

    // ── Active episode ───────────────────────────────────────────────────

    const epItem = new vscode.TreeItem('Active Episode', vscode.TreeItemCollapsibleState.None);
    epItem.description = episode.name;
    epItem.iconPath = new vscode.ThemeIcon('record');
    items.push(epItem);

    const gitCtx = await GitContext.getContext();
    const branchItem = new vscode.TreeItem('Branch', vscode.TreeItemCollapsibleState.None);
    branchItem.description = gitCtx.branch || episode.branchName || 'none';
    branchItem.iconPath = new vscode.ThemeIcon('git-branch');
    items.push(branchItem);

    const callsItem = new vscode.TreeItem('AI Calls', vscode.TreeItemCollapsibleState.None);
    callsItem.description = String(episode.callCount);
    callsItem.iconPath = new vscode.ThemeIcon('comment-discussion');
    items.push(callsItem);

    // ENH-005: Episode time estimate
    const elapsed = store.getElapsedTime();
    if (elapsed) {
      const timeItem = new vscode.TreeItem('Duration', vscode.TreeItemCollapsibleState.None);
      timeItem.description = `Active for ${elapsed}`;
      timeItem.iconPath = new vscode.ThemeIcon('clock');
      items.push(timeItem);
    }

    // ── Changed files ────────────────────────────────────────────────────

    if (episode.changedFiles.length > 0) {
      const filesHeader = new vscode.TreeItem('Changed Files', vscode.TreeItemCollapsibleState.None);
      filesHeader.description = `(${episode.changedFiles.length})`;
      filesHeader.iconPath = new vscode.ThemeIcon('files');
      items.push(filesHeader);

      for (const f of episode.changedFiles.slice(0, 10)) {
        const basename = f.split(/[\\/]/).pop() || f;
        const fileItem = new vscode.TreeItem(basename, vscode.TreeItemCollapsibleState.None);
        fileItem.tooltip = f;
        fileItem.iconPath = new vscode.ThemeIcon('file');
        items.push(fileItem);
      }
    }

    // ── Actions ──────────────────────────────────────────────────────────

    const newEp = new vscode.TreeItem('New Episode', vscode.TreeItemCollapsibleState.None);
    newEp.command = { command: 'contextlens.newEpisode', title: 'New Episode' };
    newEp.iconPath = new vscode.ThemeIcon('add');
    items.push(newEp);

    const closeEp = new vscode.TreeItem('Close Episode', vscode.TreeItemCollapsibleState.None);
    closeEp.command = { command: 'contextlens.closeEpisode', title: 'Close Episode' };
    closeEp.iconPath = new vscode.ThemeIcon('close');
    items.push(closeEp);

    const explainDiff = new vscode.TreeItem('Explain Diff', vscode.TreeItemCollapsibleState.None);
    explainDiff.command = { command: 'contextlens.explainDiff', title: 'Explain Diff' };
    explainDiff.iconPath = new vscode.ThemeIcon('lightbulb');
    items.push(explainDiff);

    const openDash = new vscode.TreeItem('Open Dashboard', vscode.TreeItemCollapsibleState.None);
    openDash.command = { command: 'contextlens.openDashboardEpisode', title: 'Open Dashboard' };
    openDash.iconPath = new vscode.ThemeIcon('link-external');
    items.push(openDash);

    // ── Notes ────────────────────────────────────────────────────────────

    const noteItem = new vscode.TreeItem('Note', vscode.TreeItemCollapsibleState.None);
    noteItem.description = episode.note || 'none';
    noteItem.iconPath = new vscode.ThemeIcon('note');
    items.push(noteItem);

    return items;
  }
}
