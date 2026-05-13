import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface QueuedItem {
  id: string;
  type: 'call' | 'episode_update' | 'changed_files' | 'episode_close' | 'episode_create';
  endpoint: string;
  payload: any;
  createdAt: number;
  retries: number;
  projectId: string;
  episodeId?: string;
}

/**
 * A background worker that manages a queue of API requests to be sent to the backend.
 * Provides offline support, disk persistence, and retry logic.
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

  private readonly FLUSH_INTERVAL_MS = 30_000;     // flush every 30s
  private readonly CONNECTIVITY_CHECK_MS = 15_000; // check online every 15s
  private readonly CHUNK_SIZE = 5;                 // max 5 items per flush
  private readonly MAX_RETRIES = 5;                // drop after 5 failures
  private readonly MAX_QUEUE_SIZE = 200;           // max buffered items
  private readonly ITEM_DELAY_MS = 200;            // delay between items

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

  // Add item to queue — returns immediately, never blocks
  /**
   * Adds an item to the synchronization queue.
   * Items are persisted to disk immediately to prevent data loss.
   * @param item The request details (type, endpoint, payload, etc.)
   */
  enqueue(
    item: Omit<QueuedItem, 'id' | 'createdAt' | 'retries'>
  ): void {
    // Drop oldest if full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.queue.shift();
    }

    this.queue.push({
      ...item,
      id: uid(),
      createdAt: Date.now(),
      retries: 0,
    });

    // Save to disk immediately
    // so data survives VS Code closing before flush
    this.saveToDisk();
  }

  // Force flush — call before Gemini button actions
  // so episode state is current before Gemini reads it
  /**
   * Triggers an immediate synchronization of the queue if online and not already flushing.
   */
  async forceFlush(): Promise<void> {
    if (!this.isOnline || this.isFlushing) return;
    await this.flush();
  }

  // Status for status bar
  getStatus(): { pending: number; isOnline: boolean } {
    return {
      pending: this.queue.length,
      isOnline: this.isOnline,
    };
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

    try {
      // Take first CHUNK_SIZE items only
      const chunk = this.queue.slice(0, this.CHUNK_SIZE);

      for (const item of chunk) {
        try {
          await this.apiClient.post(item.endpoint, item.payload);

          // Remove on success
          this.queue = this.queue.filter(q => q.id !== item.id);

        } catch (err: any) {
          item.retries++;

          // Drop permanently after max retries
          if (item.retries >= this.MAX_RETRIES) {
            this.queue = this.queue.filter(q => q.id !== item.id);
          }

          // Network error — go offline, stop sending
          if (isNetworkError(err)) {
            this.isOnline = false;
            break;
          }
        }

        // Small delay between each item
        // Prevents hammering the backend
        await sleep(this.ITEM_DELAY_MS);
      }

    } finally {
      this.isFlushing = false;
      this.saveToDisk();
    }
  }

  // ─── TIMERS ─────────────────────────────────────────────

  private startFlushTimer(): void {
    this.flushTimer = setInterval(async () => {
      if (this.queue.length === 0) return;
      if (!this.isOnline) return;
      if (this.isFlushing) return;
      await this.flush();
    }, this.FLUSH_INTERVAL_MS);
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
        await this.flush();
      }
    }, this.CONNECTIVITY_CHECK_MS);
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
      // Silent fail
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
    } catch {
      // Corrupt file — ignore
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
  return `\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}`;
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

async function checkOnline(): Promise<boolean> {
  try {
    const res = await fetch(
      'https://us-central1-contextlens-backend-001.cloudfunctions.net/api/health',
      { method: 'GET', signal: AbortSignal.timeout(5000) }
    );
    return res.ok;
  } catch {
    return false;
  }
}
