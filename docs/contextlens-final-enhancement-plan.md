ContextLens Final Enhancement Plan

This document describes:
1. What can be enhanced
2. How each part behaves and works together
3. What to use to fix current issues
4. How to handle every major error class with user-friendly responses
5. How to improve logging, toast notifications, and execution speed

====================================================================
1. SYSTEM BEHAVIOR — HOW EVERYTHING WORKS TOGETHER
====================================================================

ContextLens is a multi-part system made of:
- VS Code Extension
- CLI tool (cl)
- Backend API (Firebase Functions + Express)
- Firestore database
- Web Dashboard
- AI analysis layer (Gemini / Vertex AI)

Normal flow:
1. The developer works inside VS Code.
2. The extension watches branch changes, file saves, commits, and AI-related actions.
3. The extension enriches that event with context such as branch name, active file, diff snapshot, and metadata.
4. The Sync Engine stores the event in a local buffer first.
5. The Sync Engine sends buffered items to the backend in batches.
6. The backend validates auth, sanitizes input, stores data in Firestore, and optionally calls AI services.
7. The dashboard reads Firestore data and shows projects, episodes, calls, timelines, and summaries.
8. The CLI supports the same ecosystem for terminal-first users and CI/CD flows.

Design principle:
- Capture automatically
- Buffer locally first
- Sync safely
- Analyze only when needed
- Present clearly
- Never interrupt the developer unless action is truly required

====================================================================
2. WHAT TO ENHANCE
====================================================================

A. VS Code Extension Enhancements
- Stronger auth recovery after restart or workspace switch
- Better deduplication for repeated commit/file-save events
- Multi-root workspace handling
- Better offline queue visibility
- Better episode state recovery after abrupt shutdown
- Friendlier toasts and status bar feedback
- Faster sync batching and event coalescing

B. CLI Enhancements
- Auto-create episode if none exists before log-call
- Better token validation before command execution
- More descriptive command errors
- Dry-run support for sync and init
- Better terminal summaries after sync

C. Backend Enhancements
- Strict request validation for every route
- Safe sanitized error responses only
- Rate limiting on all write and AI endpoints
- Restricted CORS configuration
- Security headers with Helmet
- Structured logs with request IDs
- Better batching and idempotency handling

D. Dashboard Enhancements
- Better empty states
- Better loading states
- Sync status visibility
- Inline retry actions for failed fetches
- Better diff loading performance
- User-friendly explanations for auth/session/network issues

E. Security Enhancements
- Remove stack trace leakage
- Validate all IDs and URLs
- Replace permissive CORS with allowlist
- Add payload size limits
- Add audit logging for sensitive flows
- Add environment variable validation at boot
- Add dependency scanning and CI checks

F. Performance Enhancements
- Event deduplication before enqueue
- Smarter flush intervals based on queue size
- Parallel safe reads where possible
- Firestore write batching
- Lazy loading in dashboard
- Cache stable project metadata
- Avoid unnecessary AI calls

====================================================================
3. WHAT TO USE TO FIX THINGS
====================================================================

Recommended tools and libraries:

Backend:
- zod: request body/query validation
- express-rate-limit: rate limiting
- helmet: security headers
- pino or pino-http: structured logging
- nanoid or uuid: safe generated IDs where needed
- express-slow-down: optional abusive client slowdown
- Firebase App Check: stronger client verification if feasible

Extension:
- vscode.SecretStorage for sensitive credentials
- globalState/workspaceState with versioned keys
- AbortController for cancellable API calls
- debouncing/throttling utilities for save events
- dedicated NotificationService abstraction
- dedicated ErrorMapper abstraction

Dashboard:
- React Query / TanStack Query for caching, retries, stale data handling
- Error boundaries for page/module crashes
- Suspense-friendly lazy modules where suitable
- Virtualized lists for long timelines

CLI:
- commander improvements with validators
- chalk or picocolors for readable terminal messages
- ora for non-blocking spinner UX
- zod for local config validation

Observability:
- requestId correlation
- per-route timing logs
- sync metrics: pending, flushed, failed, retried
- error categories and machine-readable codes

====================================================================
4. CORE ERROR HANDLING STRATEGY
====================================================================

Every error should pass through the same pipeline:
1. Detect error
2. Classify error
3. Attach machine code and human-safe message
4. Log detailed internal context privately
5. Show short, useful user message
6. Offer retry or recovery action when relevant
7. Avoid blaming the user
8. Never expose stack traces, secrets, raw tokens, or internal payloads

Required error object shape everywhere:
- code: machine-readable code (AUTH_EXPIRED, NETWORK_OFFLINE, RATE_LIMITED)
- severity: info | warning | error | critical
- userMessage: short plain-language message
- devMessage: internal diagnostic details
- retryable: true/false
- action: login | retry | refresh | openLogs | contactSupport | none
- requestId: unique trace ID
- timestamp
- source: extension | cli | backend | dashboard

