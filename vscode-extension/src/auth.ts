import * as vscode from 'vscode';
import { exchangeCustomTokenForIdToken, refreshIdToken } from './apiClient';

// Must match: "<publisher>.<name>" from package.json
const EXTENSION_ID = 'noventra-Labs.contextlens';

const API_BASE = 'https://contextlens-backend-001.web.app/api';
const SECRET_ID_TOKEN_KEY = 'contextlens.auth.idToken';
const SECRET_REFRESH_TOKEN_KEY = 'contextlens.auth.refreshToken';
const SECRET_UID_KEY = 'contextlens.auth.uid';

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

  private signInResolver: ((value: { uid: string; token: string }) => void) | null = null;

  constructor(private context: vscode.ExtensionContext) {}

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
    const query = new URLSearchParams(uri.query);
    const uid = query.get('uid');
    const customToken = query.get('token');

    if (!uid || !customToken) {
      vscode.window.showErrorMessage('ContextLens: Sign-in failed — missing uid or token in callback.');
      return;
    }

    try {
      // Exchange the custom token for a real Firebase ID token
      const exchangeResult = await exchangeCustomTokenForIdToken(customToken);

      // Store the real ID token (verifiable by backend) and refresh token
      await this.context.secrets.store(SECRET_ID_TOKEN_KEY, exchangeResult.idToken);
      await this.context.secrets.store(SECRET_REFRESH_TOKEN_KEY, exchangeResult.refreshToken);
      await this.context.secrets.store(SECRET_UID_KEY, exchangeResult.localId); // real UID from Firebase

      // Clean up legacy token if present
      await this.context.secrets.delete(SECRET_TOKEN_KEY);

      // Notify listeners
      this._onDidSignIn.fire({ uid: exchangeResult.localId, token: exchangeResult.idToken });

      // Resolve any pending ensureSignedIn() promise
      if (this.signInResolver) {
        this.signInResolver({ uid: exchangeResult.localId, token: exchangeResult.idToken });
        this.signInResolver = null;
      }

      vscode.window.showInformationMessage('ContextLens: Sign-in successful! ✦');
    } catch (err: any) {
      console.error('Token exchange failed:', err);
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
    const callbackUriStr = `${vscode.env.uriScheme}://${EXTENSION_ID}`;
    const loginUrl = `${API_BASE}/auth/login?callback=${encodeURIComponent(callbackUriStr)}`;

    await vscode.env.openExternal(vscode.Uri.parse(loginUrl));

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
    await this.context.secrets.delete(SECRET_ID_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_REFRESH_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_UID_KEY);
    await this.context.secrets.delete(SECRET_TOKEN_KEY); // legacy cleanup
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
    const idToken = await this.context.secrets.get(SECRET_ID_TOKEN_KEY);
    const uid = await this.context.secrets.get(SECRET_UID_KEY);
    if (idToken && uid) {
      return { uid, token: idToken };
    }

    // Fallback: check for legacy token (pre-upgrade)
    const legacyToken = await this.context.secrets.get(SECRET_TOKEN_KEY);
    if (legacyToken && uid) {
      // Legacy custom token — can't be used directly anymore.
      // Clear and force re-sign-in.
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
   */
  async tryRefreshToken(): Promise<boolean> {
    try {
      const currentRefreshToken = await this.context.secrets.get(SECRET_REFRESH_TOKEN_KEY);
      if (!currentRefreshToken) {
        return false;
      }

      const result = await refreshIdToken(currentRefreshToken);
      await this.context.secrets.store(SECRET_ID_TOKEN_KEY, result.id_token);
      await this.context.secrets.store(SECRET_REFRESH_TOKEN_KEY, result.refresh_token);
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
    await this.context.secrets.delete(SECRET_ID_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_REFRESH_TOKEN_KEY);
    await this.context.secrets.delete(SECRET_UID_KEY);
    await this.context.secrets.delete(SECRET_TOKEN_KEY); // legacy

    const action = await vscode.window.showWarningMessage(
      'ContextLens: Session expired. Please sign in again.',
      'Sign In'
    );
    if (action === 'Sign In') {
      vscode.commands.executeCommand('contextlens.signIn');
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
