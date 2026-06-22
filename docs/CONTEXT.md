# ContextLens — Consolidated Codebase Context

> Single-file reference for fast lookups, compact context, and quick responses. Read this before diving into subdirectories.
>
> **Scope:** entire monorepo as of 2026-06-20. Three subsystems: `vscode-extension/`, `src/` (backend), `contextlens-dashboard/`.

---

## 1. What is ContextLens

AI-driven dev companion. Captures coding **intent** in **episodes**, ships a VS Code extension for capture, an Express/Firestore backend for sync + AI, and a React dashboard for visualization. Tagline: "bridging the gap between code and context."

**Hierarchy:** `User → Project → Episode → Call` (+ `Settings`, `Idempotency`).

**Three pillars:**
1. **Capture** — extension watches files, git branch/commits, AI chat. Redacts secrets locally.
2. **Buffer + Sync** — offline-first queue (`cl_queue.json`) flushes in chunks of 5 every 30s (5s when >10 queued). Idempotency keys per item. Retries 5x.
3. **AI + Visualize** — Gemini (default via Vertex) analyzes diffs + branches; dashboard shows projects, episodes, AI summaries.

**Status:** v1.0.x, active dev. Dashboard v1.0.0, backend v0.1.0, extension v1.0.3 (Noventra-Labs publisher).

---

## 2. Repo layout

```
ContextLens/
├── src/                              # Backend (Express + Firebase Functions v2)
│   ├── index.js                      # Function v2 entrypoint
│   ├── firebase.js                   # Admin SDK singletons (db, auth)
│   ├── sentry.js                     # Sentry init (PII off, 0.1 sample)
│   ├── prompts.js                    # Gemini prompt templates
│   ├── routes/api.js                 # All authenticated endpoints
│   ├── services/ai.js                # callGemini — multi-provider wrapper
│   ├── middleware/
│   │   ├── auth.js                   # requireAuth (Firebase ID token)
│   │   ├── auditLog.js               # JSON stdout audit logger
│   │   ├── rateLimiter.js            # apiLimiter/authLimiter/aiLimiter
│   │   ├── requestId.js              # X-Request-Id propagation
│   │   └── validate.js               # express-validator rule chains
│   ├── lib/
│   │   ├── crypto.js                 # AES-256-GCM at-rest for API keys
│   │   ├── envCheck.js               # Required var validation
│   │   ├── errors.js                 # Canonical error model (18 codes)
│   │   └── redaction.js              # Secret pattern scrubbing
│   └── __tests__/                    # Jest: errors, redaction, auth
│
├── vscode-extension/                 # TypeScript extension (webpack bundled)
│   ├── src/
│   │   ├── extension.ts              # activate, command registration
│   │   ├── episodeStore.ts           # Active episode/project persistence
│   │   ├── syncEngine.ts             # cl_queue.json worker
│   │   ├── watchers.ts               # Git/file/workspace activity
│   │   ├── apiClient.ts              # HTTP client + 401 refresh
│   │   ├── auth.ts                   # vscode.UriHandler + SecretStorage
│   │   ├── mcpServer.ts              # Local HTTP server 127.0.0.1:3012
│   │   ├── chatViewProvider.ts       # Webview chat panel
│   │   ├── stateTreeProvider.ts      # Activity bar tree
│   │   ├── statusBar.ts              # Sync state indicator
│   │   ├── gitContext.ts             # git diff/branch/TODO snapshot
│   │   ├── redaction.ts              # 18 secret patterns
│   │   ├── telemetry.ts              # console.log event emitter
│   │   ├── EventDeduplicator.ts      # Time-window + debounce
│   │   ├── ErrorMapper.ts            # Error → user-friendly toast
│   │   └── NotificationService.ts    # Toast dedup router
│   ├── mcp-bridge.js                 # stdio→HTTP bridge for AI clients
│   ├── package.json                  # publisher: Noventra-Labs
│   ├── webpack.config.js
│   └── tsconfig.json
│
├── contextlens-dashboard/            # React + Vite + Tailwind
│   ├── src/
│   │   ├── main.tsx, routes/index.tsx
│   │   ├── types/index.ts
│   │   ├── lib/
│   │   │   ├── api.ts                # explainDiff/branchSummary/search
│   │   │   ├── firebase.ts           # auth + db singletons
│   │   │   ├── firestoreHooks.ts     # useProjects/useEpisodes/useCalls
│   │   │   └── utils.ts              # formatDate, copyToClipboard
│   │   ├── context/                  # AuthContext, SearchContext, ToastContext
│   │   ├── hooks/                    # useProjectSearch, useSyncStatus
│   │   ├── pages/                    # Home/Project/Branch/EpisodeDetail/Login/Settings/Setup/NotFound
│   │   ├── components/               # ai/, episodes/, layout/, projects/, ui/, ErrorBoundary, OfflineBanner
│   │   └── __tests__/                # Jest+RTL: ErrorBoundary, api
│   ├── package.json
│   └── .env.example
│
├── docs/                             # 9 markdown specs
├── firebase.json                     # Deploy: functions + hosting + auth + firestore
├── firestore.rules                   # UID-scoped access only
├── .firebaserc                       # Project: contextlens-backend-001
├── jest.config.js
├── package.json                      # Backend deps (Express, firebase-admin, vertex, etc.)
├── .env.example
└── ContextLens.code-workspace
```

