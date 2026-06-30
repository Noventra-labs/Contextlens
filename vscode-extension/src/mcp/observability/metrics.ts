/**
 * MCP Metrics Collector
 *
 * Tracks: active clients, calls/day, tool usage, latency, failure rate.
 */

export interface MetricsSummary {
  activeClients: number;
  totalCalls: number;
  callsToday: number;
  toolUsage: Record<string, number>;
  avgLatencyMs: number;
  failureRate: number;
  uptime: number;
}

interface CallRecord {
  timestamp: number;
  tool: string;
  client: string;
  durationMs: number;
  success: boolean;
}

export class MetricsCollector {
  private static instance: MetricsCollector;
  private calls: CallRecord[] = [];
  private startTime: number;
  private activeClients: Set<string> = new Set();
  private maxRecords = 5000;

  private constructor() {
    this.startTime = Date.now();
  }

  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /**
   * Record a tool call.
   */
  recordCall(tool: string, client: string, durationMs: number, success: boolean): void {
    this.activeClients.add(client);
    this.calls.push({
      timestamp: Date.now(),
      tool,
      client,
      durationMs,
      success,
    });

    if (this.calls.length > this.maxRecords) {
      this.calls = this.calls.slice(-this.maxRecords);
    }
  }

  /**
   * Get metrics summary.
   */
  getSummary(): MetricsSummary {
    const now = Date.now();
    const dayAgo = now - 24 * 60 * 60 * 1000;
    const todayCalls = this.calls.filter(c => c.timestamp > dayAgo);

    // Tool usage
    const toolUsage: Record<string, number> = {};
    for (const call of this.calls) {
      toolUsage[call.tool] = (toolUsage[call.tool] || 0) + 1;
    }

    // Avg latency
    const totalLatency = this.calls.reduce((sum, c) => sum + c.durationMs, 0);
    const avgLatency = this.calls.length > 0 ? Math.round(totalLatency / this.calls.length) : 0;

    // Failure rate
    const failures = this.calls.filter(c => !c.success).length;
    const failureRate = this.calls.length > 0 ? failures / this.calls.length : 0;

    return {
      activeClients: this.activeClients.size,
      totalCalls: this.calls.length,
      callsToday: todayCalls.length,
      toolUsage,
      avgLatencyMs: avgLatency,
      failureRate: Math.round(failureRate * 1000) / 1000,
      uptime: now - this.startTime,
    };
  }

  /**
   * Get per-tool latency stats.
   */
  getToolLatency(): Record<string, { avg: number; p95: number; max: number }> {
    const byTool: Record<string, number[]> = {};
    for (const call of this.calls) {
      if (!byTool[call.tool]) byTool[call.tool] = [];
      byTool[call.tool].push(call.durationMs);
    }

    const result: Record<string, { avg: number; p95: number; max: number }> = {};
    for (const [tool, durations] of Object.entries(byTool)) {
      durations.sort((a, b) => a - b);
      const avg = Math.round(durations.reduce((s, d) => s + d, 0) / durations.length);
      const p95Index = Math.floor(durations.length * 0.95);
      result[tool] = {
        avg,
        p95: durations[p95Index] || durations[durations.length - 1],
        max: durations[durations.length - 1],
      };
    }
    return result;
  }

  /**
   * Reset metrics.
   */
  reset(): void {
    this.calls = [];
    this.activeClients.clear();
    this.startTime = Date.now();
  }
}
