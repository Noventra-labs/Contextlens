const { auth } = require('../firebase');
const { ErrorCodes, typedError } = require('../lib/errors');

/**
 * Auth middleware — production-ready.
 *
 * Behavior:
 *   - Requires a valid Firebase ID token in the Authorization header.
 *   - Extracts the real UID from the verified token.
 *   - Returns 401 for missing, invalid, or expired tokens.
 *   - NEVER leaks Firebase error messages, token contents, or stack traces.
 *
 * Note: The VS Code extension must send the Firebase ID token
 * (obtained after signInWithCustomToken), NOT the custom token itself.
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json(
        typedError(ErrorCodes.AUTH_ERROR, 'No authorization token provided. Please sign in.', {
          requestId: req.id,
          action: 'login',
        })
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      console.error(JSON.stringify({
        severity: 'WARNING',
        event: 'auth_missing_token',
        requestId: req.id,
      }));
      return res.status(401).json(
        typedError(ErrorCodes.AUTH_ERROR, 'Malformed authorization header.', {
          requestId: req.id,
          action: 'login',
        })
      );
    }

    try {
      const decoded = await auth.verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email || null,
        name: decoded.name || null,
      };
    } catch (verifyErr) {
      // Log internal details privately — never expose to client
      console.error(JSON.stringify({
        severity: 'WARNING',
        event: 'auth_token_verification_failed',
        requestId: req.id,
        errorCode: verifyErr.code,
        errorMessage: verifyErr.message,
      }));

      const isExpired = /expired/i.test(verifyErr.code || verifyErr.message || '');
      const code = isExpired ? ErrorCodes.AUTH_EXPIRED : ErrorCodes.AUTH_ERROR;
      const message = isExpired
        ? 'Session expired. Sign in again to continue syncing.'
        : 'Invalid or expired token. Please sign in again.';

      return res.status(401).json(
        typedError(code, message, { requestId: req.id, action: 'login' })
      );
    }

    return next();
  } catch (err) {
    console.error(JSON.stringify({
      severity: 'ERROR',
      event: 'auth_middleware_error',
      requestId: req.id,
      errorMessage: err.message,
    }));
    return res.status(401).json(
      typedError(ErrorCodes.AUTH_ERROR, 'Authentication failed. Please sign in again.', {
        requestId: req.id,
        action: 'login',
      })
    );
  }
}

module.exports = { requireAuth };
