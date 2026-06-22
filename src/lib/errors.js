/**
 * ContextLens — Canonical Error Handling
 *
 * Every error flows through the same pipeline:
 * 1. Detect → 2. Classify → 3. Attach machine code + safe message
 * 4. Log internal details privately → 5. Return clean response
 *
 * NEVER expose stack traces, raw tokens, internal payloads, or Firebase
 * internals to the client.
 */

// ── Canonical Error Codes ──────────────────────────────────────────────────

const ErrorCodes = {
  AUTH_ERROR: 'AUTH_ERROR',
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  NETWORK_OFFLINE: 'NETWORK_OFFLINE',
  NETWORK_TIMEOUT: 'NETWORK_TIMEOUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CONFLICT_ERROR: 'CONFLICT_ERROR',
  DUPLICATE_EVENT: 'DUPLICATE_EVENT',
  STORAGE_WRITE_FAILED: 'STORAGE_WRITE_FAILED',
  AI_SERVICE_UNAVAILABLE: 'AI_SERVICE_UNAVAILABLE',
  AI_RESPONSE_INVALID: 'AI_RESPONSE_INVALID',
  FIRESTORE_ERROR: 'FIRESTORE_ERROR',
  CONFIG_ERROR: 'CONFIG_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

// ── Safe User Messages (never leak internals) ─────────────────────────────

const SAFE_MESSAGES = {
  [ErrorCodes.AUTH_ERROR]: 'Authentication failed. Please sign in again.',
  [ErrorCodes.AUTH_EXPIRED]: 'Session expired. Sign in again to continue syncing.',
  [ErrorCodes.NETWORK_OFFLINE]: "You're offline. Changes are saved locally and will sync automatically.",
  [ErrorCodes.NETWORK_TIMEOUT]: 'Request timed out. Please try again.',
  [ErrorCodes.VALIDATION_ERROR]: 'Some data was incomplete and could not be processed.',
  [ErrorCodes.PERMISSION_DENIED]: "You don't have permission to access this resource.",
  [ErrorCodes.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
  [ErrorCodes.RATE_LIMITED]: 'Too many requests right now. Trying again shortly.',
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 'Request payload is too large. Please reduce the data size.',
  [ErrorCodes.CONFLICT_ERROR]: 'A conflict occurred. Please refresh and try again.',
  [ErrorCodes.DUPLICATE_EVENT]: 'Repeated event skipped to avoid duplicate logs.',
  [ErrorCodes.STORAGE_WRITE_FAILED]: 'Failed to save data. Please try again.',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'AI summary is temporarily unavailable. Your work is still saved.',
  [ErrorCodes.AI_RESPONSE_INVALID]: 'AI returned an unexpected response. Your data is safe.',
  [ErrorCodes.FIRESTORE_ERROR]: 'Cloud storage is temporarily unavailable. Retrying automatically.',
  [ErrorCodes.CONFIG_ERROR]: 'Server configuration error. Please contact support.',
  [ErrorCodes.INTERNAL_ERROR]: 'Unexpected server error. Please try again later.',
};

// ── HTTP Status Code Mapping ───────────────────────────────────────────────

const STATUS_MAP = {
  [ErrorCodes.AUTH_ERROR]: 401,
  [ErrorCodes.AUTH_EXPIRED]: 401,
  [ErrorCodes.VALIDATION_ERROR]: 400,
  [ErrorCodes.PERMISSION_DENIED]: 403,
  [ErrorCodes.RESOURCE_NOT_FOUND]: 404,
  [ErrorCodes.RATE_LIMITED]: 429,
  [ErrorCodes.PAYLOAD_TOO_LARGE]: 413,
  [ErrorCodes.CONFLICT_ERROR]: 409,
  [ErrorCodes.DUPLICATE_EVENT]: 409,
  [ErrorCodes.STORAGE_WRITE_FAILED]: 500,
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 503,
  [ErrorCodes.AI_RESPONSE_INVALID]: 502,
  [ErrorCodes.FIRESTORE_ERROR]: 503,
  [ErrorCodes.NETWORK_TIMEOUT]: 504,
  [ErrorCodes.CONFIG_ERROR]: 500,
  [ErrorCodes.INTERNAL_ERROR]: 500,
};

// ── Retryable Codes ────────────────────────────────────────────────────────

const RETRYABLE_CODES = new Set([
  ErrorCodes.NETWORK_OFFLINE,
  ErrorCodes.NETWORK_TIMEOUT,
  ErrorCodes.RATE_LIMITED,
  ErrorCodes.STORAGE_WRITE_FAILED,
  ErrorCodes.AI_SERVICE_UNAVAILABLE,
  ErrorCodes.FIRESTORE_ERROR,
]);

// ── Action Hints ───────────────────────────────────────────────────────────

const ACTION_MAP = {
  [ErrorCodes.AUTH_ERROR]: 'login',
  [ErrorCodes.AUTH_EXPIRED]: 'login',
  [ErrorCodes.RATE_LIMITED]: 'retry',
  [ErrorCodes.NETWORK_OFFLINE]: 'retry',
  [ErrorCodes.NETWORK_TIMEOUT]: 'retry',
  [ErrorCodes.STORAGE_WRITE_FAILED]: 'retry',
  [ErrorCodes.AI_SERVICE_UNAVAILABLE]: 'retry',
  [ErrorCodes.FIRESTORE_ERROR]: 'retry',
};

// ── AppError Class ─────────────────────────────────────────────────────────

/**
 * Structured application error.
 * Use `createAppError()` factory for convenience.
 */
class AppError extends Error {
  /**
   * @param {string} code - Canonical error code from ErrorCodes.
   * @param {string} devMessage - Internal diagnostic message (never sent to client).
   * @param {Object} [options]
   * @param {string} [options.userMessage] - Override the default safe message.
   * @param {'info'|'warning'|'error'|'critical'} [options.severity]
   * @param {boolean} [options.retryable] - Override retryable default.
   * @param {Object} [options.details] - Extra structured details for logging.
   */
  constructor(code, devMessage, options = {}) {
    super(devMessage);
    this.name = 'AppError';
    this.code = code;
    this.devMessage = devMessage;
    this.userMessage = options.userMessage || SAFE_MESSAGES[code] || SAFE_MESSAGES[ErrorCodes.INTERNAL_ERROR];
    this.severity = options.severity || (STATUS_MAP[code] >= 500 ? 'error' : 'warning');
    this.retryable = options.retryable !== undefined ? options.retryable : RETRYABLE_CODES.has(code);
    this.action = ACTION_MAP[code] || 'none';
    this.status = STATUS_MAP[code] || 500;
    this.details = options.details || null;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Factory to create an AppError.
 *
 * @param {string} code - Canonical error code.
 * @param {string} devMessage - Internal diagnostic message.
 * @param {Object} [options] - See AppError constructor.
 * @returns {AppError}
 */
function createAppError(code, devMessage, options) {
  return new AppError(code, devMessage, options);
}

// ── Error Response Formatter ───────────────────────────────────────────────

/**
 * Creates a standardized API error response object.
 * This is what gets sent to the client — NEVER includes internal details.
 *
 * @param {string} code - Error code.
 * @param {string} message - User-safe message.
 * @param {Object} [options]
 * @param {string} [options.requestId] - Request trace ID.
 * @param {boolean} [options.retryable] - Whether client should retry.
 * @param {string} [options.action] - Suggested action.
 * @param {Array} [options.details] - Validation error details (safe).
 * @returns {Object} Formatted { ok, error } response.
 */
function typedError(code, message, options = {}) {
  return {
    ok: false,
    error: {
      code,
      message,
      retryable: options.retryable !== undefined ? options.retryable : RETRYABLE_CODES.has(code),
      requestId: options.requestId || null,
      action: options.action || ACTION_MAP[code] || 'none',
      details: options.details || null,
    },
  };
}

/**
 * Maps a raw error to a safe, structured response.
 * Classifies by error message patterns — NEVER leaks the original message.
 *
 * @param {Error|Object} err - The raw error.
 * @param {string} [requestId] - Request trace ID.
 * @returns {{ status: number, code: string, message: string, retryable: boolean, action: string }}
 */
function mapError(err, requestId) {
  const raw = err && err.message ? err.message : '';

  // Already an AppError — use it directly
  if (err instanceof AppError) {
    return {
      status: err.status,
      code: err.code,
      message: err.userMessage,
      retryable: err.retryable,
      action: err.action,
      requestId: requestId || null,
    };
  }

  // Pattern matching → canonical code
  let code = ErrorCodes.INTERNAL_ERROR;

  if (/unauthenticated|auth\/.*invalid/i.test(raw)) {
    code = ErrorCodes.AUTH_ERROR;
  } else if (/expired|auth\/id-token-expired/i.test(raw)) {
    code = ErrorCodes.AUTH_EXPIRED;
  } else if (/permission|forbidden/i.test(raw)) {
    code = ErrorCodes.PERMISSION_DENIED;
  } else if (/not[_ -]?found|no such document|episode_not_found|file missing/i.test(raw)) {
    code = ErrorCodes.RESOURCE_NOT_FOUND;
  } else if (/timeout|timed?\s*out|model_timeout/i.test(raw)) {
    code = ErrorCodes.NETWORK_TIMEOUT;
  } else if (/quota|rate.?limit|429|too many/i.test(raw)) {
    code = ErrorCodes.RATE_LIMITED;
  } else if (/payload.*large|413|too large/i.test(raw)) {
    code = ErrorCodes.PAYLOAD_TOO_LARGE;
  } else if (/duplicate|idempotency|already exists/i.test(raw)) {
    code = ErrorCodes.DUPLICATE_EVENT;
  } else if (/firestore|datastore|UNAVAILABLE|503/i.test(raw)) {
    code = ErrorCodes.FIRESTORE_ERROR;
  } else if (/missing_api_key|ai.*unavailable|model.*error/i.test(raw)) {
    code = ErrorCodes.AI_SERVICE_UNAVAILABLE;
  } else if (/missing.*config|invalid.*config/i.test(raw)) {
    code = ErrorCodes.CONFIG_ERROR;
  } else if (/conflict/i.test(raw)) {
    code = ErrorCodes.CONFLICT_ERROR;
  } else if (/validation|invalid|required/i.test(raw)) {
    code = ErrorCodes.VALIDATION_ERROR;
  }

  return {
    status: STATUS_MAP[code] || 500,
    code,
    message: SAFE_MESSAGES[code],
    retryable: RETRYABLE_CODES.has(code),
    action: ACTION_MAP[code] || 'none',
    requestId: requestId || null,
  };
}

module.exports = {
  ErrorCodes,
  AppError,
  createAppError,
  typedError,
  mapError,
  SAFE_MESSAGES,
};
