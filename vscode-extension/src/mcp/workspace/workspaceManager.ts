/**
 * MCP Multi-Workspace Manager
 *
 * Per-workspace isolation: git state, episodes, search index, memory.
 */

export interface WorkspaceState {
  /** Workspace folder URI */
  uri: string;
  /** Display name */
  name: string;
  /** Associated project ID */
  projectId: string | null;
  /** Active episode ID */
  activeEpisodeId: string | null;
  /** Git branch */
  branch: string | null;
  /** Last activity timestamp */
  lastActivity: number;
  /** File count tracked */
  trackedFiles: number;
}

export class WorkspaceManager {
  private static instance: WorkspaceManager;
  private workspaces: Map<string, WorkspaceState> = new Map();
  private activeWorkspaceUri: string | null = null;

  private constructor() {}

  static getInstance(): WorkspaceManager {
    if (!WorkspaceManager.instance) {
      WorkspaceManager.instance = new WorkspaceManager();
    }
    return WorkspaceManager.instance;
  }

  /**
   * Register or update a workspace.
   */
  registerWorkspace(uri: string, name: string): WorkspaceState {
    const existing = this.workspaces.get(uri);
    if (existing) {
      existing.name = name;
      existing.lastActivity = Date.now();
      return existing;
    }

    const state: WorkspaceState = {
      uri,
      name,
      projectId: null,
      activeEpisodeId: null,
      branch: null,
      lastActivity: Date.now(),
      trackedFiles: 0,
    };

    this.workspaces.set(uri, state);
    if (!this.activeWorkspaceUri) {
      this.activeWorkspaceUri = uri;
    }
    return state;
  }

  /**
   * Update workspace state.
   */
  updateWorkspace(uri: string, updates: Partial<WorkspaceState>): WorkspaceState | null {
    const state = this.workspaces.get(uri);
    if (!state) return null;

    Object.assign(state, updates, { lastActivity: Date.now() });
    return state;
  }

  /**
   * Set active workspace.
   */
  setActive(uri: string): boolean {
    if (!this.workspaces.has(uri)) return false;
    this.activeWorkspaceUri = uri;
    return true;
  }

  /**
   * Get active workspace.
   */
  getActive(): WorkspaceState | null {
    if (!this.activeWorkspaceUri) return null;
    return this.workspaces.get(this.activeWorkspaceUri) || null;
  }

  /**
   * List all workspaces.
   */
  listWorkspaces(): WorkspaceState[] {
    return Array.from(this.workspaces.values());
  }

  /**
   * Remove workspace.
   */
  removeWorkspace(uri: string): boolean {
    const result = this.workspaces.delete(uri);
    if (this.activeWorkspaceUri === uri) {
      const remaining = Array.from(this.workspaces.keys());
      this.activeWorkspaceUri = remaining.length > 0 ? remaining[0] : null;
    }
    return result;
  }

  /**
   * Get workspace count.
   */
  get size(): number {
    return this.workspaces.size;
  }
}