Suggested canonical error categories:
- AUTH_ERROR
- AUTH_EXPIRED
- NETWORK_OFFLINE
- NETWORK_TIMEOUT
- VALIDATION_ERROR
- PERMISSION_DENIED
- RESOURCE_NOT_FOUND
- RATE_LIMITED
- PAYLOAD_TOO_LARGE
- CONFLICT_ERROR
- DUPLICATE_EVENT
- STORAGE_WRITE_FAILED
- AI_SERVICE_UNAVAILABLE
- AI_RESPONSE_INVALID
- FIRESTORE_ERROR
- CONFIG_ERROR
- INTERNAL_ERROR

====================================================================
5. USER-FRIENDLY ERROR RESPONSES AND TOAST DESIGN
====================================================================

General toast rules:
- Success toasts should be brief and disappear automatically
- Warning toasts should explain what is happening and whether action is needed
- Error toasts should include one clear next step
- Never show raw JSON, stack traces, token errors, HTTP dumps, or Firebase internals
- Use consistent wording across extension, dashboard, and CLI
- Important failures should also have “View details” or “Retry” actions

Toast types:
- Success: green/positive, 2–4 seconds
- Info: neutral, 3–5 seconds
- Warning: amber, persistent until read or actioned when needed
- Error: red, persistent if action is required

Examples:
- Auth expired: “Session expired. Sign in again to continue syncing.”
- Offline: “You’re offline. Changes are saved locally and will sync automatically.”
- Sync failed: “Couldn’t sync 3 updates. Retrying in 30 seconds.”
- Validation: “Some data was incomplete and wasn’t sent. Review details.”
- Rate limited: “Too many requests right now. Trying again shortly.”
- AI unavailable: “AI summary is temporarily unavailable. Your work is still saved.”
- Success sync: “All changes synced.”
- Episode created: “New episode started for this branch.”
- Duplicate ignored: “Repeated event skipped to avoid duplicate logs.”

Toast action rules:
- Retry: for retryable network/backend issues
- Sign in: for auth expiration
- Open logs: only for developers and only from extension/CLI advanced details
- Refresh page: for stale dashboard auth/data mismatch
- Dismiss: for non-blocking warnings

====================================================================
6. ERROR HANDLING BY COMPONENT
====================================================================

6.1 VS Code Extension

Possible errors:
- No auth token found
- Expired token
- URI auth callback missing token
- Sync queue write failure
- Local storage corruption
- Git repo not found
- Branch detection failed
- File save watcher duplicate storms
- API timeout
- Backend validation failure
- Workspace switch during active sync
- Extension host restart

Required behavior:
- No token found:
  - status bar: “Sign in required”
  - toast: “Sign in to start syncing development context.”
  - action: Sign in
- Expired token:
  - silently try refresh first
  - if refresh fails, pause sync and show toast
  - do not discard queue
- Offline:
  - queue events locally
  - status bar: “Offline • X pending”
  - info toast once, not repeatedly
- Git repo not found:
  - non-blocking warning: “This folder is not a Git repository yet. Some features are disabled.”
- Branch switch error:
  - keep old episode active until new branch resolution succeeds
  - log warning, avoid auto-closing episode prematurely
- File save storm:
  - debounce saves per file for a short interval
  - merge repeated updates into one queue item
- Buffer corruption:
  - back up invalid buffer file
  - create clean buffer
  - toast: “Local sync cache was repaired. Recent unsynced data may need review.”

Recommended implementation:
- NotificationService.ts
- ErrorMapper.ts
- SyncStateMachine.ts with states: idle, pending, syncing, synced, retrying, offline, paused-auth, failed
- EventDeduplicator.ts
- RecoveryManager.ts

6.2 CLI

Possible errors:
- Missing token
- Missing project config
- No active episode
- Invalid command arguments
- Network failure
- Backend rejection
- Token expired

Required behavior:
- Missing token:
  - “Not signed in. Run: cl auth <token>”
- Missing local config:
  - “Project not initialized here. Run: cl init <project-id>”
- No active episode:
  - auto-create episode if safe, else say:
    “No active episode found. Start one or enable auto-create.”
- Invalid args:
  - show command help and one-line example
- Sync result:
  - “Synced 8 items, skipped 2 duplicates, 1 retry scheduled.”

6.3 Backend

Possible errors:
- Invalid JSON/body
- Missing auth header
- Invalid Firebase ID token
- Missing required fields
- Invalid projectId/episodeId
- Firestore write failure
- AI timeout
- AI malformed response
- Rate limit exceeded
- Payload too large
- Internal exception

