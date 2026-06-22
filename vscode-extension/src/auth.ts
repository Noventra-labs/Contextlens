import * as vscode from 'vscode';
import { exchangeCustomTokenForIdToken, refreshIdToken } from './apiClient';

// Must match: "<publisher>.<name>" from package.json
const EXTENSION_ID = 'Noventra-Labs.contextlens';

const API_BASE = 'https://contextlens-backend-001.web.app/api';
const SECRET_ID_TOKEN_KEY = 'contextlens.auth.idToken';
const SECRET_REFRESH_TOKEN_KEY = 'contextlens.auth.refreshToken';
const SECRET_UID_KEY = 'contextlens.auth.uid';

// Legacy GlobalState keys for cleanup
const GLOBAL_ID_TOKEN_KEY = 'contextlens.global.idToken';
const GLOBAL_REFRESH_TOKEN_KEY = 'contextlens.global.refreshToken';
const GLOBAL_UID_KEY = 'contextlens.global.uid';

// Legacy key — we'll migrate away from it
const SECRET_TOKEN_KEY = 'contextlens.auth.token';

/**
 * AuthManager handles the full VS Code → Browser → Backend → VS Code
 * sign-in callback loop using `vscode://` URI handlers.
 *
 * Token flow:
 * 1. Backend /auth/login creates a Firebase custom token
 * 2. Extension receives it via URI callback
 * 3. Extension exchanges it for a real ID token via REST API
 * 4. ID token is sent as Bearer token on all API requests
 * 5. On 401, extension refreshes the ID token using the refresh token
 */
export class AuthManager implements vscode.UriHandler {
  private _onDidSignIn = new vscode.EventEmitter<{ uid: string; token: string }>();
  public readonly onDidSignIn = this._onDidSignIn.event;

  private _onDidSignOut = new vscode.EventEmitter<void>();
  public readonly onDidSignOut = this._onDidSignOut.event;

