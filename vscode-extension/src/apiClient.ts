import * as vscode from 'vscode';
import * as https from 'https';
import * as http from 'http';
import { getAuthManager } from './auth';
import { ErrorMapper } from './ErrorMapper';
import { NotificationService } from './NotificationService';

const API_BASE = 'https://contextlens-backend-001.web.app/api';
const DASHBOARD_BASE = 'https://contextlens-backend-001.web.app';

// Firebase Web API key — needed to exchange custom tokens for ID tokens.
// Source order:
//   1. webpack DefinePlugin (build-time, via FIREBASE_API_KEY env var)
//   2. VS Code workspace setting `contextlens.firebaseApiKey` (for local dev)
// The literal must NEVER live in source.
declare const __FIREBASE_API_KEY__: string | undefined;

function resolveFirebaseApiKey(): string {
  const injected = typeof __FIREBASE_API_KEY__ !== 'undefined' ? __FIREBASE_API_KEY__ : '';
  if (injected) return injected;

  const fromConfig = vscode.workspace.getConfiguration('contextlens').get<string>('firebaseApiKey', '');
  if (fromConfig && fromConfig.trim().length > 0) return fromConfig;

  throw new Error(
    '[ContextLens] Firebase API key is not configured. ' +
    'Set the FIREBASE_API_KEY env var before running `npm run package`, ' +
    'or set `contextlens.firebaseApiKey` in your VS Code settings for local development.'
  );
}

export interface CreateProjectResponse {
  projectId: string;
}

export interface CreateEpisodeResponse {
  episodeId: string;
}

export interface CloseEpisodeResponse {
  closed: boolean;
}

export interface LogCallResponse {
  callId: string;
  modelName: string;
  modelResponse: string;
  latencyMs: number;
  saved: boolean;
}

export interface ExplainDiffResponse {
  summary: string;
  risks: string[];
  checks: string[];
  fromCache?: boolean;
}

export interface SummarizeBranchResponse {
  pr_summary: string;
  key_changes: string[];
  review_risks: string[];
}

export interface GetEpisodeResponse {
  id: string;
  label: string | null;
  branchName: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  callCount: number;
  changedFiles: string[];
  latestDiffHash: string | null;
  manualNotes: string | null;
  recentCalls: Array<{
    id: string;
    createdAt: string;
    source: string;
    intentTag: string | null;
    promptText: string;
    modelName: string;
    modelResponse: string;
    branchName: string | null;
    activeFilePath: string | null;
    relatedFiles: string[];
    diffSnapshot: any;
    diffHash: string | null;
    todoMatches: string[];
    latencyMs: number;
    tokenUsage: any;
    status: string;
  }>;
}

export interface ListEpisodesResponse {
  items: Array<{
    id: string;
    label: string | null;
    branchName: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
    callCount: number;
    changedFiles: string[];
    latestDiffHash: string | null;
    manualNotes: string | null;
  }>;
}

/**
 * Internal helper to perform an HTTP(S) request using Node.js native modules.
 * This ensures zero-dependency operation within the VS Code extension environment.
 * 
 * @param url The full URL to request.
 * @param options Request configuration including method, headers, and optional body.
 * @returns A promise resolving to the status code and raw response body.
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
        timeout: 15_000, // 15s timeout
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
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out after 15s'));
    });

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
}> {
  const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${resolveFirebaseApiKey()}`;
  const res = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true,
    }),
  });

  if (res.status !== 200) {
    let message = res.body;
    try {
      const errorData = JSON.parse(res.body);
      message = errorData.error?.message || message;
    } catch { /* use raw body */ }
    throw new Error(`Token exchange failed (${res.status}): ${message}`);
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
  const url = `https://securetoken.googleapis.com/v1/token?key=${resolveFirebaseApiKey()}`;
  const res = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
  });

  if (res.status !== 200) {
    let message = res.body;
    try {
      const errorData = JSON.parse(res.body);
      message = errorData.error?.message || message;
    } catch { /* use raw body */ }
    throw new Error(`Token refresh failed (${res.status}): ${message}`);
  }

  return JSON.parse(res.body);
}

/**
 * Authenticated request to the backend.
 * Pulls the Bearer token from AuthManager's SecretStorage.
 * On 401, attempts a token refresh before giving up.
 *
 * @template T The expected type of the response.
 * @param path The API endpoint path (e.g., '/projects/create').
 * @param method The HTTP method (default: 'POST')
 * @param body Optional JSON body for the request.
 * @returns The parsed JSON response body cast to type T.
 */
