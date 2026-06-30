/**
 * MCP Session Manager
 *
 * Tracks the current MCP session state: workspace, project,
 * active episode, tool call history, and connected clients.
 */

export interface ToolCallRecord {
  toolName: string;
  clientId: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface SessionState {
  sessionId: string;
  startedAt: number;
  workspace: string | null;
  projectId: string | null;
  activeEpisodeId: string | null;
  connectedClients: string[];
  toolCallCount: number;
  lastActivity: number;
}

export class SessionManager {
  private static instance: SessionManager;
  private sessionId: string;
  private startedAt: number;
  private toolHistory: ToolCallRecord[] = [];
  private maxHistory = 500;
  private connectedClients: Set<string> = new Set();
  private lastActivity: number;

  private constructor() {
    this.sessionId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.startedAt = Date.now();
    this.lastActivity = Date.now();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Record a tool call.
   */
  recordToolCall(
    toolName: string,
    clientId: string,
    durationMs: number,
    success: boolean,
    error?: string
  ): void {
    this.lastActivity = Date.now();
    this.connectedClients.add(clientId);

    this.toolHistory.push({
      toolName,
      clientId,
      timestamp: Date.now(),
      durationMs,
      success,
      error,
    });

    if (this.toolHistory.length > this.maxHistory) {
      this.toolHistory = this.toolHistory.slice(-this.maxHistory);
    }
  }

  /**
   * Get current session state.
   */
  getState(workspace?: string | null, projectId?: string | null, episodeId?: string | null): SessionState {
    return {
      sessionId: this.sessionId,
      startedAt: this.startedAt,
      workspace: workspace || null,
      projectId: projectId || null,
      activeEpisodeId: episodeId || null,
      connectedClients: Array.from(this.connectedClients),
      toolCallCount: this.toolHistory.length,
      lastActivity: this.lastActivity,
    };
  }

  /**
   * Get tool call history.
   */
  getToolHistory(limit: number = 50): ToolCallRecord[] {
    return this.toolHistory.slice(-limit);
  }

  /**
   * Get tool usage statistics.
   */
  getToolStats(): Record<string, { count: number; avgDurationMs: number; errorRate: number }> {
    const stats: Record<string, { count: number; totalDuration: number; errors: number }> = {};

    for (const call of this.toolHistory) {
      if (!stats[call.toolName]) {
        stats[call.toolName] = { count: 0, totalDuration: 0, errors: 0 };
      }
      stats[call.toolName].count++;
      stats[call.toolName].totalDuration += call.durationMs;
      if (!call.success) stats[call.toolName].errors++;
    }

    const result: Record<string, { count: number; avgDurationMs: number; errorRate: number }> = {};
    for (const [name, s] of Object.entries(stats)) {
      result[name] = {
        count: s.count,
        avgDurationMs: Math.round(s.totalDuration / s.count),
        errorRate: s.count > 0 ? s.errors / s.count : 0,
      };
    }
    return result;
  }

  /**
   * Get session uptime in milliseconds.
   */
  getUptime(): number {
    return Date.now() - this.startedAt;
  }
}