  /**
   * Quick check to see if the user is currently authenticated based on SecretStorage.
   * Note: This is an async operation.
   */
  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getIdToken();
    return !!token;
  }

  private signInResolver: ((value: { uid: string; token: string }) => void) | null = null;

  // B2: Proactive token-refresh timer.
  private proactiveRefreshTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.startProactiveRefresh();
  }

  // ── URI Handler ────────────────────────────────────────────────────────────

  /**
   * Registers this instance as a global URI handler with VS Code.
   * This is necessary for receiving the sign-in callback from the browser.
   */
  registerUriHandler(): void {
    this.context.subscriptions.push(
      vscode.window.registerUriHandler(this)
    );
  }

  /**
   * Called by VS Code when a vscode://<extension-id>?uid=...&token=... URI is received.
   * The `token` here is a Firebase *custom* token. We exchange it for a real ID token.
   */
  async handleUri(uri: vscode.Uri): Promise<void> {
    // uri.query does NOT include the leading '?', so URLSearchParams handles it directly
    const query = new URLSearchParams(uri.query);
    const uid = query.get('uid');
    const customToken = query.get('token');

    // Guard against the literal string 'undefined' being passed (browser template bug)
    const isValidUid = uid && uid.length > 0 && uid !== 'undefined';
    const isValidToken = customToken && customToken.length > 0 && customToken !== 'undefined';

    if (!isValidUid || !isValidToken) {
      console.error('[ContextLens] handleUri received invalid parameters:', { uid, customToken: customToken ? '[REDACTED]' : customToken });
      vscode.window.showErrorMessage(
        `ContextLens: Sign-in failed — missing or invalid uid/token in callback. Please try signing in again.`
      );
      return;
    }

    try {
      // Exchange the custom token for a real Firebase ID token
      const exchangeResult = await exchangeCustomTokenForIdToken(customToken);

      if (!exchangeResult || !exchangeResult.idToken || !exchangeResult.refreshToken) {
        console.error('[ContextLens] Invalid exchange result:', exchangeResult);
        throw new Error(`Invalid token response from Firebase API.`);
      }

      // Store in SecretStorage (primary)
      await this.context.secrets.store(SECRET_ID_TOKEN_KEY, exchangeResult.idToken);
      await this.context.secrets.store(SECRET_REFRESH_TOKEN_KEY, exchangeResult.refreshToken);
      await this.context.secrets.store(SECRET_UID_KEY, uid);

      // Clean up any leaked plaintext tokens from earlier versions
      await this.context.globalState.update(GLOBAL_ID_TOKEN_KEY, undefined);
      await this.context.globalState.update(GLOBAL_REFRESH_TOKEN_KEY, undefined);
      await this.context.globalState.update(GLOBAL_UID_KEY, undefined);

      // Clean up legacy token if present
      await this.context.secrets.delete(SECRET_TOKEN_KEY);

      // Notify listeners
      this._onDidSignIn.fire({ uid, token: exchangeResult.idToken });

      // Resolve any pending ensureSignedIn() promise
      if (this.signInResolver) {
        this.signInResolver({ uid, token: exchangeResult.idToken });
        this.signInResolver = null;
      }

      vscode.window.showInformationMessage('ContextLens: Sign-in successful! ✦');
    } catch (err: any) {
      console.error('[ContextLens] Token exchange failed:', err);
      vscode.window.showErrorMessage(`ContextLens: Sign-in failed — ${err.message}`);
    }
  }

  // ── Sign In / Out ──────────────────────────────────────────────────────────

  /**
   * Initiates the sign-in flow by opening the backend login URL in the default browser.
   * 
   * @returns A promise that resolves with the UID and ID token once sign-in is complete.
   */
  async signIn(): Promise<{ uid: string; token: string }> {
    // ── Build callback URI ──────────────────────────────────────────────
    // vscode.env.uriScheme can be undefined, null, empty, or the literal
    // string "undefined" in certain VS Code forks (Cursor, Codium),
    // WSL Remote, or during very early activation before the property is
    // hydrated.  Any of those would cause vscode.Uri.parse to throw:
    //   "Error processing argument at index 0, conversion failure from undefined"
    let rawScheme: string | undefined;
    try {
      rawScheme = vscode.env.uriScheme;
    } catch {
      // Property access itself can throw in some exotic embedders
      rawScheme = undefined;
    }

    const scheme =
      (typeof rawScheme === 'string' && rawScheme.length > 0 && rawScheme !== 'undefined')
        ? rawScheme
        : 'vscode';

    const callbackUriStr = `${scheme}://${EXTENSION_ID}`;
    const loginUrl = `${API_BASE}/auth/login?callback=${encodeURIComponent(callbackUriStr)}`;

    // ── Validate the URL string before handing it to the native layer ───
    if (!loginUrl || typeof loginUrl !== 'string' || loginUrl.length === 0) {
      const msg = 'ContextLens: Could not build sign-in URL. Please reinstall the extension.';
      vscode.window.showErrorMessage(msg);
      throw new Error(msg);
    }

    // ── Parse URI ───────────────────────────────────────────────────────
    let loginUri: vscode.Uri;
    try {
      loginUri = vscode.Uri.parse(loginUrl, true);
    } catch (err: any) {
      console.error('[ContextLens] Failed to parse login URL:', loginUrl, err);
      vscode.window.showErrorMessage(
        `ContextLens: Could not open sign-in page — ${err.message}`
      );
      throw err;
    }

    // ── Open in browser ─────────────────────────────────────────────────
    try {
      await vscode.env.openExternal(loginUri);
    } catch (err: any) {
      console.error('[ContextLens] Failed to open external URL:', loginUri.toString(), err);
      vscode.window.showErrorMessage(
        `ContextLens: Could not open browser for sign-in — ${err.message}`
      );
      throw err;
    }

    return new Promise<{ uid: string; token: string }>((resolve) => {
      this.signInResolver = resolve;
    });
  }

  /**
   * Ensures the user is signed in. If cached credentials exist, they are returned.
   * Otherwise, the interactive sign-in flow is triggered.
   * 
   * @returns A promise resolving to the authenticated user's metadata.
   */
  async ensureSignedIn(): Promise<{ uid: string; token: string }> {
    const existing = await this.loadAuthState();
    if (existing) {
      return existing;
    }
    return this.signIn();
  }

  /**
   * Signs the user out by deleting all stored secrets and notifying listeners.
   */
  async signOut(): Promise<void> {
    // Clear SecretStorage
    await this.context.secrets.delete(SECRET_ID_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_REFRESH_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_UID_KEY);
    await this.context.secrets.delete(SECRET_TOKEN_KEY); // legacy cleanup

    // Clean up any leaked plaintext tokens
    await this.context.globalState.update(GLOBAL_ID_TOKEN_KEY, undefined);
    await this.context.globalState.update(GLOBAL_REFRESH_TOKEN_KEY, undefined);
    await this.context.globalState.update(GLOBAL_UID_KEY, undefined);

    this._onDidSignOut.fire();
    vscode.window.showInformationMessage('ContextLens: Signed out.');
  }

  // ── Getters ────────────────────────────────────────────────────────────────

  /**
   * Loads the current authentication state from VS Code's SecretStorage.
   * 
   * @returns The stored UID and ID token, or null if not signed in or using legacy tokens.
   */
  async loadAuthState(): Promise<{ uid: string; token: string } | null> {
    // 1. Try SecretStorage (primary, most secure)
    const idToken = await this.context.secrets.get(SECRET_ID_TOKEN_KEY);
    const uid = await this.context.secrets.get(SECRET_UID_KEY);
    if (idToken && uid) {
      return { uid, token: idToken };
    }

    // 2. Migrate any plaintext tokens that might have been leaked in older versions
    const globalToken = this.context.globalState.get<string>(GLOBAL_ID_TOKEN_KEY);
    const globalUid = this.context.globalState.get<string>(GLOBAL_UID_KEY);
    if (globalToken && globalUid) {
      // Migrate to SecretStorage
      await this.context.secrets.store(SECRET_ID_TOKEN_KEY, globalToken);
      await this.context.secrets.store(SECRET_UID_KEY, globalUid);

      const globalRefresh = this.context.globalState.get<string>(GLOBAL_REFRESH_TOKEN_KEY);
      if (globalRefresh) {
        await this.context.secrets.store(SECRET_REFRESH_TOKEN_KEY, globalRefresh);
      }

      // Delete plaintext leaks
      await this.context.globalState.update(GLOBAL_ID_TOKEN_KEY, undefined);
      await this.context.globalState.update(GLOBAL_REFRESH_TOKEN_KEY, undefined);
      await this.context.globalState.update(GLOBAL_UID_KEY, undefined);

      console.log('[ContextLens] Auth migrated from globalState to SecretStorage.');
      return { uid: globalUid, token: globalToken };
    }

    // 3. Fallback: check for legacy token (pre-upgrade)
    const legacyToken = await this.context.secrets.get(SECRET_TOKEN_KEY);
    if (legacyToken && uid) {
      await this.context.secrets.delete(SECRET_TOKEN_KEY);
      return null;
    }

    return null;
  }

  /**
   * Get the Firebase ID token for API requests.
   * This is a REAL ID token (verifiable by admin.auth().verifyIdToken()).
   */
  async getIdToken(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_ID_TOKEN_KEY);
  }

  /**
   * @deprecated Use getIdToken() instead
   */
  async getToken(): Promise<string | undefined> {
    // Return ID token for backward compat
    return this.getIdToken();
  }

  /**
   * Retrieves the current user's UID from SecretStorage.
   * 
   * @returns The UID string or undefined if not found.
   */
  async getUid(): Promise<string | undefined> {
    return this.context.secrets.get(SECRET_UID_KEY);
  }

  /**
   * Attempt to refresh the ID token using the stored refresh token.
   * Returns true if refresh succeeded, false otherwise.
   * Concurrent callers are coalesced via `coordinateRefresh` so that
   * N parallel 401 retries trigger only one network call.
   */
  tryRefreshToken(): Promise<boolean> {
    return coordinateRefresh(() => this.attemptRefresh());
  }

  /**
   * Internal: performs a single refresh attempt. Wrapped by coordinateRefresh.
   */
  private async attemptRefresh(): Promise<boolean> {
    try {
      let currentRefreshToken = await this.context.secrets.get(SECRET_REFRESH_TOKEN_KEY);

      // KI-001: Fallback to globalState if SecretStorage lost the refresh token
      if (!currentRefreshToken) {
        currentRefreshToken = this.context.globalState.get<string>(GLOBAL_REFRESH_TOKEN_KEY);
      }
      if (!currentRefreshToken) {
        return false;
      }

      const result = await refreshIdToken(currentRefreshToken);

      // Update SecretStorage
      await this.context.secrets.store(SECRET_ID_TOKEN_KEY, result.id_token);
      await this.context.secrets.store(SECRET_REFRESH_TOKEN_KEY, result.refresh_token);

      // Clean up any plaintext leaks
      await this.context.globalState.update(GLOBAL_ID_TOKEN_KEY, undefined);
      await this.context.globalState.update(GLOBAL_REFRESH_TOKEN_KEY, undefined);

      return true;
    } catch (err) {
      console.error('Token refresh failed:', err);
      return false;
    }
  }

  /**
   * Clear stored credentials and prompt to re-sign-in.
   */
  async handleSessionExpired(): Promise<void> {
    // Clear all storage layers
    await this.context.secrets.delete(SECRET_ID_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_REFRESH_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_UID_KEY);
    await this.context.secrets.delete(SECRET_TOKEN_KEY); // legacy

    // Clean up any plaintext leaks
    await this.context.globalState.update(GLOBAL_ID_TOKEN_KEY, undefined);
    await this.context.globalState.update(GLOBAL_REFRESH_TOKEN_KEY, undefined);
    await this.context.globalState.update(GLOBAL_UID_KEY, undefined);

    const action = await vscode.window.showWarningMessage(
      'ContextLens: Session expired. Please sign in again.',
      'Sign In'
    );
    if (action === 'Sign In') {
      vscode.commands.executeCommand('contextlens.signIn');
    }
  }

  // ── B2: Proactive refresh ────────────────────────────────────────────────

  /**
   * Decode the `exp` claim from a Firebase ID token without verifying
   * the signature (the server will do that on the next request).
   * Returns the expiry timestamp in ms, or null if unparseable.
   */
  private decodeTokenExpiryMs(idToken: string): number | null {
    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) return null;
      // base64url → base64
      const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - (padded.length % 4)) % 4);
      const json = Buffer.from(padded + padding, 'base64').toString('utf8');
      const payload = JSON.parse(json);
      return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  /**
   * Periodic timer that proactively refreshes the ID token before it
   * expires, so long-idle sessions don't accumulate 401 errors. Driven by
   * `contextlens.tokenRefreshMinutes` (default 45, max 55 — under the
   * 60-minute Firebase ID token TTL).
   */
  private startProactiveRefresh(): void {
    if (this.proactiveRefreshTimer) return;

    const minutes = vscode.workspace.getConfiguration('contextlens').get<number>('tokenRefreshMinutes', 45);
    const intervalMs = Math.max(5, Math.min(55, minutes)) * 60_000;

    this.proactiveRefreshTimer = setInterval(async () => {
      try {
        const idToken = await this.getIdToken();
        if (!idToken) return; // signed out — nothing to refresh

        const expMs = this.decodeTokenExpiryMs(idToken);
        if (expMs === null) return;

        const remainingMs = expMs - Date.now();
        // Refresh if < 15 minutes remaining (gives margin for retries).
        if (remainingMs < 15 * 60_000) {
          console.log(`[ContextLens] Proactive token refresh — ${Math.round(remainingMs / 1000)}s until expiry.`);
          // No-await on purpose — coordinator handles concurrency.
          this.tryRefreshToken().catch((err) => {
            console.warn('[ContextLens] Proactive refresh failed:', err);
          });
        }
      } catch (err) {
        console.warn('[ContextLens] Proactive refresh check failed:', err);
      }
    }, intervalMs);
  }

  /**
   * Stops the proactive refresh timer. Called from the extension's
   * deactivate hook.
   */
  stopProactiveRefresh(): void {
    if (this.proactiveRefreshTimer) {
      clearInterval(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }
  }
}