---

## 3. Backend (`src/`)

### 3.1 Stack
- **Runtime:** Node 22, Express 5, Firebase Functions v2 (`onRequest`).
- **Firestore:** default DB, UID-scoped subcollections.
- **Auth:** Firebase Auth (Google provider). ID tokens verified via `auth.verifyIdToken`.
- **AI providers:** Gemini (Vertex AI by default, `@google/generative-ai` with custom key), OpenAI (`gpt-4o`), Anthropic (`claude-3-5-sonnet-latest`).
- **Observability:** Sentry (PII off, sample 0.1), `morgan('dev')` in dev, structured JSON in prod.

### 3.2 Request lifecycle
```
incoming → requestId → CORS allowlist → Helmet CSP → bodyParser (1mb) →
  /api strip → apiLimiter (100/15min) → requireAuth → router →
    validate → handleValidation → handler → auditLog → response
```
AI endpoints add `aiLimiter` (30/15min).

### 3.3 Endpoints (POST unless noted)

| Method | Path | Auth | Limiter | Notes |
|---|---|---|---|---|
| GET | `/api/auth/login` | public | authLimiter | HTML Google sign-in |
| POST | `/api/auth/exchange` | public | authLimiter | ID token → custom token |
| GET | `/api/_health` | public | — | Liveness |
| POST | `/api/projects/create` | yes | apiLimiter | `repoUrl` dedup on `(uid, repoUrl)` |
| POST | `/api/episodes/create` | yes | apiLimiter | Accepts client UUID; status `open` |
| POST | `/api/episodes/close` | yes | apiLimiter | Sets `status:'closed'` |
| POST | `/api/episodes/get` | yes | apiLimiter | Episode + all calls |
| POST | `/api/episodes/list` | yes | apiLimiter | Order by `startedAt desc`; `status=='open'` filter; `limit` 1-100 |
| GET | `/api/episodes/:episodeId` | yes | apiLimiter | Episode + callCount + 5 recent calls |
| POST | `/api/calls/log` | yes | **aiLimiter** | Idempotency, redact, increment `callCount` |
| POST | `/api/episodes/explain` | yes | **aiLimiter** | Cache at `episodes/{eid}/cache/{diffHash}`; Gemini |
| POST | `/api/branches/summarize` | yes | **aiLimiter** | Gemini PR summary |
| POST | `/api/search` | yes | apiLimiter | Bounded 50 episodes × 10 calls, cap 100 |
| POST | `/api/settings/get` | yes | apiLimiter | Returns `aiProvider` + `has{Provider}Key` flags only |
| POST | `/api/settings/update` | yes | apiLimiter | Provider whitelist: `none/gemini/openai/anthropic`; encrypts keys |

### 3.4 Data model (Firestore)

```
users/{uid}/
  projects/{projectId}/
    name, repoUrl, localWorkspaceName, defaultBranch, settings, timestamps
  projects/{projectId}/episodes/{episodeId}/
    label, branchName, status (open|closed), startedAt, endedAt,
    callCount, changedFiles, latestDiffHash, manualNotes
  projects/{projectId}/episodes/{episodeId}/calls/{callId}/
    promptText, modelResponse, modelName, source (extension|git_commit|manual_log|chat),
    branchName, activeFilePath, relatedFiles, diffSnapshot, diffHash,
    todoMatches, latencyMs, tokenUsage, status, createdAt
  projects/{projectId}/episodes/{episodeId}/cache/{diffHash}/
    Memoized explain-diff result
  settings/global/
    aiProvider, geminiApiKey (enc), openaiApiKey (enc), anthropicApiKey (enc)
  idempotency/{key}/
    Cached response
```

`firestore.rules` denies all except `users/{userId}/{document=**}` which requires `request.auth.uid == userId`.

### 3.5 Error model (`src/lib/errors.js`)

18 canonical codes; HTTP status map: 400/401/403/404/409/413/429/500/502/503/504.

