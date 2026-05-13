/**
 * Creates a standardized error response object.
 * 
 * @param {string} code - The error code (e.g., 'not_found').
 * @param {string} message - The human-readable error message.
 * @param {Object} [details] - Optional extra details about the error.
 * @returns {Object} The formatted error response.
 */
function typedError(code, message, details) {
  return {
    error: {
      code,
      message,
      details: details || null,
    },
  };
}

/**
 * Maps a generic error or message to a standardized error response with status code.
 * 
 * @param {Error|Object} err - The error to map.
 * @returns {Object} An object containing status, code, and message.
 */
function mapError(err) {
  const message = err && err.message ? err.message : 'Unknown error';
  if (/unauthenticated/i.test(message)) return { status: 401, code: 'unauthenticated', message };
  if (/permission/i.test(message)) return { status: 403, code: 'forbidden', message };
  if (/not[_ -]?found|missing/i.test(message)) return { status: 404, code: 'not_found', message };
  if (/timeout/i.test(message)) return { status: 504, code: 'model_timeout', message };
  if (/quota/i.test(message)) return { status: 429, code: 'quota_exceeded', message };
  return { status: 500, code: 'internal_error', message };
}

module.exports = { typedError, mapError };
