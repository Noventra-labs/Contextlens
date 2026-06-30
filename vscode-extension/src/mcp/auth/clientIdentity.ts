/**
 * MCP Client Identity Tracker
 *
 * Tracks which AI clients connect to ContextLens MCP,
 * their versions, and connection history.
 */

export interface ClientInfo {
  /** Client type identifier */
  clientId: string;
  /** Client display name */
  displayName: string;
  /** Client version (if reported) */
  version: string;
  /** Timestamp of first connection */
  firstSeen: number;
  /** Timestamp of most recent connection */
  lastSeen: number;
  /** Total number of tool calls from this client */
  callCount: number;
}

/** Known client identifiers and their display names */
const KNOWN_CLIENTS: Record<string, string> = {
  'claude-desktop': 'Claude Desktop',
  'cursor': 'Cursor',
  'antigravity': 'Antigravity IDE',
  'vscode-agent': 'VS Code Agent',
  'gemini-cli': 'Gemini CLI',
  'openai-agents': 'OpenAI Agents SDK',
  'unknown': 'Unknown Client',
};

export class ClientIdentityTracker {
  private clients: Map<string, ClientInfo> = new Map();

  /**
   * Record a connection from a client.
   * Extracts client identity from headers or MCP initialize params.
   */
  recordConnection(clientId: string, version?: string): ClientInfo {
    const id = clientId || 'unknown';
    const now = Date.now();

    const existing = this.clients.get(id);
    if (existing) {
      existing.lastSeen = now;
      existing.callCount++;
      if (version) existing.version = version;
      return existing;
    }

    const info: ClientInfo = {
      clientId: id,
      displayName: KNOWN_CLIENTS[id] || id,
      version: version || 'unknown',
      firstSeen: now,
      lastSeen: now,
      callCount: 1,
    };
    this.clients.set(id, info);
    return info;
  }

  /**
   * Parse client identity from HTTP headers.
   */
  parseFromHeaders(headers: Record<string, string | string[] | undefined>): { clientId: string; version: string } {
    const clientHeader = (headers['x-mcp-client'] as string) || '';
    const userAgent = (headers['user-agent'] as string) || '';

    // Check explicit client header first
    if (clientHeader) {
      const parts = clientHeader.split('/');
      return {
        clientId: parts[0] || 'unknown',
        version: parts[1] || 'unknown',
      };
    }

    // Try to infer from User-Agent
    if (userAgent.includes('Claude')) return { clientId: 'claude-desktop', version: 'unknown' };
    if (userAgent.includes('Cursor')) return { clientId: 'cursor', version: 'unknown' };
    if (userAgent.includes('Antigravity')) return { clientId: 'antigravity', version: 'unknown' };

    return { clientId: 'unknown', version: 'unknown' };
  }

  /**
   * Get all tracked clients.
   */
  getClients(): ClientInfo[] {
    return Array.from(this.clients.values());
  }

  /**
   * Get a specific client's info.
   */
  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get count of unique clients that have connected.
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get currently active clients (seen within last 5 minutes).
   */
  getActiveClients(): ClientInfo[] {
    const cutoff = Date.now() - 5 * 60 * 1000;
    return Array.from(this.clients.values()).filter(c => c.lastSeen > cutoff);
  }
}