Required API response format:
{
  ok: false,
  error: {
    code,
    message,
    retryable,
    requestId
  }
}

Rules:
- Never return err.stack to the client
- Log internal stack privately with requestId
- Return short clean messages only
- Attach proper HTTP status code

Recommended status handling:
- 400 VALIDATION_ERROR
- 401 AUTH_REQUIRED / AUTH_EXPIRED
- 403 PERMISSION_DENIED
- 404 RESOURCE_NOT_FOUND
- 409 CONFLICT_ERROR / DUPLICATE_EVENT
- 413 PAYLOAD_TOO_LARGE
- 429 RATE_LIMITED
- 500 INTERNAL_ERROR
- 503 AI_SERVICE_UNAVAILABLE

6.4 Dashboard

Possible errors:
- User not logged in
- Session expired
- Firestore hook failure
- Empty project state
- Network timeout
- Route data missing
- Diff too large or slow to render

Required UX:
- Empty state should explain what to do next
- Expired session should show login prompt, not raw auth exception
- Failed fetch should show retry button inline
- Skeleton loaders should appear before network completes
- Large timeline should virtualize rows
- AI explanation failures should not break episode page

Suggested messages:
- “No projects yet. Connect a repository from VS Code or the CLI to start tracking context.”
- “This session expired. Sign in again to continue.”
- “Couldn’t load this episode right now. Try again.”
- “The diff is large, so a simplified preview is shown first.”

====================================================================
7. HOW EACH PART SHOULD BEHAVE TOGETHER DURING FAILURES
====================================================================

Case A: User goes offline while coding
- Extension continues capturing locally
- No data loss
- Status bar changes to offline/pending
- One info toast only
- Dashboard later shows synced state once connection returns
- CLI sync should also queue if offline mode exists

Case B: Auth token expires during sync
- Extension pauses outgoing sync
- Queue remains local
- Silent refresh attempted
- If refresh fails, ask user to sign in
- After sign-in, queue resumes automatically
- Dashboard should say session expired without losing already-rendered state

Case C: Backend rejects malformed payload
- Backend returns VALIDATION_ERROR with requestId
- Extension marks item failed but keeps it quarantined
- User sees: “One update couldn’t be sent because some data was incomplete.”
- Advanced details available in logs only
- Remaining valid items continue syncing

Case D: Firestore temporary outage
- Backend returns retryable FIRESTORE_ERROR or 503
- Extension retries with exponential backoff
- User sees: “Cloud storage is temporarily unavailable. Retrying automatically.”
- No repeated spam toasts

Case E: AI service fails
- Store core event first
- AI processing should be optional and isolated
- User sees: “AI summary is temporarily unavailable. Your activity was still saved.”
- Dashboard can show retry summary action later

Case F: Duplicate events from watcher storms
- Extension deduplicates before enqueue
- Backend also supports idempotency key check
- User normally sees nothing
- Optional debug log: duplicate skipped

====================================================================
8. HOW TO FIX ALL CURRENT KNOWN ISSUES
====================================================================

1. Error stack leakage
Fix:
- Remove err.stack from all API responses
- Replace with sanitized mapError result
- Keep full details only in server logs with requestId

2. Missing rate limiting
Fix:
- Add express-rate-limit middleware
- Per-route limits for AI endpoints and write-heavy endpoints
- Add friendly 429 message and Retry-After header

3. Overly permissive CORS
Fix:
- Replace app.use(cors()) with origin allowlist
- Allow dashboard domains, local dev domains, and required extension origins only

4. Hardcoded Firebase config in login HTML
Fix:
- Inject from environment variables
- Validate required config at boot

5. Insufficient input validation
Fix:
- Add zod schemas for body/query/params
- Reject invalid repoUrl, IDs, branch names, payload lengths

6. Missing security headers
Fix:
- Add helmet with CSP tuned for Firebase auth/login flow

7. Missing graceful shutdown handling
Fix:
- Add SIGTERM/SIGINT handlers
- Stop accepting new requests, flush logs, finish in-flight work where possible

8. Default project ID fallback
Fix:
- Remove hardcoded fallback in production
- Fail fast on missing GOOGLE_CLOUD_PROJECT

9. Development logging in production
Fix:
- Replace morgan dev with structured logger
- Include requestId, uid, route, latency, retryCount, queueSize

10. No environment variable documentation
Fix:
- Add .env.example and ENV_VARS.md
- Validate env at startup

11. No dependency audit workflow
Fix:
- Add npm audit and GitHub Dependabot
- Fail CI on severe vulnerabilities

12. No explicit resource ownership checks
Fix:
- On projectId/episodeId inputs, verify referenced resources exist under the authenticated UID before proceeding

