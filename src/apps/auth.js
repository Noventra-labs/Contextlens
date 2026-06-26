const { createBaseApp, registerErrorHandler } = require('../lib/baseApp');
const { auth: firebaseAuth } = require('../firebase');
const { defineString } = require('firebase-functions/params');
const { authLimiter, apiLimiter } = require('../middleware/rateLimiter');

const clientApiKey = defineString('CLIENT_FIREBASE_API_KEY');
const clientAuthDomain = defineString('CLIENT_FIREBASE_AUTH_DOMAIN');
const clientProjectId = defineString('CLIENT_FIREBASE_PROJECT_ID');

const app = createBaseApp();

/**
 * GET /auth/login
 * Renders a Google Sign-In page for the VS Code extension authentication flow.
 */
app.get('/auth/login', async (req, res) => {
  try {
    const callbackUrl = req.query.callback;
    if (!callbackUrl) {
      return res.status(400).send('Missing callback parameter');
    }

    // Serve a page with Google Sign-In via Firebase Auth JS SDK.
    // After sign-in, the page POSTs the ID token to /api/auth/exchange
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ContextLens — Sign In</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #08090c;
            color: #f3f4f6;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            overflow: hidden;
          }

          .container {
            width: 100%;
            max-width: 380px;
            padding: 3rem 2.5rem;
            background-color: #0d0e12;
            border: 1px solid #1f222d;
            border-radius: 12px;
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
            text-align: center;
            box-sizing: border-box;
            opacity: 0;
            transform: translateY(10px);
            animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          @keyframes fadeIn {
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .logo-wrapper {
            display: flex;
            justify-content: center;
            margin-bottom: 1.5rem;
          }

          .logo-icon {
            width: 32px;
            height: 32px;
            color: #4f98a3;
          }

          h1 {
            margin: 0 0 0.5rem 0;
            font-size: 1.35rem;
            font-weight: 600;
            letter-spacing: -0.02em;
            color: #ffffff;
          }

          p {
            margin: 0 0 2.25rem 0;
            color: #8c96a3;
            line-height: 1.5;
            font-size: 0.85rem;
          }

          .btn-google {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            background-color: #ffffff;
            color: #0f1115;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            font-weight: 500;
            font-size: 0.9rem;
            font-family: inherit;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            transition: opacity 0.2s ease, transform 0.1s ease;
          }

          .btn-google:hover {
            opacity: 0.95;
          }

          .btn-google:active {
            transform: scale(0.98);
          }

          .btn-google:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }

          .btn-google svg {
            width: 16px;
            height: 16px;
          }

          .status {
            margin-top: 1.25rem;
            font-size: 0.8rem;
            color: #4f98a3;
            min-height: 1.25rem;
          }

          .status.error {
            color: #ef4444;
          }

          .counter {
            font-weight: 600;
            color: #4f98a3;
          }

          .btn-vscode {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            background-color: #1f222d;
            color: #ffffff;
            padding: 0.75rem 1.5rem;
            border-radius: 6px;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.9rem;
            border: 1px solid #2d313e;
            transition: background-color 0.2s ease, border-color 0.2s ease;
            box-sizing: border-box;
          }

          .btn-vscode:hover {
            background-color: #262a38;
            border-color: #3b4052;
          }

          .hidden {
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo-wrapper">
            <svg class="logo-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path fill-rule="evenodd" clip-rule="evenodd" d="M6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11C7.16012 11 8.2246 10.6033 9.07107 9.93579L13.2929 14.1576 C13.6834 14.5481 14.3166 14.5481 14.7071 14.1576 C15.0976 13.7671 15.0976 13.1339 14.7071 12.7434 L10.5146 8.55093 C10.825 7.78181 11 6.91712 11 6C11 3.23858 8.76142 1 6 1 Z M3 6C3 4.34315 4.34315 3 6 3C7.65685 3 9 4.34315 9 6C9 7.65685 7.65685 9 6 9C4.34315 9 3 7.65685 3 6 Z"/>
              <path d="M12.5 1 L13 3 L15 3.5 L13 4 L12.5 6 L12 4 L10 3.5 L12 3 Z"/>
            </svg>
          </div>

          <div id="signin-view">
            <h1>Sign in to ContextLens</h1>
            <p>Connect your Google account to sync AI coding sessions between VS Code and the dashboard.</p>
            <button id="btn-signin" class="btn-google" onclick="handleSignIn()">
              <svg viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Sign in with Google
            </button>
            <div id="status" class="status"></div>
          </div>

          <div id="success-view" class="hidden">
            <h1>Authentication Successful</h1>
            <p>You have successfully signed in to ContextLens.<br/>
            This window will automatically redirect back to VS Code in
            <span id="counter" class="counter">5</span> seconds,
            after which you may close this tab.</p>
            <a id="btn-open" class="btn-vscode" href="#">Open VS Code Now</a>
          </div>
        </div>

        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
        <script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
        <script>
          firebase.initializeApp({
            apiKey: "${clientApiKey.value()}",
            authDomain: "${clientAuthDomain.value()}",
            projectId: "${clientProjectId.value()}",
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

              document.getElementById('signin-view').classList.add('hidden');
              document.getElementById('success-view').classList.remove('hidden');
              document.getElementById('btn-open').href = redirectUrl;

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
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Auth login error:', err);
    res.status(500).send('Authentication failed');
  }
});

/**
 * POST /auth/exchange
 * Verifies a Firebase ID token and returns a custom token for the VS Code extension.
 */
app.post('/auth/exchange', authLimiter, apiLimiter, async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: { message: 'Missing idToken' } });
    }

    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const customToken = await firebaseAuth.createCustomToken(uid);

    return res.json({ uid, customToken });
  } catch (err) {
    console.error('Token exchange error:', err);
    return res.status(401).json({
      error: { message: 'Invalid token. Please sign in again.' },
    });
  }
});

registerErrorHandler(app);

module.exports = app;
