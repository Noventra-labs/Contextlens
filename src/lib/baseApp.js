const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const { requestId } = require('../middleware/requestId');
const { auditLog } = require('../middleware/auditLog');
const { mapError, typedError } = require('./errors');

function createBaseApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "script-src": ["'self'", "'unsafe-inline'", "https://www.gstatic.com", "https://apis.google.com"],
        "script-src-attr": ["'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "https://frontend-cdn.perplexity.ai"],
        "connect-src": ["'self'", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com", "https://www.googleapis.com", "https://www.gstatic.com"],
        "frame-src": ["'self'", "https://contextlens-backend-001.firebaseapp.com", "https://*.firebaseapp.com", "https://apis.google.com"],
        "img-src": ["'self'", "data:", "https://www.gstatic.com"],
      },
    },
  }));
  app.use(requestId);

  const corsOptions = {
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'vscode-webview://*'],
    optionsSuccessStatus: 200
  };
  app.use(cors(corsOptions));

  if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        console.log(JSON.stringify({
          severity: res.statusCode >= 500 ? 'ERROR' : res.statusCode >= 400 ? 'WARNING' : 'INFO',
          event: 'http_request',
          requestId: req.id,
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          latencyMs: Date.now() - start,
          uid: req.user?.uid || null,
          ip: req.ip,
          userAgent: req.headers['user-agent'],
        }));
      });
      next();
    });
  } else {
    app.use(morgan('dev'));
  }

  app.use(bodyParser.json({ limit: '1mb' }));
  
  app.get('/_health', (req, res) => res.json({ status: 'ok' }));

  // Normalize /api prefix if present
  app.use((req, res, next) => {
    if (req.url.startsWith('/api')) {
      req.url = req.url.replace('/api', '');
      if (req.url === '') req.url = '/';
    }
    next();
  });

  return app;
}

function registerErrorHandler(app) {
  app.use((err, req, res, next) => {
    console.error(JSON.stringify({
      severity: 'ERROR',
      event: 'unhandled_server_error',
      requestId: req.id,
      uid: req.user?.uid || null,
      route: req.originalUrl,
      errorMessage: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    }));

    auditLog('VALIDATION_ERROR', { error: err.message, type: 'unhandled_exception' }, req);

    if (res.headersSent) return next(err);

    const mapped = mapError(err, req.id);
    return res.status(mapped.status).json(
      typedError(mapped.code, mapped.message, {
        requestId: req.id,
        retryable: mapped.retryable,
      })
    );
  });
}

module.exports = { createBaseApp, registerErrorHandler };