// ── Singleton accessor (set from extension.ts) ────────────────────────────

let _authManager: AuthManager | null = null;

export function setAuthManager(am: AuthManager) {
  _authManager = am;
}

export function getAuthManager(): AuthManager {
  if (!_authManager) {
    throw new Error('AuthManager not initialized. Call setAuthManager() in activate().');
  }
  return _authManager;
}

// ── Refresh coordinator (B3) ──────────────────────────────────────────────
// Coordinates concurrent token refresh attempts so that N simultaneous 401s
// collapse to 1 underlying refreshIdToken() call. All callers awaiting the
// in-flight refresh get the same result.

let _isRefreshing = false;
let _pendingWaiters: Array<(succeeded: boolean) => void> = [];

const REFRESH_TIMEOUT_MS = 10_000;

/**
 * Ensures that only one token refresh runs at a time. Concurrent callers
 * wait for the in-flight refresh to complete and receive its result.
 *
 * @param doRefresh Async function that performs the actual refresh.
 * @returns true if the refresh succeeded, false otherwise.
 */
export async function coordinateRefresh(doRefresh: () => Promise<boolean>): Promise<boolean> {
  if (_isRefreshing) {
    // Join the queue with a safety timeout so a hung refresh doesn't deadlock.
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        console.warn('[ContextLens] Refresh coordinator timed out after 10s — failing fast.');
        resolve(false);
      }, REFRESH_TIMEOUT_MS);

      _pendingWaiters.push((succeeded) => {
        clearTimeout(timer);
        resolve(succeeded);
      });
    });
  }

  _isRefreshing = true;
  try {
    const succeeded = await doRefresh();
    // Notify all waiters
    const waiters = _pendingWaiters;
    _pendingWaiters = [];
    for (const w of waiters) {
      try { w(succeeded); } catch { /* don't let one bad waiter poison the rest */ }
    }
    return succeeded;
  } catch (err) {
    // Refresh threw — fail all waiters
    const waiters = _pendingWaiters;
    _pendingWaiters = [];
    for (const w of waiters) {
      try { w(false); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    _isRefreshing = false;
  }
}
