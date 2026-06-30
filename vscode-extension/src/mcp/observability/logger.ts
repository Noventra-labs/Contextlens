/**
 * MCP Structured Logger
 *
 * Captures: tool, client, duration, errors, timestamp.
 * Structured JSON format for analysis.
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  tool?: string;
  client?: string;
  durationMs?: number;
  error?: string;
  metadata?: Record<string, any>;
}

export class McpLogger {
  private static instance: McpLogger;
  private logs: LogEntry[] = [];
  private maxLogs = 1000;
  private minLevel: LogLevel = LogLevel.INFO;

  private static readonly LEVEL_ORDER: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
  };

  private constructor() {}

  static getInstance(): McpLogger {
    if (!McpLogger.instance) {
      McpLogger.instance = new McpLogger();
    }
    return McpLogger.instance;
  }

  /**
   * Set minimum log level.
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /**
   * Log a tool call.
   */
  logToolCall(tool: string, client: string, durationMs: number, success: boolean, error?: string): void {
    this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      component: 'tools',
      message: success ? `Tool '${tool}' completed` : `Tool '${tool}' failed`,
      tool,
      client,
      durationMs,
      error,
    });
  }

  /**
   * Log a request.
   */
  logRequest(method: string, path: string, client: string, statusCode: number, durationMs: number): void {
    this.log({
      level: statusCode >= 400 ? LogLevel.WARN : LogLevel.INFO,
      component: 'http',
      message: `${method} ${path} → ${statusCode}`,
      client,
      durationMs,
      metadata: { method, path, statusCode },
    });
  }

  /**
   * Log security event.
   */
  logSecurity(event: string, client: string, details?: Record<string, any>): void {
    this.log({
      level: LogLevel.WARN,
      component: 'security',
      message: event,
      client,
      metadata: details,
    });
  }

  /**
   * Generic log method.
   */
  log(entry: Omit<LogEntry, 'timestamp'>): void {
    const levelOrder = McpLogger.LEVEL_ORDER[entry.level];
    const minOrder = McpLogger.LEVEL_ORDER[this.minLevel];
    if (levelOrder < minOrder) return;

    const fullEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };

    this.logs.push(fullEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Also output to stderr for VS Code output channel
    const prefix = `[ContextLens MCP] [${entry.level.toUpperCase()}]`;
    if (entry.level === LogLevel.ERROR) {
      console.error(`${prefix} ${entry.message}`, entry.error || '');
    } else {
      console.log(`${prefix} ${entry.message}`);
    }
  }

  /**
   * Query logs.
   */
  query(options?: {
    level?: LogLevel;
    component?: string;
    tool?: string;
    client?: string;
    since?: number;
    limit?: number;
  }): LogEntry[] {
    let result = this.logs;

    if (options?.level) {
      result = result.filter(l => l.level === options.level);
    }
    if (options?.component) {
      result = result.filter(l => l.component === options.component);
    }
    if (options?.tool) {
      result = result.filter(l => l.tool === options.tool);
    }
    if (options?.client) {
      result = result.filter(l => l.client === options.client);
    }
    if (options?.since) {
      const sinceDate = new Date(options.since).toISOString();
      result = result.filter(l => l.timestamp >= sinceDate);
    }

    return result.slice(-(options?.limit || 100));
  }

  /**
   * Get log count.
   */
  get size(): number {
    return this.logs.length;
  }

  /**
   * Clear all logs.
   */
  clear(): void {
    this.logs = [];
  }
}
