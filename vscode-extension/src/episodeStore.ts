import * as vscode from 'vscode';
import { ApiClient } from './apiClient';
import { GitContext } from './gitContext';
import { getAuthManager } from './auth';
import { SyncEngine } from './syncEngine';

/**
 * Represents a single development episode or task tracked by ContextLens.
 */
export interface Episode {
  /** Unique identifier for the episode (can be a temporary ID before sync). */
  id: string;
  /** Human-readable label for the task. */
  name: string;
  /** Number of AI calls logged during this episode. */
  callCount: number;
  /** List of file paths modified during this episode. */
  changedFiles: string[];
  /** Optional notes or metadata associated with the episode. */
  note: string;
  /** The branch this episode is associated with. */
  branchName: string;
}

/**
 * Manages the state of "episodes" (development tasks) within the VS Code workspace.
 * Handles persistence, project auto-resolution, and interaction with the SyncEngine.
 * Implements a Singleton pattern.
 */
export class EpisodeStore {
  private static instance: EpisodeStore;
  private activeEpisode: Episode | null = null;
  private projectId: string | null = null;
  private projectName: string | null = null;
  private syncEngine: SyncEngine | null = null;
  private onDidChangeEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChange = this.onDidChangeEmitter.event;

  private constructor(private context: vscode.ExtensionContext) {
    this.load();
    this.syncEngine = new SyncEngine({
      context,
      apiClient: ApiClient
    });
  }

  /**
   * Initializes the singleton instance of EpisodeStore.
   * @param context The VS Code extension context for storage and disposal.
   */
  static initialize(context: vscode.ExtensionContext) {
    if (!EpisodeStore.instance) {
      EpisodeStore.instance = new EpisodeStore(context);
    }
  }