**Codes:** `AUTH_ERROR`, `AUTH_EXPIRED`, `NETWORK_OFFLINE`, `NETWORK_TIMEOUT`, `VALIDATION_ERROR`, `PERMISSION_DENIED`, `RESOURCE_NOT_FOUND`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, `CONFLICT_ERROR`, `DUPLICATE_EVENT`, `STORAGE_WRITE_FAILED`, `AI_SERVICE_UNAVAILABLE`, `AI_RESPONSE_INVALID`, `FIRESTORE_ERROR`, `CONFIG_ERROR`, `INTERNAL_ERROR`.

**Wire shape:**
```json
{ "ok": false, "error": { "code", "message", "retryable", "requestId", "action", "details" } }
```
Never exposes `err.stack` to client (was a known leak at `routes/api.js:48-49`, fixed). Retryable/action maps drive client UX.

### 3.6 AI service (`src/services/ai.js` → `callGemini`)

- Redacts prompt via `redactText` before send.
- Resolves provider from `settings/global.aiProvider` or `gemini` default.
- Gemini path: custom key → `@google/generative-ai`; else Vertex AI; else `MOCK_RESPONSE` (truncated 400 chars).
- Model whitelist (`PROVIDER_DEFAULTS`): `gemini-1.5-pro`, `gpt-4o`, `claude-3-5-sonnet-latest`.
- `safeJsonParse` regex fallback to first `{...}` block.
- Race against `VERTEX_TIMEOUT_MS` (30000) via `createTimeoutPromise`.
- `generateWithRetry`: backoff `250ms × (attempt+1)`; retries on `/timeout|429|503|unavailable|resource exhausted/`.
- Default params: `temperature:0.2`, `maxOutputTokens:1024` (1024 for branches, 2048 for explain), `responseMimeType:'application/json'`.
- Returns `{id, model, text, structured, tokens}`.

**Prompt templates (`src/prompts.js`):**
- `explainDiffTemplate`: filenames + optional diff (truncated 8000); demands `{summary, risks[], checks[]}`.
- `branchSummaryTemplate`: user data wrapped in `---BEGIN/END USER DATA---` for injection mitigation; demands `{pr_summary, key_changes[], review_risks[]}`.

### 3.7 Middleware

- **`auth.js` (`requireAuth`)**: `Authorization: Bearer <token>` required. Maps `auth/expired` → `AUTH_EXPIRED`, other verify errors → `AUTH_ERROR`. Sets `req.user = {uid, email, name}`.
- **`rateLimiter.js`**: `apiLimiter` 100/15min, `authLimiter` 10/15min (IP), `aiLimiter` 30/15min. Key on uid-or-IP. Rejection body uses canonical `RATE_LIMITED`.
- **`validate.js`**: rule chains per route. UUID regex `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`. Source enum `['extension','git_commit','manual_log','chat']`. Caps: `promptText` 50k, `modelResponse` 100k, `changedFiles` ≤100, `episodes` ≤200.
- **`requestId.js`**: uses inbound `X-Request-Id` else `randomUUID()`; echoes header.
- **`auditLog.js`**: single `console.log(JSON.stringify({...}))`. Fields: `severity` (WARNING on AUTH_FAILURE else INFO), `eventType`, `timestamp`, `requestId`, `ip`, `uid`, `method`, `path`, `...details`.

### 3.8 Crypto (`src/lib/crypto.js`)

AES-256-GCM at-rest for user API keys. Format: `enc:v1:<ivHex>:<authTagHex>:<ciphertextHex>`. Key from `SETTINGS_ENCRYPTION_KEY` (64 hex or 32-byte string). `decrypt` returns original ciphertext on failure (no data loss).

### 3.9 Env vars

**Required:** `GOOGLE_CLOUD_PROJECT` (alias `GCLOUD_PROJECT`), `CLIENT_FIREBASE_API_KEY`, `CLIENT_FIREBASE_AUTH_DOMAIN`, `CLIENT_FIREBASE_PROJECT_ID`.
**Prod-required (throws if missing):** `SETTINGS_ENCRYPTION_KEY`.
**Optional:** `VERTEX_LOCATION=us-central1`, `VERTEX_MODEL=gemini-1.5-pro`, `VERTEX_TIMEOUT_MS=30000`, `VERTEX_RETRY_ATTEMPTS=2`, `USE_VERTEX=true`, `ALLOWED_ORIGINS` (default `localhost:3000,vscode-webview://*`), `SENTRY_DSN`, `NODE_ENV`, `K_SERVICE` (prod detect).

---

## 4. VS Code Extension (`vscode-extension/`)

