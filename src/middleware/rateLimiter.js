const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

/**
 * Rate limiter for general API endpoints.
 * Allows 100 requests per 15-minute window per user (or IP if unauthenticated).
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests right now. Trying again shortly.',
      retryable: true,
      action: 'retry',
    },
  },
  keyGenerator: (req, res) => req.user?.uid || ipKeyGenerator(req, res),
});

/**
 * Stricter rate limiter for authentication endpoints.
 * Allows 10 requests per 15-minute window per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many authentication attempts. Please try again later.',
      retryable: true,
      action: 'retry',
    },
  },
});

/**
 * Rate limiter for AI-calling endpoints (expensive operations).
 * Allows 30 requests per 15-minute window per user.
 */
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      message: 'AI request quota exceeded. Please try again later.',
      retryable: true,
      action: 'retry',
    },
  },
  keyGenerator: (req, res) => req.user?.uid || ipKeyGenerator(req, res),
});

module.exports = { apiLimiter, authLimiter, aiLimiter };
