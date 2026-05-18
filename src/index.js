require('dotenv').config();
const Sentry = require('./sentry'); // Must be required before any other module
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const api = require('./routes/api');
const { requireAuth } = require('./middleware/auth');
const { requestId } = require('./middleware/requestId');
const { validateEnv } = require('./lib/envCheck');
const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');
const { auditLog } = require('./middleware/auditLog');

// Validate environment variables on boot
validateEnv();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(requestId);

// Enable CORS with restrictive options
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000', 'vscode-webview://*'],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(bodyParser.json({ limit: '1mb' }));

// Attach a small health route
app.get('/_health', (req, res) => res.json({ status: 'ok' }));

// ── Auth routes (public — no auth required) ───────────────────────────────
const { auth: firebaseAuth } = require('./firebase');

/**
 * GET /api/auth/login
 * Renders a Google Sign-In page for the VS Code extension authentication flow.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.query.callback - The URI to redirect back to (e.g., vscode://...)
 * @param {express.Response} res - The response object.
 */
app.get('/api/auth/login', async (req, res) => {
  try {
    const callbackUrl = req.query.callback;
    if (!callbackUrl) {
      return res.status(400).send('Missing callback parameter');
    }

    // Serve a page with Google Sign-In via Firebase Auth JS SDK.
    // After sign-in, the page POSTs the ID token to /api/auth/exchange
    // which verifies it, creates a custom token, and returns it.
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ContextLens — Sign In</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: radial-gradient(circle at center, #0a0e17 0%, #04060a 100%);
            color: #ffffff;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            overflow: hidden;
          }

          .glow {
            position: absolute;
            width: 600px; height: 600px;
            background: radial-gradient(circle, rgba(126,200,200,0.15) 0%, transparent 70%);
            top: 50%; left: 50%;
            transform: translate(-50%,-50%);
            pointer-events: none;
          }

          .container {
            position: relative; z-index: 1;
            background: rgba(22, 27, 34, 0.6);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            padding: 3rem 2.5rem;
            border-radius: 20px;
            border: 1px solid rgba(126,200,200,0.15);
            box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1);
            text-align: center;
            max-width: 420px;
            animation: slideUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards;
            opacity: 0; transform: translateY(20px);
          }

          @keyframes slideUp { to { opacity: 1; transform: translateY(0); } }

          .logo {
            font-size: 3rem; margin-bottom: 1.25rem; color: #7ec8c8;
            text-shadow: 0 0 20px rgba(126,200,200,0.5);
            animation: float 3s ease-in-out infinite;
          }

          @keyframes float {
            0%   { transform: translateY(0)    scale(0.95); opacity: 0.9; }
            50%  { transform: translateY(-8px) scale(1.05); opacity: 1;   }
            100% { transform: translateY(0)    scale(0.95); opacity: 0.9; }
          }

          h1 { margin-top: 0; margin-bottom: 0.75rem; font-size: 1.65rem; font-weight: 500; letter-spacing: -0.02em; }
          p  { margin-bottom: 2.25rem; color: #a1aab5; line-height: 1.6; font-size: 0.85rem; font-weight: 300; }

          .btn-google {
            display: inline-flex; align-items: center; justify-content: center; gap: 10px;
            background: #fff; color: #333; padding: 0.85rem 2rem;
            border-radius: 10px; border: none; cursor: pointer;
            font-weight: 500; font-size: 0.95rem; font-family: inherit;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          }
          .btn-google:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
          .btn-google:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
          .btn-google svg { width: 20px; height: 20px; }

          .status { margin-top: 1.5rem; font-size: 0.8rem; color: #7ec8c8; min-height: 1.5rem; }
          .error  { color: #ff6b6b; }

          .counter { font-weight: 600; color: #7ec8c8; display: inline-block; min-width: 1ch; }

          .btn-vscode {
            display: inline-flex; align-items: center; justify-content: center;
            background: linear-gradient(135deg, #4f98a3 0%, #3a757e 100%);
            color: #fff; padding: 0.85rem 2rem; border-radius: 10px;
            text-decoration: none; font-weight: 500; font-size: 0.95rem;
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 4px 15px rgba(79,152,163,0.3);
            transition: all 0.3s cubic-bezier(0.16,1,0.3,1);
          }
          .btn-vscode:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(79,152,163,0.4); }

          .hidden { display: none; }
        </style>
      </head>
      <body>
        <div class="glow"></div>
        <div class="container">
          <div class="logo">✦</div>

          <!-- Step 1: Google Sign-In -->
          <div id="signin-view">
            <h1>Sign in to ContextLens</h1>
            <p>Connect your Google account to sync AI coding sessions between VS Code and the dashboard.</p>
            <button id="btn-signin" class="btn-google" onclick="handleSignIn()">
              <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
            <div id="status" class="status"></div>
          </div>

          <!-- Step 2: Success + redirect to VS Code -->
          <div id="success-view" class="hidden">
            <h1>Authentication Successful!</h1>
            <p>You have successfully signed in to ContextLens.<br/>
            This window will automatically redirect back to VS Code in
            <span id="counter" class="counter">5</span> seconds,
            after which you may close this tab.</p>
            <a id="btn-open" class="btn-vscode" href="#">Open VS Code Now</a>
          </div>
        </div>

        <!-- Firebase Auth (compat) for client-side Google Sign-In -->
        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"><\/script>
        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"><\/script>
        <script>
          firebase.initializeApp({
            apiKey: "${process.env.FIREBASE_API_KEY}",
            authDomain: "${process.env.FIREBASE_AUTH_DOMAIN}",
            projectId: "${process.env.FIREBASE_PROJECT_ID}",
          });

          const callbackUrl = ${JSON.stringify(callbackUrl)};

          async function handleSignIn() {
            const btn = document.getElementById('btn-signin');
            const statusEl = document.getElementById('status');
            btn.disabled = true;
            statusEl.textContent = 'Opening Google Sign-In…';
            statusEl.className = 'status';

            try {
              const provider = new firebase.auth.GoogleAuthProvider();
              const result = await firebase.auth().signInWithPopup(provider);
              const user = result.user;
              const idToken = await user.getIdToken();

              statusEl.textContent = 'Creating secure session…';

              // POST the ID token to our exchange endpoint
              const resp = await fetch('/api/auth/exchange', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken }),
              });

              if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'Token exchange failed');
              }

              const data = await resp.json();
              const redirectUrl = callbackUrl
                + '?uid=' + encodeURIComponent(data.uid)
                + '&token=' + encodeURIComponent(data.customToken);

              // Show success view
              document.getElementById('signin-view').classList.add('hidden');
              document.getElementById('success-view').classList.remove('hidden');
              document.getElementById('btn-open').href = redirectUrl;

              // Countdown and auto-redirect
              let seconds = 5;
              const counterEl = document.getElementById('counter');
              const interval = setInterval(() => {
                seconds -= 1;
                if (seconds > 0) {
                  counterEl.textContent = seconds;
                } else {
                  clearInterval(interval);
                }
              }, 1000);

              setTimeout(() => {
                window.location.href = redirectUrl;
                setTimeout(() => window.close(), 1000);
              }, 5000);

            } catch (err) {
              console.error('Sign-in error:', err);
              statusEl.textContent = err.message || 'Sign-in failed. Please try again.';
              statusEl.className = 'status error';
              btn.disabled = false;
            }
          }
        <\/script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).send('Authentication failed');
  }
});