### 4.1 Stack
TypeScript, webpack-bundled, target Node. Publisher: **Noventra-Labs**, name: `contextlens`, version 1.0.3. Activation: `onStartupFinished` or `onView:contextlens.stateTree` / `onView:contextlens.chatView`.

### 4.2 Commands registered

| Command | Purpose |
|---|---|
| `contextlens.signIn` | Open browser Firebase sign-in |
| `contextlens.signOut` | Clear SecretStorage, fire onDidSignOut |
| `contextlens.newEpisode` | Prompt label, `createEpisode` |
| `contextlens.closeEpisode` | `closeEpisode` |
| `contextlens.explainDiff` | MD5-hash diff, call explainDiff, render webview |
| `contextlens.summarizeBranch` | Call branchSummary, toast |
| `contextlens.openDashboard` / `…Episode` / `…Branch` | Open external dashboard URL |
| `contextlens.logExternalCall` | Quickpick + 3 input boxes → `enqueueCall(manual_log)` |
| `contextlens.configureProvider` | Pick provider, store BYO key in SecretStorage |
| `contextlens.copyMcpConfig` | Write mcp-bridge config JSON to clipboard |
| `contextlens.autoSetupMcp` | Patch Claude Desktop + Cursor MCP configs (with `.bak` backups) |

### 4.3 File save → sync flow
```
onDidSaveTextDocument
  → watchers.watchFileSaves (ext allowlist)
  → EventDeduplicator.debounce('file_save', absPath, 500ms)
  → episodeStore.addChangedFile(relPath)
  → workspaceState.update
  → onDidChangeEmitter.fire → stateTree.refresh + statusBar.render
```

### 4.4 Sync engine (`syncEngine.ts`)

- **Queue file:** `globalStorageUri/cl_queue.json` (last 100 items; `.backup.<ts>` on corruption).
- **Flush cadence:** 30s baseline, 5s when queue > 10.
- **Chunks:** 5/batch, 200ms delay between items.
- **Retries:** max 5, then drop. 404 = permanent drop.
- **Connectivity probe:** GET `/api/_health` every 15s.
- **States:** `idle | pending | syncing | synced | retrying | offline | paused-auth | failed`.
- **Idempotency:** per-item `X-Idempotency-Key` header.
- **401 handling:** `apiClient.tryRefreshToken` → retry once → `handleSessionExpired` notification.

### 4.5 Watchers (`watchers.ts`)

- `.git/HEAD` watcher → branch switch (2s cooldown) → close + auto-create.
- `.git/COMMIT_EDITMSG` watcher → 1s debounce → `enqueueCall` with redacted diff.
- `onDidSaveTextDocument` → ext allowlist → dedup.debounce(500ms) → `addChangedFile`.
- `onDidChangeWorkspaceFolders` → ensureProject + autoInit.
- Watches workspace root for `.git` appearance (init).
- 45-min proactive token refresh.
- 1h stale episode check (>24h idle) → prompt to close.
- Smart episode naming: branch + last commit.
- Diff truncation at 6000 chars.

### 4.6 Auth (`auth.ts`)

- `vscode://` URI handler for sign-in callback.
- Firebase custom token → idToken + refreshToken via `identitytoolkit`; refresh via `securetoken.googleapis.com`.
- **SecretStorage keys:** `contextlens.auth.idToken`, `contextlens.auth.refreshToken`, `contextlens.auth.uid`.
- Legacy migration: `globalState contextlens.global.*` → SecretStorage, then delete.
- 45-min scheduled refresh.
- uri-scheme guard: falls back to `vscode` if undefined/`'undefined'`/throws.
- Events: `onDidSignIn`, `onDidSignOut`.

### 4.7 API client (`apiClient.ts`)

- Base: `https://contextlens-backend-001.web.app/api`.
- 15s timeout via `http`/`https` native modules (not `fetch`).
- 401 → `tryRefreshToken` → retry once → `handleSessionExpired`.
- `ErrorMapper` maps backend codes to user-friendly notifications.

### 4.8 MCP server (`mcpServer.ts`) + bridge (`mcp-bridge.js`)

**Local HTTP server:** `http://127.0.0.1:3012`, random 32-byte hex secret per session, `X-MCP-Secret` header required. CORS: `*`. Endpoints:
- `GET /status` → `{projectId, episodeId, authenticated}`
- `POST /start-episode`, `/close-episode`, `/log-call`, `/explain-diff`
- `POST /search`, `/get-episode`, `/list-episodes`, `/explain-past-changes`

