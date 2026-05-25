import * as vscode from 'vscode';
import { AuthManager } from './auth';
import { EpisodeStore } from './episodeStore';
import { ApiClient } from './apiClient';
import type { SyncState } from './syncEngine';

/**
 * Manages the ContextLens status bar item.
 * Handles different states: Sign In, Ready, and Active Episode.
 * Shows the active AI provider when authenticated.
 */
export class ContextLensStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private authManager: AuthManager;
  private cachedProvider: string = '';
  private syncState: SyncState = 'idle';
  private syncPending: number = 0;

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

    // Fetch provider config in background (non-blocking for UI)
    this.refreshProviderInfo();

    const ep = EpisodeStore.get().getActiveEpisode();

    if (!ep) {
      this.renderReady();
    } else {
      this.renderActiveEpisode(ep);
    }
  }

  /**
   * Fetches the active provider from the backend and re-renders if changed.
   */
  private async refreshProviderInfo(): Promise<void> {
    try {
      const settings = await ApiClient.getSettings();
      const providerLabel = this.getProviderLabel(settings.aiProvider);
      if (providerLabel !== this.cachedProvider) {
        this.cachedProvider = providerLabel;
        // Re-render with updated provider info
        const ep = EpisodeStore.get().getActiveEpisode();
        if (!ep) {
          this.renderReady();
        } else {
          this.renderActiveEpisode(ep);
        }
      }
    } catch {
      // Silently fail — use cached or default
    }
  }

  private getProviderLabel(provider: string): string {
    switch (provider) {
      case 'openai': return 'OpenAI';
      case 'anthropic': return 'Anthropic';
      case 'gemini': return 'Gemini (BYO Key)';
      default: return 'Gemini';
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
    const providerSuffix = this.cachedProvider ? ` · ${this.cachedProvider}` : '';
    this.statusBarItem.text = `$(check) ContextLens: Ready${providerSuffix}`;
    this.statusBarItem.tooltip = `Signed in — AI: ${this.cachedProvider || 'Gemini (default)'}\nClick to open dashboard`;
    this.statusBarItem.command = 'contextlens.openDashboard';
    this.statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
    this.statusBarItem.show();
  }

  private renderActiveEpisode(ep: any) {
    const sync = EpisodeStore.get().getSyncStatus();
    const pending = sync.pending || this.syncPending;

    let syncText = '';
    if (this.syncState === 'offline') {
      syncText = ` · Offline${pending > 0 ? ` • ${pending} pending` : ''}`;
    } else if (this.syncState === 'syncing') {
      syncText = ` (syncing ${pending}…)`;
    } else if (this.syncState === 'paused-auth') {
      syncText = ' · Auth expired';
    } else if (pending > 0) {
      syncText = ` (${pending} pending)`;
    }

    const providerSuffix = this.cachedProvider ? ` · ${this.cachedProvider}` : '';
    
    this.statusBarItem.text = `$(circle-filled) ContextLens: ${ep.name} · ${ep.callCount} calls${syncText}${providerSuffix}`;
    this.statusBarItem.tooltip = `${ep.name} on ${ep.branchName} — ${ep.callCount} AI calls. ${pending} items pending sync.\nSync: ${this.syncState}\nAI Provider: ${this.cachedProvider || 'Gemini (default)'}`;
    this.statusBarItem.command = 'contextlens.openDashboardEpisode';
    this.statusBarItem.color = this.syncState === 'offline'
      ? new vscode.ThemeColor('statusBarItem.warningForeground')
      : new vscode.ThemeColor('statusBarItem.prominentForeground');
    this.statusBarItem.show();
  }

  /** Call from SyncEngine.onStateChange to update status bar. */
  public updateSyncState(state: SyncState, pending: number): void {
    this.syncState = state;
    this.syncPending = pending;
    this.render();
  }

  public hide() {
    this.statusBarItem.hide();
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
