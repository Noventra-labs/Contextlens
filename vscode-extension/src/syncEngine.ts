import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

// ── Types ──────────────────────────────────────────────────────────────────

export interface QueuedItem {
  id: string;
  type: 'call' | 'episode_update' | 'changed_files' | 'episode_close' | 'episode_create';
  endpoint: string;
  payload: any;
  createdAt: number;
  retries: number;
  projectId: string;
  episodeId?: string;
  /** Idempotency key for dedup on the backend. */
  idempotencyKey: string;
}

/** Sync engine operational states. */
export type SyncState =
  | 'idle'         // No items in queue
  | 'pending'      // Items queued, waiting for next flush
  | 'syncing'      // Actively sending items
  | 'synced'       // Queue empty after successful flush
  | 'retrying'     // Retrying failed items
  | 'offline'      // Network unreachable
  | 'paused-auth'  // Auth expired, waiting for re-auth
  | 'failed';      // All retries exhausted

/**
 * SyncEngine is a background worker that ensures all development activity (AI calls, episodes)
 * is eventually synchronized with the ContextLens backend, even if the user is offline.
 * 
 * Lifecycle:
 * 1. Items are enqueued via `enqueue()`.
 * 2. Enqueued items are immediately persisted to disk (`cl_queue.json`) to survive crashes.
 * 3. Flush interval is dynamic: faster when queue is large.
 * 4. A connectivity timer checks the backend health every 15s.
 * 
 * Retry Strategy:
 * - Each item is tried up to 5 times (`MAX_RETRIES`).
 * - If a request fails with a network error, the engine enters an "offline" state.
 * - While offline, flushing is paused to save resources.
 * - Once connectivity is restored, the queue is automatically flushed.
 * - Items that continue to fail after max retries are permanently discarded.
 *
 * Queue Corruption Recovery:
 * - If the persisted queue file is corrupt, the engine backs it up and starts fresh.
 * - A notification is shown to the user.
 */
export class SyncEngine {
  private queue: QueuedItem[] = [];
  private isOnline: boolean = true;
  private isFlushing: boolean = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private connectivityTimer: ReturnType<typeof setInterval> | null = null;
  private persistPath: string = '';
  private context: vscode.ExtensionContext;
  private apiClient: any;
  private _state: SyncState = 'idle';

  // Callbacks for state observers (status bar, etc.)
  private stateListeners: Array<(state: SyncState) => void> = [];

  private readonly BASE_FLUSH_MS = 30_000;           // flush every 30s normally
  private readonly FAST_FLUSH_MS = 5_000;            // flush every 5s when queue > 10
  private readonly CONNECTIVITY_CHECK_MS = 15_000;   // check online every 15s
  private readonly CHUNK_SIZE = 5;                   // max 5 items per flush
  private readonly MAX_RETRIES = 5;                  // drop after 5 failures
  private readonly MAX_QUEUE_SIZE = 200;             // max buffered items
  private readonly ITEM_DELAY_MS = 200;              // delay between items

  /**
   * Creates a new SyncEngine instance.
   * @param options Configuration options including extension context and API client.
   */
  constructor(options: {
    context: vscode.ExtensionContext;
    apiClient: any;
  }) {
    this.context = options.context;
    this.apiClient = options.apiClient;

    // Set persist path in VS Code extension global storage
    const storagePath = options.context.globalStorageUri?.fsPath;
    if (storagePath) {
      this.persistPath = path.join(storagePath, 'cl_queue.json');
    }

    // Load unsynced items from previous session
    this.loadFromDisk();

    // Start timers
    this.startFlushTimer();
    this.startConnectivityTimer();

    // Cleanup on extension deactivate
    options.context.subscriptions.push({
      dispose: () => this.dispose()
    });
  }

  // ─── PUBLIC API ─────────────────────────────────────────