  /**
   * Returns the singleton instance of EpisodeStore.
   */
  static get(): EpisodeStore {
    return EpisodeStore.instance;
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  /**
   * Loads state from the VS Code workspaceState.
   */
  private load() {
    this.activeEpisode = this.context.workspaceState.get<Episode>('contextlens.activeEpisode') ?? null;
    this.projectId = this.context.workspaceState.get<string>('contextlens.projectId') ?? null;
    this.projectName = this.context.workspaceState.get<string>('contextlens.projectName') ?? null;
  }

  private save() {
    this.context.workspaceState.update('contextlens.activeEpisode', this.activeEpisode);
    this.context.workspaceState.update('contextlens.projectId', this.projectId);
    this.context.workspaceState.update('contextlens.projectName', this.projectName);
    this.onDidChangeEmitter.fire();
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /**
   * Returns the currently active development episode, or null if none.
   */
  public getActiveEpisode(): Episode | null {
    return this.activeEpisode;
  }

  /**
   * Returns the resolved project ID for the current workspace.
   */
  public getProjectId(): string | null {
    return this.projectId;
  }

  /**
   * Returns the display name of the current project.
   */
  public getProjectName(): string | null {
    return this.projectName;
  }

  /**
   * Returns the current synchronization status from the SyncEngine.
   */
  public getSyncStatus() {
    return this.syncEngine?.getStatus() ?? { pending: 0, isOnline: false };
  }

  /**
   * Manually triggers a flush of all pending operations in the SyncEngine.
   */
  public async forceSync(): Promise<void> {
    await this.syncEngine?.forceFlush();
  }

  // ── Project auto-resolve ───────────────────────────────────────────────────

  /**
   * Ensures a project exists for the current workspace by checking git remotes.
   * If no project is found, it attempts to create one on the backend.
   * Gates on authentication.
   * @returns The project ID if resolved/created, otherwise null.
   */
  public async ensureProject(): Promise<string | null> {
    if (this.projectId) {
      return this.projectId;
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
      return null;
    }

    // ── Auth gate ──
    const authManager = getAuthManager();
    const authState = await authManager.loadAuthState();
    if (!authState) {
      // Not signed in yet — don't block activation. User will sign in later.
      return null;
    }

    const folderName = folders[0].name;
    let repoUrl: string | undefined;
    try {
      const gitCtx = await GitContext.getContext();
      if (gitCtx.isGitRepo) {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const { stdout } = await execAsync('git remote get-url origin', {
          cwd: folders[0].uri.fsPath,
        });
        repoUrl = stdout.trim();
      }
    } catch {
      // no remote — that's fine
    }

    try {
      const res = await ApiClient.createProject({
        name: folderName,
        repoUrl,
        localWorkspaceName: folderName,
      });
      this.projectId = res.projectId;
      this.projectName = folderName;
      this.save();
      return this.projectId;
    } catch (err: any) {
      vscode.window.showErrorMessage(`ContextLens: Failed to create project — ${err.message}`);
      return null;
    }
  }

  // ── Episode lifecycle ──────────────────────────────────────────────────────

  /**
   * Creates a new episode on the backend and sets it as the active one.
   * This is a blocking call typically triggered by a user action.
   * @param name The descriptive label for the episode.
   */
  public async createEpisode(name: string): Promise<void> {
    const trimmedName = name.trim();
    if (!trimmedName) {
      vscode.window.showErrorMessage('ContextLens: Episode name cannot be empty.');
      return;
    }

    // ── Auth gate ──
    await getAuthManager().ensureSignedIn();

    const projectId = await this.ensureProject();
    if (!projectId) {
      vscode.window.showErrorMessage('ContextLens: No project. Open a workspace first.');
      return;
    }

    const gitCtx = await GitContext.getContext();
    const branchName = gitCtx.branch || 'main';

    try {
      const res = await ApiClient.createEpisode({
        projectId,
        label: trimmedName,
        branchName,
      });

      this.activeEpisode = {
        id: res.episodeId,
        name: trimmedName,
        callCount: 0,
        changedFiles: [],
        note: '',
        branchName,
      };
      this.save();
    } catch (err: any) {
      vscode.window.showErrorMessage(`ContextLens: Failed to create episode — ${err.message}`);
    }
  }

  /**
   * Closes the currently active episode.
   * Sends a blocking request to the backend.
   */
  public async closeEpisode(): Promise<void> {
    if (!this.activeEpisode || !this.projectId) {
      this.activeEpisode = null;
      this.save();
      return;
    }

    try {
      await ApiClient.closeEpisode({
        projectId: this.projectId,
        episodeId: this.activeEpisode.id,
      });
    } catch (err: any) {
      vscode.window.showWarningMessage(`ContextLens: Could not close episode on server — ${err.message}`);
    }

    this.activeEpisode = null;
    this.save();
  }

  /**
   * Closes the active episode asynchronously via the SyncEngine.
   * Useful for automatic triggers where blocking is undesirable.
   */
  public async closeEpisodeSilent(): Promise<void> {
    if (!this.activeEpisode || !this.projectId) {
      this.activeEpisode = null;
      this.save();
      return;
    }

    this.syncEngine?.enqueue({
      type: 'episode_close',
      endpoint: '/episodes/close',
      projectId: this.projectId,
      episodeId: this.activeEpisode.id,
      payload: {
        projectId: this.projectId,
        episodeId: this.activeEpisode.id,
      }
    });

    this.activeEpisode = null;
    this.save();
  }

  /**
   * Auto-creates an episode asynchronously via the SyncEngine.
   * Assigns a temporary ID locally which is reconciled on the backend.
   * @param name The label for the episode.
   * @param branchName The branch name to associate.
   */
  public async autoCreateEpisode(name: string, branchName: string): Promise<void> {
    const trimmedName = name.trim();
    if (!this.projectId || !trimmedName) return;

    // We generate a temporary ID so we can start logging calls immediately
    const tempEpisodeId = `temp-${Date.now()}`;

    this.syncEngine?.enqueue({
      type: 'episode_create',
      endpoint: '/episodes/create',
      projectId: this.projectId,
      payload: {
        projectId: this.projectId,
        label: trimmedName,
        branchName: branchName || 'main',
      }
    });

    this.activeEpisode = {
      id: tempEpisodeId, // This will be reconciled on backend
      name: trimmedName,
      callCount: 0,
      changedFiles: [],
      note: '',
      branchName: branchName || 'main',
    };
    this.save();
  }

  /**
   * Enqueues an AI call log or git action to the SyncEngine.
   * Automatically injects project and episode context.
   * @param payload The data to be logged.
   */
  public enqueueCall(payload: any): void {
    if (!this.projectId || !this.activeEpisode) return;

    this.syncEngine?.enqueue({
      type: 'call',
      endpoint: '/calls/log',
      projectId: this.projectId,
      episodeId: this.activeEpisode.id,
      payload: {
        ...payload,
        projectId: this.projectId,
        episodeId: this.activeEpisode.id,
      }
    });

    this.incrementCallCount();
  }

  /**
   * Increments the call counter for the active episode and persists the state.
   */
  public incrementCallCount() {
    if (this.activeEpisode) {
      this.activeEpisode.callCount += 1;
      this.save();
    }
  }

  /**
   * Adds a file path to the list of changed files for the current episode.
   * Prevents duplicates and triggers persistence.
   * @param filePath Workspace-relative or absolute path.
   */
  public addChangedFile(filePath: string) {
    if (this.activeEpisode && !this.activeEpisode.changedFiles.includes(filePath)) {
      this.activeEpisode.changedFiles.push(filePath);
      this.save();
    }
  }

  /**
   * Updates the note or metadata for the active episode.
   * @param note The new note string.
   */
  public updateNote(note: string) {
    if (this.activeEpisode) {
      this.activeEpisode.note = note.trim();
      this.save();
    }
  }
}
