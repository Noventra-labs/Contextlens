import * as https from 'https';
import * as http from 'http';
import { getAuthManager } from './auth';

const API_BASE = 'https://contextlens-backend-001.web.app/api';
const DASHBOARD_BASE = 'https://contextlens-backend-001.web.app';

// Firebase Web API key — needed to exchange custom tokens for ID tokens
const FIREBASE_API_KEY = 'AIzaSyAQ2U7k1Z1h0myROPoj9upUMxJ-r_ZZ3ME';

function httpRequest(url: string, options: {
  method: string;
  headers: Record<string, string>;
  body?: string;
}): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const transport = parsedUrl.protocol === 'https:' ? https : http;

    const req = transport.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || undefined,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method,
        headers: options.headers,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
        res.on('end', () => {
          resolve({ status: res.statusCode || 500, body: data });
        });
      }
    );

    req.on('error', reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Exchange a Firebase custom token for a real Firebase ID token
 * using the Firebase Auth REST API.
 *
 * Custom tokens received from the backend's /auth/login route cannot be
 * verified by admin.auth().verifyIdToken(). They must first be exchanged
 * for ID tokens via the identitytoolkit REST endpoint.
 */
async function exchangeCustomTokenForIdToken(customToken: string): Promise<{
  idToken: string;
  refreshToken: string;
  localId: string;
}> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_API_KEY}`;
  const res = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  if (res.status !== 200) {
    throw new Error(`Token exchange failed (${res.status}): ${res.body}`);
  }

  return JSON.parse(res.body);
}

/**
 * Refresh an expired ID token using a refresh token.
 */
async function refreshIdToken(refreshToken: string): Promise<{
  id_token: string;
  refresh_token: string;
}> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
  const res = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (res.status !== 200) {
    throw new Error(`Token refresh failed (${res.status}): ${res.body}`);
  }

  return JSON.parse(res.body);
}

/**
 * Authenticated POST request to the backend.
 * Pulls the Bearer token from AuthManager's SecretStorage.
 * On 401, attempts a token refresh before giving up.
 */
async function request<T>(path: string, body?: object): Promise<T> {
  const authManager = getAuthManager();
  let token = await authManager.getIdToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const jsonBody = body ? JSON.stringify(body) : undefined;
  if (jsonBody) {
    headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
  }

  let res = await httpRequest(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: jsonBody,
  });

  // On 401, try refreshing the token once
  if (res.status === 401) {
    const refreshed = await authManager.tryRefreshToken();
    if (refreshed) {
      token = await authManager.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        res = await httpRequest(`${API_BASE}${path}`, {
          method: 'POST',
          headers,
          body: jsonBody,
        });
      }
    }

    // Still 401 after refresh → session expired
    if (res.status === 401) {
      await authManager.handleSessionExpired();
      throw new Error('Session expired');
    }
  }

  let parsed: any;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    throw new Error(`Invalid JSON response (status ${res.status})`);
  }

  if (res.status >= 400) {
    throw new Error(parsed?.error?.message || `API error: ${res.status}`);
  }

  return parsed as T;
}

// ── Project ──────────────────────────────────────────────────────────────────

export class ApiClient {
  static async createProject(body: {
    name: string;
    repoUrl?: string;
    localWorkspaceName?: string;
    defaultBranch?: string;
  }): Promise<{ projectId: string }> {
    return request('/projects/create', body);
  }

  // ── Episode ──────────────────────────────────────────────────────────────

  static async createEpisode(body: {
    projectId: string;
    label: string;
    branchName: string;
  }): Promise<{ episodeId: string }> {
    return request('/episodes/create', body);
  }

  static async closeEpisode(body: {
    projectId: string;
    episodeId: string;
  }): Promise<{ closed: boolean }> {
    return request('/episodes/close', body);
  }

  // ── Calls ────────────────────────────────────────────────────────────────

  static async logCall(body: {
    projectId: string;
    episodeId: string;
    promptText: string;
    intentTag?: string;
    source?: 'extension' | 'manual_log';
    modelName?: string;
    modelResponse?: string;
    branchName?: string;
    activeFilePath?: string;
    relatedFiles?: string[];
    diffSnapshot?: string | null;
    diffHash?: string;
    todoMatches?: string[];
  }): Promise<{
    callId: string;
    modelName: string;
    modelResponse: string;
    latencyMs: number;
    saved: boolean;
  }> {
    return request('/calls/log', body);
  }

  // ── Explain Diff ─────────────────────────────────────────────────────────

  static async explainDiff(body: {
    projectId: string;
    episodeId: string;
    diffHash: string;
    changedFiles?: string[];
  }): Promise<{
    summary: string;
    risks: string[];
    checks: string[];
    fromCache?: boolean;
  }> {
    return request('/episodes/explain', body);
  }

  // ── Branch Summary ───────────────────────────────────────────────────────

  static async summarizeBranch(body: {
    projectId: string;
    branchName: string;
    episodes?: Array<{ label?: string; episodeSummary?: string }>;
  }): Promise<{
    pr_summary: string;
    key_changes: string[];
    review_risks: string[];
  }> {
    return request('/branches/summarize', body);
  }

  // ── Dashboard URLs ───────────────────────────────────────────────────────

  static dashboardUrl(projectId: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}`;
  }

  static dashboardEpisodeUrl(projectId: string, episodeId: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}/episodes/${episodeId}`;
  }

  static dashboardBranchUrl(projectId: string, branchName: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}/branch/${encodeURIComponent(branchName)}`;
  }
}

export { exchangeCustomTokenForIdToken, refreshIdToken };