**Bridge (stdio):** line-buffered JSON-RPC 2.0 over stdin/stdout. `protocolVersion: 2024-11-05`. All `console.*` redirected to stderr to protect stdout. Reads `CONTEXTLENS_MCP_SECRET` from env. 9 tools: `get_status`, `start_episode`, `close_episode`, `log_ai_call`, `explain_diff`, `search_context`, `get_episode_details`, `get_recent_episodes`, `explain_past_changes`. ECONNREFUSED → user-friendly error.

### 4.9 Redaction (`redaction.ts`)

18 patterns: OpenAI, OpenAI proj, AWS, GitHub PAT/fine-grained, Google, Slack, Stripe, NPM, Twilio, SendGrid, JWT, env KEY=value, connection strings, email, IPv4, SSH private keys, plus backend's `AIza...` (GCP), PEM, `gh[pous]_...`, `xox[baprs]-...`. `redact(content)` sequential replace. `containsSensitive(content)` pre-check.

### 4.10 Support classes
- **`EventDeduplicator`**: windows — `file_save 500ms`, `commit 5s`, `branch_switch 2s`, `metadata 2s`. 60s cleanup, `dispose()` cancels all.
- **`ErrorMapper`**: 16 mapped codes (matches backend), network/timeout pattern detection, HTTP status fallback, action button tied to command or retry.
- **`NotificationService`**: 4 levels (success/info/warning/error), 30s dedup per message, `fromMapped()` dispatch, `showWithActions()` with primary/secondary buttons, 60s cleanup.
- **`Telemetry`**: console.log event logger.
- **`GitContext`**: `git rev-parse --is-inside-work-tree`, branch, full diff, active editor file, TODO/FIXME/HACK markers.
- **`StateTreeProvider`**: activity bar tree; roots = Sign in / Auth badge / Active episode (branch, calls, changed files, actions, note).
- **`StatusBar`**: states = sign-in (warning), ready (prominent), active episode (prominent/offline); shows pending count.

### 4.11 Persistence summary

| Layer | Key / Path | Owner |
|---|---|---|
| SecretStorage | `contextlens.auth.idToken` / `.refreshToken` / `.uid` | AuthManager |
| SecretStorage | `contextlens.apiKey.{provider}`, `contextlens.activeProvider` | extension.ts |
| workspaceState | `contextlens.activeEpisode`, `.projectId`, `.projectName` | EpisodeStore |
| globalStorageUri | `cl_queue.json` (+ `.backup.<ts>`) | SyncEngine |
| File | `%APPDATA%/Claude/claude_desktop_config.json` | extension.ts autoSetupMcp |
| File | `%APPDATA%/Cursor/.../settings.json` | extension.ts autoSetupMcp |

---

## 5. Dashboard (`contextlens-dashboard/`)

### 5.1 Stack
React 18 + Vite + Tailwind + react-router-dom v6 + framer-motion + lucide-react + react-diff-viewer-continued. Firebase v12 SDK. TypeScript. Jest + RTL for tests.

### 5.2 Routes

| Path | Page | Guard |
|---|---|---|
| `/` | → `/dashboard` redirect | none |
| `/login` | LoginPage | none |
| `/dashboard` | HomePage (index in AppShell) | ProtectedRoute |
| `/dashboard/:projectId` | ProjectPage | ProtectedRoute |
| `/dashboard/:projectId/episodes/:episodeId` | EpisodeDetailPage | ProtectedRoute |
| `/dashboard/:projectId/branch/:branchName` | BranchPage | ProtectedRoute |
| `/dashboard/settings` | SettingsPage | ProtectedRoute |
| `/dashboard/setup` | SetupPage | ProtectedRoute |
| `*` | NotFoundPage | none |

All wrapped by `<ErrorBoundary>` in `AppRouter`. `ProtectedRoute` waits on `useAuth().loading`, then lazy Suspense.

### 5.3 Lib API (`src/lib/api.ts`)

- `explainDiff(projectId, episodeId)` → `POST /episodes/explain`.
- `branchSummary(projectId, branchName, episodes[])` → `POST /branches/summarize`.
- `search(projectId, query, filters?)` → `POST /search`. Filters: `branchName`, `filePath`, `dateFrom`, `dateTo`. Returns `{episodes[], calls[]}`.
- `post()`: 30s AbortController, 2x retry on 5xx with backoff, friendly errors (UNAUTHORIZED / API_ERROR_429 / 500 / 503 / TIMEOUT / NETWORK_ERROR).
- Base URL: `import.meta.env.VITE_API_BASE_URL`.
- Bearer: `auth.currentUser.getIdToken()`.

### 5.4 Firestore hooks (`src/lib/firestoreHooks.ts`)

All real-time via `onSnapshot` with 3s timeout fallback. Memoized by `queryKey` (`useFirestoreQuery`).

