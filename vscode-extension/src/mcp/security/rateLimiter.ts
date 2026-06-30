/**
 * MCP Rate Limiter
 *
 * Token bucket algorithm with per-client limits and burst protection.
 * Expensive operations (explain-diff, AI calls) get separate lower limits.
 */

export interface RateLimitConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Max burst size (above steady-state rate) */
  burstLimit: number;
}

interface ClientBucket {
  tokens: number;
  lastRefill: number;
  windowStart: number;
  requestCount: number;
}

/** Default rate limits */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 120,
  windowMs: 60 * 1000, // 1 minute
  burstLimit: 20,
};

/** Stricter limits for expensive operations */
const EXPENSIVE_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60 * 1000,
  burstLimit: 3,
};

/** Tools classified as expensive */
const EXPENSIVE_TOOLS = new Set([
  'explain_diff',
  'explain_past_changes',
  'search_context',
]);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
  limit: number;
}

export class RateLimiter {
  private buckets: Map<string, ClientBucket> = new Map();
  private expensiveBuckets: Map<string, ClientBucket> = new Map();
  private config: RateLimitConfig;
  private expensiveConfig: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>, expensiveConfig?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.expensiveConfig = { ...EXPENSIVE_CONFIG, ...expensiveConfig };
  }

  /**
   * Check if a request is allowed. Returns remaining quota info.
   */
  checkLimit(clientId: string, toolName?: string): RateLimitResult {
    const isExpensive = toolName && EXPENSIVE_TOOLS.has(toolName);
    const cfg = isExpensive ? this.expensiveConfig : this.config;
    const bucketMap = isExpensive ? this.expensiveBuckets : this.buckets;
    const bucketKey = `${clientId}:${isExpensive ? 'expensive' : 'standard'}`;

    let bucket = bucketMap.get(bucketKey);
    const now = Date.now();

    if (!bucket) {
      bucket = {
        tokens: cfg.maxRequests,
        lastRefill: now,
        windowStart: now,
        requestCount: 0,
      };
      bucketMap.set(bucketKey, bucket);
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    const refillRate = cfg.maxRequests / cfg.windowMs;
    const refillTokens = elapsed * refillRate;
    bucket.tokens = Math.min(cfg.maxRequests + cfg.burstLimit, bucket.tokens + refillTokens);
    bucket.lastRefill = now;

    // Reset window if expired
    if (now - bucket.windowStart >= cfg.windowMs) {
      bucket.windowStart = now;
      bucket.requestCount = 0;
    }

    // Check if request allowed
    if (bucket.tokens < 1) {
      const retryAfterMs = Math.ceil((1 - bucket.tokens) / refillRate);
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs,
        limit: cfg.maxRequests,
      };
    }

    // Consume a token
    bucket.tokens -= 1;
    bucket.requestCount += 1;

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      limit: cfg.maxRequests,
    };
  }

  /**
   * Check if a tool is classified as expensive.
   */
  isExpensiveTool(toolName: string): boolean {
    return EXPENSIVE_TOOLS.has(toolName);
  }

  /**
   * Reset rate limits for a specific client.
   */
  resetClient(clientId: string): void {
    for (const [key] of this.buckets) {
      if (key.startsWith(`${clientId}:`)) {
        this.buckets.delete(key);
      }
    }
    for (const [key] of this.expensiveBuckets) {
      if (key.startsWith(`${clientId}:`)) {
        this.expensiveBuckets.delete(key);
      }
    }
  }

  /**
   * Reset all rate limits.
   */
  resetAll(): void {
    this.buckets.clear();
    this.expensiveBuckets.clear();
  }
}
