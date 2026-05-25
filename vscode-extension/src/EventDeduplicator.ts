/**
 * EventDeduplicator — prevents redundant events from being enqueued.
 *
 * Problems solved:
 * - File saves fire onDidSaveTextDocument multiple times per save
 * - Rapid branch switches during rebase fire HEAD watcher repeatedly
 * - Same commit hash can be detected multiple times
 *
 * Uses time-based dedup:
 * - File saves: 500ms per-file debounce
 * - Commits: hash-based dedup with 5s window
 * - Metadata updates: 2s per-key debounce
 */

export class EventDeduplicator {
  /** Map of event key → last seen timestamp */
  private seen: Map<string, number> = new Map();

  /** Map of event key → debounce timer */
  private timers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  /** Default window sizes by event type */
  private readonly windows: Record<string, number> = {
    file_save: 500,
    commit: 5000,
    branch_switch: 2000,
    metadata: 2000,
  };

  constructor() {
    // Cleanup stale entries every 60s
    setInterval(() => {
      const now = Date.now();
      for (const [key, timestamp] of this.seen.entries()) {
        if (now - timestamp > 60_000) {
          this.seen.delete(key);
        }
      }
    }, 60_000);
  }

  /**
   * Check if this event should be processed.
   * Returns true if the event should proceed, false if it's a duplicate.
   *
   * @param type - Event type ('file_save', 'commit', 'branch_switch', 'metadata').
   * @param key - Unique identifier (file path, commit hash, branch name, etc.).
   */
  shouldProcess(type: string, key: string): boolean {
    const fullKey = `${type}:${key}`;
    const window = this.windows[type] || 1000;
    const lastSeen = this.seen.get(fullKey);

    if (lastSeen && Date.now() - lastSeen < window) {
      return false; // Duplicate within window
    }

    this.seen.set(fullKey, Date.now());
    return true;
  }

  /**
   * Debounced event processing.
   * Calls the callback only after the debounce window expires.
   * Resets the timer if called again within the window.
   *
   * @param type - Event type.
   * @param key - Unique identifier.
   * @param callback - Function to execute after debounce.
   */
  debounce(type: string, key: string, callback: () => void): void {
    const fullKey = `${type}:${key}`;
    const window = this.windows[type] || 1000;

    // Cancel existing timer
    const existing = this.timers.get(fullKey);
    if (existing) {
      clearTimeout(existing);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.timers.delete(fullKey);
      this.seen.set(fullKey, Date.now());
      callback();
    }, window);

    this.timers.set(fullKey, timer);
  }

  /**
   * Check if a commit hash has already been seen recently.
   */
  isCommitSeen(hash: string): boolean {
    return !this.shouldProcess('commit', hash);
  }

  /**
   * Cancel all pending timers (for extension deactivation).
   */
  dispose(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.seen.clear();
  }
}