| Hook | Query | Sort |
|---|---|---|
| `useProjects(uid)` | `users/{uid}/projects` | `updatedAt desc` |
| `useUserSettings(uid)` | `users/{uid}/settings/global` | — |
| `useEpisodes(uid, projectId)` | `…/episodes` | `startedAt desc` |
| `useEpisodesByBranch(uid, projectId, branchName)` | `…/episodes` + `where branchName==` | `startedAt asc` |
| `useEpisode(uid, projectId, episodeId)` | `…/episodes/{episodeId}` | — |
| `useRecentEpisodes(uid, limit=5)` | fanout N episodes/project, merge sort by `startedAt desc` | merged + sliced |
| `useCalls(uid, projectId, episodeId, enabled)` | `…/episodes/{episodeId}/calls` | `createdAt asc` |

### 5.5 Env vars (dashboard)
- `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.
- `VITE_API_BASE_URL=https://us-central1-contextlens-backend-001.cloudfunctions.net/api`.
- Missing required vars log to console (do not crash).

### 5.6 Components
- **AI:** `BranchSummaryCard`, `ExplainDiffCard`.
- **Episodes:** `CallItem`, `DiffViewer`, `EpisodeCard`, `EpisodeTimeline`, `RecentEpisodeItem`.
- **Layout:** `AppShell` (Outlet), `Sidebar`, `TopBar`.
- **UI:** `Badge`, `CopyButton`, `EmptyState`, `ErrorMessage`, `SkeletonCard`, `Spinner`.
- **Other:** `ErrorBoundary` (with "Technical details" + "Reload" + "Try Again"), `OfflineBanner`, `ProjectCard`.

### 5.7 Contexts
- `AuthContext` — Firebase auth state, `signInWithGoogle`, `signInWithGithub`, `fetchProviders`, `linkAccount`.
- `SearchContext` — `setSearchQuery` consumed by HomePage.
- `ToastContext` — toast queue.

### 5.8 Utils (`src/lib/utils.ts`)
`formatDate`, `formatDateShort`, `timeAgo`, `timeDuration`, `copyToClipboard`, `truncate`, `countDiffLines`.

---

## 6. Cross-cutting facts

### 6.1 Security invariants
- **Zero-Gemini rule:** AI never auto-invoked by watchers/sync engine. Button-only triggers (`explainDiff`, `summarizeBranch`).
- Redaction happens locally in extension before data leaves machine.
- Credentials in `vscode.SecretStorage` (not globalState).
- `users/{uid}/...` Firestore scoping; ownership verified on backend via `verifyProjectOwnership` / `verifyEpisodeOwnership`.
- AES-256-GCM at-rest encryption for user API keys (`SETTINGS_ENCRYPTION_KEY`).
- Idempotency keys prevent duplicate writes.
- CORS allowlist; Helmet CSP; no wildcard CORS in prod.
- No stack traces in client responses (fix landed).
- Reporting: `security@contextlens.dev`, 48h ack SLA. Support matrix v1.0.x only.

### 6.2 Deploy / hosting
- Project: `contextlens-backend-001` (alias: `default`).
- `firebase.json`: functions source `.` (excludes `vscode-extension/`, `contextlens-dashboard/`, `context/`, `dashboard/`); hosting public `contextlens-dashboard/dist`; rewrites `/api/**` → `api` function, `**` → `/index.html` (SPA).
- Hosting headers: COOP `same-origin-allow-popups`, X-Content-Type-Options `nosniff`, X-Frame-Options `DENY`, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy disables camera/mic/geo. `assets/**` → `Cache-Control: public, max-age=31536000, immutable`.

### 6.3 Known issues / history (from `VERSIONS_AND_FIXES.md`)
- **KI-001 shipped:** dual-storage (SecretStorage + globalState) with 45-min token refresh.
- **KI-002 shipped:** auth-state guard in `apiClient.ts.request()` with non-intrusive "Sign in" notification.
- 18 regex redaction rules in `redaction.ts`.
- CLI extracted as standalone `cl` with `~/.contextlens/config.json`.
- Fix registry FL-001…FL-007. Backlog ENH-001…ENH-015.

### 6.4 OWASP audit highlights (2026-05-19)
- **A05 HIGH:** `err.stack` leak in `/projects/create` (fixed). `firestore.rules` locked down. `dev project-ID fallback` removed.
- **A04 Medium:** no rate limit (now added); wildcard CORS (now allowlist); input validation (now express-validator).
- **A02 Medium:** hardcoded Firebase config in `src/index.js` lines 170-174.
- **A09 Medium:** `morgan('dev')` in prod; no audit logging on auth/delete (now `auditLog`).
- **A07 Low:** no App Check yet.

