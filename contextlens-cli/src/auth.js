const http = require('http');
const https = require('https');
const { saveCredentials, loadCredentials, clearCredentials, getApiBase } = require('./utils/config');

// Firebase Web API key (same as used by the VS Code extension and dashboard)
const FIREBASE_API_KEY = 'AIzaSyC_hR3yJiHMlsBbjPCDaGOLvSSz-1gXj3s';

/**
 * Perform a raw HTTPS request. Returns { status, body }.
 */
function httpsRequest(url, options) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || undefined,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk.toString(); });
      res.on('end', () => resolve({ status: res.statusCode || 500, body: data }));
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Exchange a Firebase custom token for an ID token + refresh token.
 */
async function exchangeCustomToken(customToken) {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  const res = await httpsRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });

  if (res.status !== 200) {
    let msg = res.body;
    try { msg = JSON.parse(res.body).error?.message || msg; } catch {}
    throw new Error(`Token exchange failed (${res.status}): ${msg}`);
  }

  const data = JSON.parse(res.body);
  return {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    localId: data.localId,
    expiresIn: parseInt(data.expiresIn, 10) || 3600,
  };
}

/**
 * Refresh an expired ID token using the refresh token.
 */
async function refreshIdToken(refreshToken) {
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const res = await httpsRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (res.status !== 200) {
    let msg = res.body;
    try { msg = JSON.parse(res.body).error?.message || msg; } catch {}
    throw new Error(`Token refresh failed (${res.status}): ${msg}`);
  }

  const data = JSON.parse(res.body);
  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: parseInt(data.expires_in, 10) || 3600,
  };
}

/**
 * Login flow:
 * 1. Start local HTTP server on :9876
 * 2. Open browser to backend's /auth/login?callback=http://localhost:9876/callback
 * 3. After Google Sign-In, backend POSTs customToken to our callback
 * 4. Exchange customToken for idToken + refreshToken
 * 5. Save credentials to ~/.contextlens/credentials.json
 */
async function login() {
  const open = require('open');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://localhost:9876');

      // Handle the callback with the token
      if (url.pathname === '/callback') {
        // Collect POST body or query params
        let body = '';
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', async () => {
          try {
            let token = url.searchParams.get('token');

            // Try parsing body as JSON or form data
            if (!token && body) {
              try {
                const parsed = JSON.parse(body);
                token = parsed.token || parsed.customToken;
              } catch {
                // Try URL-encoded
                const params = new URLSearchParams(body);
                token = params.get('token') || params.get('customToken');
              }
            }

            if (!token) {
              res.writeHead(400, { 'Content-Type': 'text/html' });
              res.end('<h2>Error: No token received.</h2><p>Please try again.</p>');
              reject(new Error('No token received from callback'));
              server.close();
              return;
            }

            // Exchange custom token for ID token
            const result = await exchangeCustomToken(token);

            // Decode the ID token to get user info
            const payload = decodeJwtPayload(result.idToken);

            // Save credentials
            const creds = {
              idToken: result.idToken,
              refreshToken: result.refreshToken,
              uid: result.localId || payload.user_id,
              email: payload.email || 'unknown',
              expiresAt: Date.now() + (result.expiresIn * 1000),
            };
            saveCredentials(creds);

            // Send success page
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
              <!DOCTYPE html>
              <html>
              <head>
                <title>ContextLens CLI — Authenticated</title>
                <style>
                  body { font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #08090c; color: #f3f4f6; }
                  .container { text-align: center; padding: 3rem; background: #0d0e12; border: 1px solid #1f222d; border-radius: 12px; }
                  h2 { color: #22c55e; }
                  p { color: #9ca3af; }
                </style>
              </head>
              <body>
                <div class="container">
                  <h2>✔ Authenticated!</h2>
                  <p>Signed in as <strong>${creds.email}</strong></p>
                  <p>You can close this tab and return to the terminal.</p>
                </div>
              </body>
              </html>
            `);

            server.close();
            resolve(creds);
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`<h2>Authentication error</h2><p>${err.message}</p>`);
            server.close();
            reject(err);
          }
        });
        return;
      }

      // Default: redirect to auth
      res.writeHead(302, { Location: `${getApiBase()}/auth/login?callback=http://localhost:9876/callback` });
      res.end();
    });

    server.listen(9876, () => {
      const loginUrl = `${getApiBase()}/auth/login?callback=http://localhost:9876/callback`;
      open(loginUrl);
    });

    // Timeout after 2 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out after 2 minutes'));
    }, 120000);
  });
}

/**
 * Logout: clear saved credentials.
 */
function logout() {
  clearCredentials();
}

/**
 * Get a valid ID token. Auto-refreshes if expired.
 * Throws if not logged in.
 */
async function getToken() {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error('Not logged in. Run `contextlens login` first.');
  }

  // If token expires within 5 minutes, refresh
  if (Date.now() > (creds.expiresAt - 300000)) {
    try {
      const refreshed = await refreshIdToken(creds.refreshToken);
      creds.idToken = refreshed.idToken;
      creds.refreshToken = refreshed.refreshToken;
      creds.expiresAt = Date.now() + (refreshed.expiresIn * 1000);
      saveCredentials(creds);
    } catch (err) {
      throw new Error(`Token refresh failed: ${err.message}. Run \`contextlens login\` again.`);
    }
  }

  return creds.idToken;
}

/**
 * Get current user info from cached credentials.
 */
function whoami() {
  const creds = loadCredentials();
  if (!creds) return null;
  return {
    uid: creds.uid,
    email: creds.email,
    expiresAt: new Date(creds.expiresAt).toLocaleString(),
    isExpired: Date.now() > creds.expiresAt,
  };
}

/**
 * Decode a JWT payload (no verification — just for display).
 */
function decodeJwtPayload(token) {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return {};
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch {
    return {};
  }
}

module.exports = { login, logout, getToken, whoami, httpsRequest };
