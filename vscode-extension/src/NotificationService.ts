import * as vscode from 'vscode';

/**
 * Centralized notification service for the ContextLens extension.
 *
 * Features:
 * - Deduplication: suppresses identical messages within a 30-second window.
 * - Severity routing: success auto-dismisses, errors are sticky with actions.
 * - Standard user-friendly messages (never raw errors).
 * - Action callbacks: allow inline "Sign In", "Retry", "Dismiss" buttons.
 *
 * Usage:
 *   const notifier = NotificationService.getInstance();
 *   notifier.success('Episode saved.');
 *   notifier.error('Failed to sync.', { action: 'retry', onAction: () => retry() });
 */

type NotificationLevel = 'success' | 'info' | 'warning' | 'error';

interface NotificationAction {
  /** Label displayed on the action button. */
  label: string;
  /** Callback when action is clicked. */
  onAction: () => void;
}

interface NotifyOptions {
  /** Override dedup window in ms (default: 30000). */
  dedupWindowMs?: number;
  /** Action button to attach. */
  action?: NotificationAction;
  /** Secondary action button. */
  secondaryAction?: NotificationAction;
}

const DEFAULT_DEDUP_MS = 30_000;

export class NotificationService {
  private static instance: NotificationService;
  private recentMessages: Map<string, number> = new Map();

  private constructor() {
    // Cleanup stale entries every 60s to prevent memory leak
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.recentMessages.entries()) {
        if (now - timestamp > DEFAULT_DEDUP_MS * 2) {
          this.recentMessages.delete(key);
        }
      }
    }, 60_000);
  }

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** Success notification — auto-dismisses via status bar. */
  success(message: string, options?: NotifyOptions): void {
    if (this.isDuplicate(message, options?.dedupWindowMs)) return;
    vscode.window.setStatusBarMessage(`✅ ${message}`, 4000);
  }

  /** Informational notification — standard VS Code info toast. */
  info(message: string, options?: NotifyOptions): void {
    if (this.isDuplicate(message, options?.dedupWindowMs)) return;
    this.showWithActions(vscode.window.showInformationMessage, message, options);
  }

  /** Warning notification — sticks around, optional action. */
  warning(message: string, options?: NotifyOptions): void {
    if (this.isDuplicate(message, options?.dedupWindowMs)) return;
    this.showWithActions(vscode.window.showWarningMessage, message, options);
  }

  /** Error notification — always sticky, typically with action. */
  error(message: string, options?: NotifyOptions): void {
    if (this.isDuplicate(message, options?.dedupWindowMs)) return;
    this.showWithActions(vscode.window.showErrorMessage, message, options);
  }

  /**
   * Show a notification for a specific error code (from ErrorMapper).
   * Uses the mapped user message and action.
   */
  fromMapped(mapped: {
    level: NotificationLevel;
    message: string;
    action?: NotificationAction;
  }): void {
    switch (mapped.level) {
      case 'success': this.success(mapped.message); break;
      case 'info': this.info(mapped.message, { action: mapped.action }); break;
      case 'warning': this.warning(mapped.message, { action: mapped.action }); break;
      case 'error': this.error(mapped.message, { action: mapped.action }); break;
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /** Returns true if this exact message was shown recently. */
  private isDuplicate(message: string, windowMs?: number): boolean {
    const window = windowMs || DEFAULT_DEDUP_MS;
    const lastShown = this.recentMessages.get(message);
    if (lastShown && Date.now() - lastShown < window) {
      return true;
    }
    this.recentMessages.set(message, Date.now());
    return false;
  }

  /** Show a vscode notification with optional action buttons. */
  private showWithActions(
    showFn: typeof vscode.window.showInformationMessage,
    message: string,
    options?: NotifyOptions,
  ): void {
    const buttons: string[] = [];
    if (options?.action) buttons.push(options.action.label);
    if (options?.secondaryAction) buttons.push(options.secondaryAction.label);

    showFn(`ContextLens: ${message}`, ...buttons).then((selected) => {
      if (options?.action && selected === options.action.label) {
        options.action.onAction();
      } else if (options?.secondaryAction && selected === options.secondaryAction.label) {
        options.secondaryAction.onAction();
      }
    });
  }
}