### 6.5 Phase priorities (from `contextlens-final-enhancement-plan.md`)
1. **Immediate:** validation, rate limit, CORS, Helmet, requestId.
2. **Stability:** dedup, idempotency, ownership.
3. **Speed/UX:** batching, React Query.
4. **Long-term:** SQLite queue, team RBAC.

### 6.6 Test coverage
- **Backend:** `src/__tests__/lib/errors.test.js`, `src/__tests__/lib/redaction.test.js`, `src/__tests__/middleware/auth.test.js`. Coverage 0 thresholds (placeholder).
- **Dashboard:** `src/__tests__/components/ErrorBoundary.test.tsx`, `src/__tests__/lib/api.test.ts`. Mocks `firebase` for `auth.currentUser.getIdToken`.
- **Extension:** mocha test script (no test files in src yet).

---

## 7. Quick reference: the 18 error codes

| Code | HTTP | Retryable | Action |
|---|---|---|---|
| `AUTH_ERROR` | 401 | false | signin |
| `AUTH_EXPIRED` | 401 | false | signin |
| `NETWORK_OFFLINE` | 503 | true | retry |
| `NETWORK_TIMEOUT` | 504 | true | retry |
| `VALIDATION_ERROR` | 400 | false | fix_input |
| `PERMISSION_DENIED` | 403 | false | contact_support |
| `RESOURCE_NOT_FOUND` | 404 | false | none |
| `RATE_LIMITED` | 429 | true | retry |
| `PAYLOAD_TOO_LARGE` | 413 | false | reduce_size |
| `CONFLICT_ERROR` | 409 | false | retry |
| `DUPLICATE_EVENT` | 409 | false | none |
| `STORAGE_WRITE_FAILED` | 500 | true | retry |
| `AI_SERVICE_UNAVAILABLE` | 503 | true | retry |
| `AI_RESPONSE_INVALID` | 502 | true | retry |
| `FIRESTORE_ERROR` | 500 | true | retry |
| `CONFIG_ERROR` | 500 | false | contact_support |
| `INTERNAL_ERROR` | 500 | false | contact_support |

(Note: `PAYLOAD_TOO_LARGE` canonical code mapped to 413 in this table; backend `STATUS_MAP` includes 413. Per docs it appears as a recognized code.)

---

## 8. Common patterns

- **Adding a new AI call:** add prompt to `src/prompts.js`, add route in `src/routes/api.js` under `aiLimiter`, add validate rules, call `callGemini`, audit log.
- **Adding a new redaction pattern:** append to `redaction.rules` array in both `vscode-extension/src/redaction.ts` and `src/lib/redaction.js`. Backend re-runs redaction on stored prompts/responses.
- **Adding a new VS Code command:** register in `package.json` `contributes.commands`, implement in `extension.ts`, optional keybinding in `keybindings` (gated on `contextlens.enableShortcuts`).
- **Adding a new dashboard page:** create in `src/pages/`, add to `routes/index.tsx`, add nav item in `Sidebar.tsx`/`TopBar.tsx`.
- **Adding a new MCP tool:** add to `mcp-bridge.js` `tools/list` and `tools/call` switch, add HTTP route in `vscode-extension/src/mcpServer.ts`.
- **Settings:** provider whitelist `['none','gemini','openai','anthropic']` enforced backend-side; keys encrypted via `lib/crypto.js` before Firestore write.

---

## 9. File-to-purpose index (compact)

### Backend (`src/`)
| File | One-liner |
|---|---|
| `index.js` | Function v2 entry; middleware stack; public auth routes; global error handler; SIGTERM/SIGINT |
| `firebase.js` | Admin SDK init; `db`, `auth` singletons |
| `sentry.js` | Sentry google-cloud-serverless + profiling init |
| `prompts.js` | `explainDiffTemplate`, `branchSummaryTemplate` (injection-safe) |
| `routes/api.js` | All authenticated endpoints; ownership/idempotency/encryption helpers |
| `services/ai.js` | `callGemini` multi-provider wrapper with retry + timeout |
| `middleware/auth.js` | `requireAuth` — Firebase ID token verify |
| `middleware/auditLog.js` | JSON stdout audit logger |
| `middleware/rateLimiter.js` | `apiLimiter`/`authLimiter`/`aiLimiter` |
| `middleware/requestId.js` | X-Request-Id propagation |
| `middleware/validate.js` | express-validator rule chains per route |
| `lib/crypto.js` | AES-256-GCM at-rest encryption |
| `lib/envCheck.js` | Required var validation; throws/warns |
| `lib/errors.js` | 18-code canonical error model |
| `lib/redaction.js` | Secret pattern scrubbing (text + deep) |