async function request<T>(path: string, methodOrBody: string | object = 'POST', bodyOrHeaders?: object | Record<string, string>, extraHeaders?: Record<string, string>): Promise<T> {
  const authManager = getAuthManager();
  let token = await authManager.getIdToken();

  // KI-002: Auth-state guard — prevent silent failures when token is missing
  if (!token) {
    // Attempt a token refresh first (handles globalState re-hydration)
    const refreshed = await authManager.tryRefreshToken();
    if (refreshed) {
      token = await authManager.getIdToken();
    }

    if (!token) {
      // Use ErrorMapper + NotificationService instead of raw toast
      const mapped = ErrorMapper.map({ code: 'AUTH_ERROR' });
      NotificationService.getInstance().fromMapped(mapped);
      throw new Error('Not authenticated — sign in required.');
    }
  }

  let method = 'POST';
  let requestBody: object | undefined;
  let mergedExtraHeaders: Record<string, string> | undefined = extraHeaders;

  if (typeof methodOrBody === 'string') {
    method = methodOrBody;
    requestBody = bodyOrHeaders as object | undefined;
  } else if (typeof methodOrBody === 'object') {
    requestBody = methodOrBody;
    // When called as request(path, body, extraHeaders):
    // bodyOrHeaders here is actually extraHeaders
    mergedExtraHeaders = bodyOrHeaders as Record<string, string> | undefined;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    // Fix 2: Merge custom headers (e.g. X-Idempotency-Key)
    ...mergedExtraHeaders,
  };

  const jsonBody = requestBody ? JSON.stringify(requestBody) : undefined;
  if (jsonBody) {
    headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
  }

  let res = await httpRequest(`${API_BASE}${path}`, {
    method,
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
          method,
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
    // Parse error code from response and map to user-friendly message
    const rawCode = parsed?.error?.code || 'INTERNAL_ERROR';
    const errorCode = rawCode.toUpperCase();
    const mapped = ErrorMapper.map({ code: errorCode, status: res.status });

    // Include validation details if available
    let message = mapped.message;
    if (errorCode === 'VALIDATION_ERROR' && parsed?.error?.details?.length) {
      const fields = parsed.error.details.map((d: any) => `${d.field}: ${d.message}`).join('; ');
      message = `Validation failed — ${fields}`;
    }
    throw new Error(message);
  }

  return parsed as T;
}

// ── Project ──────────────────────────────────────────────────────────────────

/**
 * Client for interacting with the ContextLens backend API.
 * 
 * Static method usage:
 * All methods are static to ensure a consistent, stateless interface throughout the extension.
 * 
 * Authentication Flow:
 * 1. Requests pull the current Firebase ID token from `AuthManager`.
 * 2. If the request fails with 401 (Unauthorized), the client attempts to refresh the token.
 * 3. If refresh succeeds, the original request is retried exactly once.
 * 4. If refresh fails or second attempt is 401, the user is notified of session expiry.
 *
 * Refresh coordination (B3): N concurrent 401s in flight share a single
 * refresh via the mutex in `coordinateRefresh`. Each waiter then retries
 * its own request with the freshly minted token.
 * 
 * Custom Token Exchange:
 * The backend issues "Custom Tokens" which are exchanged for "ID Tokens" via the Firebase 
 * Identity Toolkit REST API. This exchange happens once during the sign-in flow.
 */
export class ApiClient {
  /**
   * Generic post method for SyncEngine or manual logging.
   * Fix 2: Now accepts optional headers (e.g. X-Idempotency-Key) and forwards them.
   *
   * @param endpoint The API path to post to.
   * @param body The JSON payload.
   * @param options Optional request options including custom headers.
   * @returns The raw API response.
   */
  static async post(endpoint: string, body: object, options?: { headers?: Record<string, string> }): Promise<any> {
    return request(endpoint, body, options?.headers);
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
  }): Promise<CreateProjectResponse> {
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
  }): Promise<CreateEpisodeResponse> {
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
  }): Promise<CloseEpisodeResponse> {
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
  }): Promise<LogCallResponse> {
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
  }): Promise<ExplainDiffResponse> {
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
  }): Promise<SummarizeBranchResponse> {
    return request('/branches/summarize', body);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  /**
   * Retrieves the user's AI provider settings from the backend.
   * Returns provider selection and hasKey flags (never raw keys).
   */
  static async getSettings(): Promise<{
    aiProvider: string;
    hasGeminiKey: boolean;
    hasOpenaiKey: boolean;
    hasAnthropicKey: boolean;
  }> {
    return request('/settings/get');
  }

  /**
   * Updates the user's AI provider settings on the backend.
   * Supports setting provider and/or individual API keys.
   */
  static async updateSettings(body: {
    aiProvider?: string;
    geminiApiKey?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
  }): Promise<{ saved: boolean }> {
    return request('/settings/update', body);
  }

  // ── Episode Retrieval ────────────────────────────────────────────────────

  static async getEpisode(projectId: string, episodeId: string): Promise<GetEpisodeResponse> {
    const response = await request<{ ok: boolean; episode: GetEpisodeResponse }>(`/episodes/${episodeId}?projectId=${encodeURIComponent(projectId)}`, 'GET');
    return response.episode;
  }

  /**
   * Lists episodes for a project.
   *
   * @param projectId The project ID
   * @param limit Maximum number of episodes to return (default: 10)
   * @param includeClosed Whether to include closed episodes (default: false)
   * @returns Array of episode objects
   */
  static async listEpisodes(projectId: string, limit: number = 10, includeClosed: boolean = false): Promise<GetEpisodeResponse[]> {
    const response = await request<{ ok: boolean; episodes: GetEpisodeResponse[] }>('/episodes/list', 'POST', { projectId, limit, includeClosed });
    return response.episodes;
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
