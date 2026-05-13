import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { EpisodeStore } from './episodeStore';

/**
 * Manages the ContextLens status bar item.
 * Handles different states: Sign In, Ready, and Active Episode.
 */
export class ContextLensStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private authManager: AuthManager;

  constructor(context: vscode.ExtensionContext, authManager: AuthManager) {
    this.authManager = authManager;
    this.statusBarItem = vscode.window.createStatusBarItem(
      'contextlens.status',
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.name = 'ContextLens';
    this.statusBarItem.command = 'contextlens.openDashboard';
    context.subscriptions.push(this.statusBarItem);

    // Initial render
    this.render();
  }

  /**
   * Updates the status bar text, tooltip, and command based on the current state.
   */
  public async render(): Promise<void> {
    const authState = await this.authManager.loadAuthState();

    if (!authState) {
      this.renderSignIn();
      return;
    }

    const ep = EpisodeStore.get().getActiveEpisode();

    if (!ep) {
      this.renderReady();
    } else {
      this.renderActiveEpisode(ep);
    }
  }

  private renderSignIn() {
    this.statusBarItem.text = '$(account) ContextLens: Sign In';
    this.statusBarItem.tooltip = 'Click to sign in to ContextLens';
    this.statusBarItem.command = 'contextlens.signIn';
    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
    this.statusBarItem.show();
  }

  private renderReady() {
    this.statusBarItem.text = '$(check) ContextLens: Ready';
    this.statusBarItem.tooltip = 'Signed in — Click to open dashboard';
    this.statusBarItem.command = 'contextlens.openDashboard';
    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    this.statusBarItem.show();
  }

  private renderActiveEpisode(ep: any) {
    const sync = EpisodeStore.get().getSyncStatus();
    const syncText = sync.pending > 0 ? ` (syncing ${sync.pending}...)` : '';
    
    this.statusBarItem.text = `$(circle-filled) ContextLens: ${ep.name} · ${ep.callCount} calls${syncText}`;
    this.statusBarItem.tooltip = `${ep.name} on ${ep.branchName} — ${ep.callCount} AI calls. ${sync.pending} items pending sync.`;
    this.statusBarItem.command = 'contextlens.openDashboardEpisode';
    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    this.statusBarItem.show();
  }

  public hide() {
    this.statusBarItem.hide();
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