### Extension (`vscode-extension/src/`)
| File | One-liner |
|---|---|
| `extension.ts` | Activate, command registry, sign-in flow, MCP auto-setup |
| `episodeStore.ts` | Active episode/project persistence (workspaceState) |
| `syncEngine.ts` | Offline-first queue worker (cl_queue.json) |
| `watchers.ts` | Git/file/workspace activity → store + sync |
| `apiClient.ts` | HTTPS client + 401 refresh; 15s timeout |
| `auth.ts` | vscode.UriHandler sign-in; SecretStorage tokens |
| `mcpServer.ts` | Local HTTP 127.0.0.1:3012 with X-MCP-Secret |
| `chatViewProvider.ts` | Webview chat; logs messages as AI calls |
| `stateTreeProvider.ts` | Activity bar tree; auth + episode state |
| `statusBar.ts` | Status bar; sync state indicator |
| `gitContext.ts` | Git diff/branch/TODO snapshot |
| `redaction.ts` | 18 secret patterns; sequential replace |
| `telemetry.ts` | console.log event emitter |
| `EventDeduplicator.ts` | Time-window dedup + debounce |
| `ErrorMapper.ts` | Error → user-friendly notification |
| `NotificationService.ts` | Toast dedup router; 4 levels |

### Dashboard (`contextlens-dashboard/src/`)
| File | One-liner |
|---|---|
| `main.tsx` | React root; wraps `<AppRouter>` |
| `routes/index.tsx` | Router with `ProtectedRoute`; ErrorBoundary |
| `lib/api.ts` | `explainDiff`/`branchSummary`/`search` w/ 30s timeout + retry |
| `lib/firebase.ts` | `auth` + `db`; browserLocalPersistence |
| `lib/firestoreHooks.ts` | 7 useX hooks via onSnapshot |
| `lib/utils.ts` | Date formatting, clipboard, truncate, diff line count |
| `context/AuthContext.tsx` | Firebase auth state + providers |
| `context/SearchContext.tsx` | Search query state |
| `context/ToastContext.tsx` | Toast queue |
| `pages/HomePage.tsx` | Welcome + project grid + recent episodes |
| `pages/ProjectPage.tsx` | Episode timeline + filters + project delete |
| `pages/BranchPage.tsx` | Branch episodes + AI PR summary button |
| `pages/EpisodeDetailPage.tsx` | Episode header + Explain-Diff + calls list |
| `pages/LoginPage.tsx` | Google/GitHub sign-in |
| `pages/SettingsPage.tsx` | Profile, sign-out, VS Code connect, CLI token, AI provider+keys |
| `pages/SetupPage.tsx` | 3-step install/auth/init guide |
| `pages/NotFoundPage.tsx` | 404 |
| `components/ErrorBoundary.tsx` | Fallback UI w/ technical details + reload + try again |
| `components/OfflineBanner.tsx` | Connectivity indicator |

---

## 10. End-to-end data flow (full capture → dashboard render)

```
1. Developer saves file in VS Code
   ↓ onDidSaveTextDocument
2. watchers.ts → EventDeduplicator (500ms) → episodeStore.addChangedFile
   ↓ workspaceState persists
3. Developer runs AI action (commit / chat send / explicit log)
   ↓ watchers.ts or chatViewProvider.ts or extension.ts command
4. episodeStore.enqueueCall → syncEngine.enqueue (type, endpoint, payload, idempotencyKey)
   ↓ saves to cl_queue.json (last 100)
5. setInterval(30s or 5s) → syncEngine.flush
   ↓ chunked 5/batch, 200ms delay
6. apiClient.request() → POST https://contextlens-backend-001.web.app/api/calls/log
   ↓ X-Idempotency-Key header
7. Firebase Function v2: requestId → apiLimiter → requireAuth → validate → handler
   ↓ verifyProjectOwnership, verifyEpisodeOwnership
8. handlers redact (lib/redaction.js), store in Firestore under
   users/{uid}/projects/{pid}/episodes/{eid}/calls/{cid}
   ↓ auditLog
9. User opens dashboard → LoginPage (Google sign-in) → HomePage
   ↓ onSnapshot (real-time)
10. useEpisodes / useCalls subscribe to Firestore
    ↓ EpisodeCard / EpisodeTimeline / CallItem render
11. User clicks "Explain Diff" → EpisodeDetailPage → api.explainDiff
    → POST /episodes/explain → callGemini → cache → return
12. ExplainDiffCard renders AI response
```

---

**End of context file.** When asked about a specific subsystem, read CONTEXT.md first, then dive into the relevant section. Update this file when subsystems change.