13. Duplicate commit/file save events
Fix:
- Add client-side debounce + backend idempotency key

14. Weak offline storage recovery
Fix:
- Use versioned queue schema and corruption recovery path
- Longer term: migrate to SQLite for durable offline queueing

15. Multi-root workspace issue
Fix:
- Create one project mapping per workspace folder
- Scope episode state by workspace folder URI

====================================================================
9. PERFORMANCE IMPROVEMENT PLAN
====================================================================

Goal: faster execution without adding developer overhead.

Extension speedups:
- Debounce file-save events (250–1000 ms depending on file type)
- Batch queue flush by size or time threshold
- Coalesce repeated metadata-only updates
- Avoid re-reading large diffs unless content changed
- Perform background sync only when auth + network are ready
- Use incremental backoff and jitter to reduce retry storms

Backend speedups:
- Validate early, fail early
- Use Firestore writeBatch where possible
- Parallelize independent reads
- Cache project lookup by uid + repoUrl for short TTL
- Keep AI calls isolated from critical storage path
- Use payload size guards before expensive processing

Dashboard speedups:
- React Query caching and background refetch
- Skeletons and optimistic UX
- Virtualized episode/call lists
- Lazy-load heavy diff viewer
- Paginate or incrementally fetch long histories

CLI speedups:
- Load config once per command
- Show concise summary instead of verbose network logs by default
- Skip unnecessary remote checks if local project config is already valid

====================================================================
10. RECOMMENDED INTERNAL MODULES TO ADD
====================================================================

Extension modules:
- NotificationService
- ErrorMapper
- SyncStateMachine
- AuthRecoveryService
- EventDeduplicator
- QueueIntegrityChecker
- GitContextCache

Backend modules:
- validateRequest(schema)
- createAppError(code, message, retryable)
- requestContext middleware (requestId, uid, timing)
- rateLimitByRoute
- safeLogger
- idempotencyService
- aiTaskRunner (non-blocking optional AI path)

Dashboard modules:
- useSyncStatus
- useRetryableQuery
- ErrorView component
- EmptyState component
- ToastCenter
- DiffLoader

CLI modules:
- configValidator
- authGuard
- outputFormatter
- exitCodeMapper

====================================================================
11. IDEAL USER RESPONSES FOR MAJOR EVENTS
====================================================================

Success:
- “Signed in successfully.”
- “Project linked successfully.”
- “Episode started for feature/login.”
- “All changes synced.”

Info:
- “You’re offline. Changes will sync automatically later.”
- “Large diff detected. A condensed version is being processed.”

Warning:
- “Sync is delayed because the connection is unstable.”
- “Some repeated events were merged to keep logs clean.”

Error:
- “Session expired. Sign in again to continue syncing.”
- “Couldn’t save one update. Other changes are still safe.”
- “AI summary is unavailable right now. Try again later.”
- “This project could not be resolved from the current Git remote.”

Never say:
- “FirebaseError: auth/invalid-credential”
- “TypeError: Cannot read property uid of undefined”
- “Unhandled exception in api.js line 48”
- raw stack traces
- raw JSON payload dumps

====================================================================
12. PRIORITY IMPLEMENTATION ORDER
====================================================================

Phase 1 — Immediate
- Remove stack trace leakage
- Add zod validation
- Add rate limiting
- Restrict CORS
- Add Helmet
- Add requestId + structured logging
- Improve auth-expired handling in extension and dashboard

Phase 2 — Stability
- Add event deduplication
- Add backend idempotency
- Improve queue recovery
- Add better toasts and status messaging
- Add explicit ownership checks for project/episode IDs

Phase 3 — Speed and UX
- Add Firestore batching
- Add React Query and virtualization in dashboard
- Add auto-create episode in CLI
- Improve empty states and retry flows

Phase 4 — Long-term robustness
- SQLite offline queue
- Team workspace authorization model
- AI task queue isolation
- richer observability dashboards and alerts

====================================================================
13. FINAL TARGET STATE
====================================================================

A polished final behavior should feel like this:
- The developer installs ContextLens and signs in once.
- The extension starts working quietly in the background.
- Branch changes, commits, file saves, and AI context are captured automatically.
- When offline, work is stored safely without bothering the user.
- When errors happen, the user sees one clear sentence and one useful action.
- Internal logs remain rich for debugging, but user messages remain calm and simple.
- The backend validates everything, leaks nothing, rate-limits abuse, and stores data efficiently.
- The dashboard stays fast even with large timelines.
- The CLI works predictably and explains failures clearly.
- AI features are helpful but never block core capture and sync.
- The whole product feels invisible when healthy and reassuring when something goes wrong.

End of document.