/**
 * POST /api/auth/exchange
 * Verifies a Firebase ID token and returns a custom token for the VS Code extension.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.idToken - The Firebase ID token received from client-side sign-in.
 * @param {express.Response} res - The response object.
 */
app.post('/api/auth/exchange', authLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: { message: 'Missing idToken' } });
    }

    // Verify the ID token to get the real authenticated user
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    // Create a custom token for this real user — extension will exchange it
    // for its own ID token via the Identity Toolkit REST API
    const customToken = await firebaseAuth.createCustomToken(uid);

    return res.json({ uid, customToken });
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(401).json({
      error: { message: 'Invalid token. Please sign in again.' },
    });
  }
});

// All other API routes require Firebase auth
// --- v2 Functions Setup ---
const { onRequest } = require('firebase-functions/v2/https');

// Mount routes
// We handle both /api prefix (from Hosting) and direct paths
/**
 * Middleware to handle '/api' route prefixing.
 * Normalizes requests coming through Firebase Hosting or direct paths.
 */
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace('/api', '');
    if (req.url === '') req.url = '/';
  }
  next();
});

app.use('/', requireAuth, apiLimiter, api);

// The error handler must be registered before any other error middleware and after all controllers
// Sentry google-cloud-serverless wraps the exported function, so we do not use setupExpressErrorHandler here.
/**
 * Global error handler for the Express application.
 * Logs the error and returns a standardized 500 response.
 */
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  auditLog('VALIDATION_ERROR', { error: err.message, type: 'unhandled_exception' }, req);
  if (res.headersSent) return next(err);
  return res.status(500).json({ error: { code: 'internal_error', message: 'Unexpected server error' } });
});

// Export as Firebase Function v2
/**
 * Firebase Cloud Function (v2) export for the ContextLens API.
 * Configured with 512MiB memory, 300s timeout, and CORS enabled.
 */
exports.api = Sentry.wrapHttpFunction(onRequest({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 300,
  maxInstances: 10,
  cors: true,
}, app));
