const { requireAuth } = require('../../middleware/auth');

jest.mock('../../firebase', () => ({
  auth: {
    verifyIdToken: jest.fn(),
  },
}));

const { auth } = require('../../firebase');

describe('Auth Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      headers: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('requireAuth', () => {
    it('should call next() when token is valid', async () => {
      const decodedToken = {
        uid: 'user123',
        email: 'user@example.com',
        name: 'Test User',
      };

      auth.verifyIdToken.mockResolvedValue(decodedToken);
      req.headers.authorization = 'Bearer valid_token';

      await requireAuth(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user).toEqual({
        uid: 'user123',
        email: 'user@example.com',
        name: 'Test User',
      });
    });

    it('should handle missing authorization header', async () => {
      req.headers.authorization = '';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'No authorization token provided. Please sign in.',
          retryable: false,
          requestId: null,
          action: 'login',
          details: null,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle missing authorization header (undefined)', async () => {
      delete req.headers.authorization;

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'No authorization token provided. Please sign in.',
          retryable: false,
          requestId: null,
          action: 'login',
          details: null,
        },
      });
    });

    it('should reject non-Bearer tokens', async () => {
      req.headers.authorization = 'Basic dXNlcjpwYXNz';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle malformed Bearer header', async () => {
      req.headers.authorization = 'Bearer ';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Malformed authorization header.',
          retryable: false,
          requestId: null,
          action: 'login',
          details: null,
        },
      });
    });

    it('should handle invalid token', async () => {
      const error = new Error('Invalid ID token');
      error.code = 'auth/invalid-id-token';
      auth.verifyIdToken.mockRejectedValue(error);
      req.headers.authorization = 'Bearer invalid_token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: 'AUTH_ERROR',
          message: 'Invalid or expired token. Please sign in again.',
          retryable: false,
          requestId: null,
          action: 'login',
          details: null,
        },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should handle expired token', async () => {
      const error = new Error('Firebase ID token has expired');
      error.code = 'auth/id-token-expired';
      auth.verifyIdToken.mockRejectedValue(error);
      req.headers.authorization = 'Bearer expired_token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        ok: false,
        error: {
          code: 'AUTH_EXPIRED',
          message: 'Session expired. Sign in again to continue syncing.',
          retryable: false,
          requestId: null,
          action: 'login',
          details: null,
        },
      });
    });

    it('should set user with email and name when available', async () => {
      const decodedToken = {
        uid: 'user456',
        email: 'alice@example.com',
        name: 'Alice',
      };

      auth.verifyIdToken.mockResolvedValue(decodedToken);
      req.headers.authorization = 'Bearer token';

      await requireAuth(req, res, next);

      expect(req.user).toEqual({
        uid: 'user456',
        email: 'alice@example.com',
        name: 'Alice',
      });
    });

    it('should set user with null email and name when not provided', async () => {
      const decodedToken = {
        uid: 'user789',
      };

      auth.verifyIdToken.mockResolvedValue(decodedToken);
      req.headers.authorization = 'Bearer token';

      await requireAuth(req, res, next);

      expect(req.user).toEqual({
        uid: 'user789',
        email: null,
        name: null,
      });
    });

    it('should handle general errors in verification', async () => {
      const error = new Error('Unknown error');
      auth.verifyIdToken.mockRejectedValue(error);
      req.headers.authorization = 'Bearer token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
    });

    it('should handle unexpected middleware errors', async () => {
      const error = new Error('Unexpected error');
      auth.verifyIdToken.mockImplementation(() => {
        throw error;
      });
      req.headers.authorization = 'Bearer token';

      await requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      const callArgs = res.json.mock.calls[0][0];
      expect(callArgs.error.code).toBe('AUTH_ERROR');
    });
  });
});