  /**
   * Adds an item to the synchronization queue.
   * Items are persisted to disk immediately to prevent data loss.
   * @param item The request details (type, endpoint, payload, etc.)
   */
  enqueue(
    item: Omit<QueuedItem, 'id' | 'createdAt' | 'retries' | 'idempotencyKey'>
  ): void {
    // Drop oldest if full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.queue.shift();
    }

    this.queue.push({
      ...item,
      id: uid(),
      idempotencyKey: generateIdempotencyKey(),
      createdAt: Date.now(),
      retries: 0,
    });

    // Save to disk immediately
    this.saveToDisk();
    this.updateState();

    // Switch to fast flush if queue is growing
    this.adjustFlushInterval();
  }

  /**
   * Triggers an immediate synchronization of the queue if online and not already flushing.
   */
  async forceFlush(): Promise<void> {
    if (!this.isOnline || this.isFlushing) return;
    await this.flush();
  }

  /** Status for status bar and UI consumers. */
  getStatus(): { pending: number; isOnline: boolean; state: SyncState } {
    return {
      pending: this.queue.length,
      isOnline: this.isOnline,
      state: this._state,
    };
  }

  /** Current sync state. */
  get state(): SyncState {
    return this._state;
  }

  /** Subscribe to state changes. */
  onStateChange(listener: (state: SyncState) => void): void {
    this.stateListeners.push(listener);
  }

  /**
   * Fix 12: Resume queue after successful re-authentication.
   * Transitions out of paused-auth state and triggers immediate flush.
   */
  async resumeAfterAuth(): Promise<void> {
    if (this._state !== 'paused-auth') return;
    this.setState('pending');
    await this.flush();
  }

  // ─── FLUSH ──────────────────────────────────────────────

  /**
   * Processes a chunk of the queue and sends them to the backend.
   */
  private async flush(): Promise<void> {
    if (this.isFlushing) return;
    if (this.queue.length === 0) return;
    if (!this.isOnline) return;

    this.isFlushing = true;
    this.setState('syncing');
    const successfulIds = new Set<string>();
    const failedPermanentlyIds = new Set<string>();

    try {
      // Take first CHUNK_SIZE items only
      const chunk = this.queue.slice(0, this.CHUNK_SIZE);

      for (const item of chunk) {
        try {
          await this.apiClient.post(item.endpoint, item.payload, {
            headers: { 'X-Idempotency-Key': item.idempotencyKey },
          });
          successfulIds.add(item.id);
        } catch (err: any) {
          item.retries++;

          const isNotFoundError = err.message && (err.message.includes('not found') || err.message.includes('deleted'));

          // Drop permanently after max retries or if the resource was already deleted/not found on server (404)
          if (item.retries >= this.MAX_RETRIES || isNotFoundError) {
            failedPermanentlyIds.add(item.id);
          }

          // Auth error — pause syncing until re-auth
          if (isAuthError(err)) {
            this.setState('paused-auth');
            break;
          }

          // Network error — go offline, stop sending
          if (isNetworkError(err)) {
            this.isOnline = false;
            this.setState('offline');
            break;
          }
        }

        // Small delay between each item
        await sleep(this.ITEM_DELAY_MS);
      }

      // Single pass filtering for efficiency
      if (successfulIds.size > 0 || failedPermanentlyIds.size > 0) {
        this.queue = this.queue.filter(
          q => !successfulIds.has(q.id) && !failedPermanentlyIds.has(q.id)
        );
      }

    } finally {
      this.isFlushing = false;
      this.saveToDisk();
      this.updateState();
      this.adjustFlushInterval();
    }
  }

  // ─── TIMERS ─────────────────────────────────────────────

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.queue.length === 0) return;
      if (!this.isOnline) return;
      if (this.isFlushing) return;
      if (this._state === 'paused-auth') return;
      await this.flush();
    }, this.BASE_FLUSH_MS);
  }

  /** Dynamically adjust flush interval based on queue size. */
  private adjustFlushInterval(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);

    const interval = this.queue.length > 10 ? this.FAST_FLUSH_MS : this.BASE_FLUSH_MS;

    this.flushTimer = setInterval(async () => {
      if (this.queue.length === 0) return;
      if (!this.isOnline) return;
      if (this.isFlushing) return;
      if (this._state === 'paused-auth') return;
      await this.flush();
    }, interval);
  }

  private startConnectivityTimer(): void {
    this.connectivityTimer = setInterval(async () => {
      const wasOffline = !this.isOnline;
      this.isOnline = await checkOnline();

      // Just came back online
      if (wasOffline && this.isOnline && this.queue.length > 0) {
        vscode.window.setStatusBarMessage(
          `ContextLens: Back online — syncing ${this.queue.length} buffered items...`,
          4000
        );
        this.setState('pending');
        await this.flush();
      }
    }, this.CONNECTIVITY_CHECK_MS);
  }

  // ─── STATE MANAGEMENT ──────────────────────────────────

  private setState(state: SyncState): void {
    if (this._state === state) return;
    this._state = state;
    for (const listener of this.stateListeners) {
      try { listener(state); } catch { /* don't crash on listener errors */ }
    }
  }

  private updateState(): void {
    if (!this.isOnline) {
      this.setState('offline');
    } else if (this.queue.length === 0) {
      this.setState(this._state === 'syncing' ? 'synced' : 'idle');
    } else if (this.queue.some(q => q.retries > 0)) {
      this.setState('retrying');
    } else {
      this.setState('pending');
    }
  }

  // ─── DISK PERSISTENCE ───────────────────────────────────

  private saveToDisk(): void {
    if (!this.persistPath) return;
    try {
      const dir = path.dirname(this.persistPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      // Save max 100 items to keep file tiny
      const toSave = this.queue.slice(-100);
      fs.writeFileSync(
        this.persistPath,
        JSON.stringify(toSave),
        'utf8'
      );
    } catch {
      // Silent fail — don't crash extension over disk write
    }
  }

  private loadFromDisk(): void {
    if (!this.persistPath) return;
    try {
      if (!fs.existsSync(this.persistPath)) return;
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const saved: QueuedItem[] = JSON.parse(raw);
      if (Array.isArray(saved) && saved.length > 0) {
        this.queue = saved;
        vscode.window.setStatusBarMessage(
          `ContextLens: ${saved.length} items recovered from last session.`,
          4000
        );
      }
    } catch (parseErr) {
      // ── Queue Corruption Recovery ──────────────────────────
      // Backup the corrupt file, start fresh, notify user.
      console.warn('[ContextLens] Queue file corrupted. Backing up and starting fresh.');
      try {
        const backupPath = this.persistPath + `.backup.${Date.now()}`;
        fs.copyFileSync(this.persistPath, backupPath);
        fs.writeFileSync(this.persistPath, '[]', 'utf8');
      } catch {
        // Can't even backup — just wipe
        try { fs.writeFileSync(this.persistPath, '[]', 'utf8'); } catch { /* give up */ }
      }
      this.queue = [];
      vscode.window.showWarningMessage(
        'ContextLens: Sync queue was corrupted and has been reset. A backup was saved.'
      );
    }
  }

  // ─── CLEANUP ────────────────────────────────────────────

  dispose(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
    if (this.connectivityTimer) clearInterval(this.connectivityTimer);
    // Final save before shutdown
    this.saveToDisk();
  }
}

// ─── HELPERS ──────────────────────────────────────────────

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generateIdempotencyKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function isNetworkError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('network') ||
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('etimedout') ||
    msg.includes('failed to fetch') ||
    msg.includes('net::err')
  );
}

function isAuthError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  const code = (err?.code || '').toUpperCase();
  return (
    code === 'AUTH_ERROR' ||
    code === 'AUTH_EXPIRED' ||
    msg.includes('session expired') ||
    msg.includes('not authenticated') ||
    msg.includes('sign in required')
  );
}

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch(
      'https://contextlens-backend-001.web.app/api/_health',
      { method: 'GET', signal: AbortSignal.timeout(5000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}
