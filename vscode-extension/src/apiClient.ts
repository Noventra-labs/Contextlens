import * as https from 'https';
import * as http from 'http';
import { getAuthManager } from './auth';

const API_BASE = 'https://contextlens-backend-001.web.app/api';
const DASHBOARD_BASE = 'https://contextlens-backend-001.web.app';

// Firebase Web API key — needed to exchange custom tokens for ID tokens
const FIREBASE_API_KEY = 'AIzaSyAQ2U7k1Z1h0myROPoj9upUMxJ-r_ZZ3ME';

/**
 * Internal helper to perform an HTTP request using node's native http/https modules.
 * Returns a promise that resolves with the status code and raw response body.
 */
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
 *
 * @param customToken The custom token issued by the backend.
 * @returns Object containing the ID token, refresh token, and local UID.
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
 * Refresh an expired ID token using a refresh token via Firebase Secure Token API.
 *
 * @param refreshToken The refresh token used to obtain a new ID token.
 * @returns Object containing the new ID token and refresh token.
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
 *
 * @template T The expected type of the response.
 * @param path The API endpoint path (e.g., '/projects/create').
 * @param body Optional JSON body for the POST request.
 * @returns The parsed JSON response body cast to type T.
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

/**
 * Client for interacting with the ContextLens backend API.
 * All requests are authenticated via Firebase ID tokens.
 */
export class ApiClient {
  /**
   * Generic post method for SyncEngine or manual logging.
   *
   * @param endpoint The API path to post to.
   * @param body The JSON payload.
   * @returns The raw API response.
   */
  static async post(endpoint: string, body: object): Promise<any> {
    return request(endpoint, body);
  }

  /**
   * Registers a new project in the ContextLens system.
   *
   * @param body Metadata about the project including repository and workspace info.
   * @returns The newly created project ID.
   */
  static async createProject(body: {
    name: string;
    repoUrl?: string;
    localWorkspaceName?: string;
    defaultBranch?: string;
  }): Promise<{ projectId: string }> {
    return request('/projects/create', body);
  }

  // ── Episode ──────────────────────────────────────────────────────────────

  /**
   * Starts a new coding episode for a given project.
   *
   * @param body The project ID, label, and current branch.
   * @returns The newly created episode ID.
   */
  static async createEpisode(body: {
    projectId: string;
    label: string;
    branchName: string;
  }): Promise<{ episodeId: string }> {
    return request('/episodes/create', body);
  }

  /**
   * Marks a coding episode as closed.
   *
   * @param body The project and episode identifiers.
   * @returns Status indicating if the episode was successfully closed.
   */
  static async closeEpisode(body: {
    projectId: string;
    episodeId: string;
  }): Promise<{ closed: boolean }> {
    return request('/episodes/close', body);
  }

  // ── Calls ────────────────────────────────────────────────────────────────

  /**
   * Logs an AI interaction (call) within a specific episode.
   *
   * @param body Detailed payload containing prompt text, model info, and context (diffs, files).
   * @returns The recorded call details and the AI-generated response.
   */
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

  /**
   * Requests an AI-generated explanation and risk analysis for a specific diff hash.
   *
   * @param body Project context, episode context, and the diff hash to analyze.
   * @returns A structured summary, risks, and checklist items.
   */
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

  /**
   * Generates a high-level summary of all changes on a branch across multiple episodes.
   * Useful for generating Pull Request descriptions.
   *
   * @param body Context for the summarization task.
   * @returns A comprehensive PR summary, key changes, and review risks.
   */
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

  /**
   * Returns the dashboard web URL for a specific project.
   */
  static dashboardUrl(projectId: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}`;
  }

  /**
   * Returns the dashboard web URL for a specific episode.
   */
  static dashboardEpisodeUrl(projectId: string, episodeId: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}/episodes/${episodeId}`;
  }

  /**
   * Returns the dashboard web URL for a specific branch.
   */
  static dashboardBranchUrl(projectId: string, branchName: string): string {
    return `${DASHBOARD_BASE}/dashboard/${projectId}/branch/${encodeURIComponent(branchName)}`;
  }
}

export { exchangeCustomTokenForIdToken, refreshIdToken };
