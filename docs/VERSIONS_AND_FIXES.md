# ContextLens: Versions & Fixes History

> Chronological record of development phases, alignment audits, critical bug fixes, enhancement suggestions, and known issues. Synthesized from `/context` folder and development logs.

***

## 🕒 Development Timeline

### Phase 1: Architectural Scaffolding

**Focus:** Establishing the three-tier architecture (Extension, Backend, Dashboard).

- **Context Files:** `ContextLens_Builder_1_VSCode_Extension.txt`, `ContextLens_Builder_2_Backend_AI_Services.txt`, `ContextLens_Builder_3_Web_Dashboard.txt`
- **Milestones:**
  - Defined the Firestore schema for Projects, Episodes, and Calls.
  - Scaffolding of the Gemini-powered backend (Cloud Functions v2).
  - Initial UI design for the glassmorphism dashboard.

***

### Phase 2: Workflow Alignment Audit (Major Milestone)

**Focus:** Ensuring the Extension and Dashboard match the Backend's API contracts.

- **Context File:** `Workflow_Alignment_Audit.md`
- **What Was Fixed:**
  - **Extension Client:** Rewrote `apiClient.ts` to use real `https` with Bearer tokens instead of mock data.
  - **Command Implementation:** Finalized all 8 core commands (New Episode, Close Episode, Explain Diff, etc.).
  - **Data Payloads:** Unified the JSON payloads between Extension and Backend to include `branchName`, `activeFilePath`, and `diffSnapshot`.
  - **Deep Linking:** Implemented dynamic URL construction in the extension to allow direct navigation from VS Code to specific episodes/branches in the dashboard.
  - **Sidebar State:** Replaced static placeholders with a live `TreeDataProvider` showing real-time episode status.

***

### Phase 3: The "Empty Dashboard" Crisis & Auth Hardening

**Focus:** Resolving connectivity issues and transitioning from demo-mode to production-auth.

- **Context File:** `fix-7`
- **What Was Fixed:**
  - **UID Mismatch:** Identified that the backend was writing to a `demo-user` path while the dashboard was searching for real `auth.currentUser.uid`.
  - **Firestore Rules:** Updated security rules to allow read/write during the transition to ensure no silent failures.
  - **Fallback Logic:** Implemented `|| 'contextlens-demo-user'` in all dashboard hooks (`useProjects`, `useEpisodes`, `useCalls`) to ensure data visibility for unauthenticated users.
  - **Auth Middleware:** Hardened the backend middleware to verify real Firebase ID tokens while maintaining a testing fallback.

***

### Phase 4: Autonomy Layer + Smart Sync Engine (Major Milestone)

**Focus:** Making ContextLens fully autonomous — zero manual steps after first sign-in.

- **Context Files:** `ContextLens_Autonomy_Complete_v2.txt`, `ContextLens_Smart_Sync.txt`
- **What Was Built:**
  - **Watcher 1 — Git Commits:** Auto-detects new commits and opens/updates episodes silently in the background.
  - **Watcher 2 — Branch Changes:** Detects branch switches and auto-closes the active episode, opening a new one for the new branch.
  - **Watcher 3 — File Saves:** Tracks saved files in-memory per episode; batched write every 30 seconds via sync engine.
  - **Smart Sync Engine:** All Firestore writes are buffered first — nothing sends immediately. Buffer flushes every 30 seconds in chunks of 5 items. If offline, buffer is persisted to disk and flushed when connectivity returns.
  - **Zero Gemini Auto-Calls:** Strict rule enforced — Gemini API is **never** called from watchers or the sync engine. Only called on explicit developer button click. Cost is zero for background operations.
  - **Status Bar:** Live sync status shown (`⬆ 3 pending`, `✓ synced`) so the developer is always informed without interruption.

***

### Phase 5: Production Refinement & CLI Standalone

**Focus:** Professionalizing the codebase and extracting the CLI.

- **Current State:**
  - **Documentation Revamp:** Moved all technical guides to the `/docs` directory.
  - **CLI Extraction:** Converted the `/cli` folder into a standalone product (`cl`) with its own global configuration system (`~/.contextlens/config.json`).
  - **Security Audit:** Formally documented security policies regarding PII redaction and secret storage.

***

## 🛠️ Critical Bug Fixes Registry

| Fix ID | Issue | Solution | Status |
| :--- | :--- | :--- | :--- |
| **FL-001** | Dashboard shows 0 projects | Updated hooks to fall back to `contextlens-demo-user`; updated Firestore rules. | ✅ Resolved |
| **FL-002** | Extension fails to call API | Rewrote client using Node `https` module to avoid dependency conflicts. | ✅ Resolved |
| **FL-003** | Explain Diff returns empty | Fixed payload mapping to send the raw `git diff` instead of a hash. | ✅ Resolved |
| **FL-004** | Auth Popup blocked | Configured Vite headers for `Cross-Origin-Opener-Policy: same-origin`. | ✅ Resolved |
| **FL-005** | Search param mismatch | Backend expected `?q=...`, dashboard sent `?query=...`. Unified to `q`. | ✅ Resolved |
| **FL-006** | Frequent Firestore writes causing cost spikes | Smart Sync Engine — buffers all writes, flushes every 30s in chunks of 5, persists offline queue to disk. | ✅ Resolved |
| **FL-007** | Gemini API triggered automatically by watchers | Enforced button-only Gemini invocation rule across all watchers; zero AI calls from sync engine. | ✅ Resolved |

***

## 🐛 Known Issues & Suggested Fixes

### KI-001 — Re-authentication Required After Every Project Close ✅ RESOLVED

**Severity:** High — **Status: SHIPPED**  
**Symptom:** After closing a project/episode and switching workspace, the user is prompted to sign in again as if the session is lost.

**Root Cause:**  
Firebase Auth's `currentUser` persists in `localStorage` (browser) but VS Code extensions use `globalState` for persistence. When the extension context is disposed (project close, window reload, workspace switch), the in-memory auth token is dropped — and because `localStorage` is sandboxed per extension host, the token is not automatically re-hydrated.

**Suggested Fix:**

1. **Persist the Firebase ID token to `globalState` on every successful auth:**
   ```typescript
   // In your auth handler, after sign-in succeeds:
   const idToken = await user.getIdToken();
   await context.globalState.update('contextlens.idToken', idToken);
   await context.globalState.update('contextlens.uid', user.uid);
   ```

2. **On extension activation, attempt silent token re-hydration before showing sign-in prompt:**
   ```typescript
   // In activate():
   const storedToken = context.globalState.get<string>('contextlens.idToken');
   const storedUid   = context.globalState.get<string>('contextlens.uid');

   if (storedToken && storedUid) {
     // Attempt silent re-auth — verify token is still valid
     try {
       await verifyTokenWithBackend(storedToken); // your backend's /verify endpoint
       authState.uid   = storedUid;
       authState.token = storedToken;
       // Skip sign-in prompt entirely
     } catch {
       // Token expired — clear stored token, show sign-in prompt
       await context.globalState.update('contextlens.idToken', undefined);
       promptSignIn();
     }
   } else {
     promptSignIn();
   }
   ```

3. **Add a token refresh interval** — Firebase ID tokens expire every 60 minutes. Schedule a refresh every 45 minutes while the extension is active:
   ```typescript
   setInterval(async () => {
     if (auth.currentUser) {
       const freshToken = await auth.currentUser.getIdToken(true); // force=true
       await context.globalState.update('contextlens.idToken', freshToken);
       authState.token = freshToken;
     }
   }, 45 * 60 * 1000); // 45 minutes
   ```

4. **On workspace close**, call `auth.signOut()` only if the user explicitly logs out — not on project/episode close. Project close ≠ session end.

**Expected Result:** Developer signs in once per device. Sessions persist across project switches, restarts, and workspace changes.

> **✅ Implemented:** Dual-storage persistence (SecretStorage + globalState mirror) with 45-minute token refresh interval. Shipped in Phase 5.

***

### KI-002 — Silent Auth Failures on Extension Host Restart ✅ RESOLVED

**Severity:** Medium — **Status: SHIPPED**  
**Symptom:** After VS Code restarts or the extension host crashes, API calls fail silently — no error shown, data just stops syncing.

**Suggested Fix:** Add an auth-state check at the top of every API call in `apiClient.ts`. If the token is missing, surface a non-intrusive notification (not a modal) prompting re-auth.

> **✅ Implemented:** Auth-state guard added to `apiClient.ts request()`. Every API call proactively checks token validity and surfaces a non-intrusive "Sign in" notification with a one-click action button. Shipped in Phase 5.

***

## 🚀 Next Version (Upcoming Release)

### VS Code Extension

- [x] **Auto-Initialization & Background Watcher:** Automatically detect and create projects upon opening a workspace, watch the filesystem for real-time changes, and seamlessly update local context (functioning like a highly efficient, invisible git). ✅
- [x] **Git Commit Linking:** Automatically tie ContextLens episodes directly to specific git commits to maintain an unbroken chain of history. ✅
- [x] **Webview UX Polish:** Add a loading spinner and better error handling to the Gemini chat webview for smoother AI interactions. ✅
- [ ] **Offline Mode (Phase 2):** Migrate offline buffer from in-memory + disk persistence to a full SQLite store for durable, queryable offline history. *(Phase 1 — disk buffer — already shipped in the Smart Sync Engine.)*
- [x] **Token Persistence & Silent Re-auth:** Implement `globalState`-based token storage so developers never have to sign in again after a project switch. *(See KI-001 above.)* ✅

### Web Dashboard

- [x] **Dark Mode:** Implement a complete dark mode theme for the dashboard for better developer accessibility. ✅ *(ThemeContext with light/dark/system, persisted to localStorage, toggle in TopBar)*
- [x] **Refined Empty States:** Improve the UI feedback when a user connects but hasn't logged any projects or episodes yet. ✅ *(EmptyState component with contextual icons and setup guidance)*
- [x] **Sync Status Indicator:** Mirror the extension's status bar sync state in the dashboard header so users can see pending/syncing/synced status without opening VS Code. ✅ *(Online/offline badge in TopBar with animated pulse)*

### Security & Architecture

- [x] **Advanced Redaction:** Automatically strip API keys and PII from file diffs and context before any data leaves the local machine. ✅ *(18 regex rules in `redaction.ts`)*
- [ ] **Team Workspaces:** Begin restructuring Firestore rules and schemas to move beyond single-user data paths to collaborative project contexts.

***

## 💡 Enhancement Suggestions

### Extension Enhancements

| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :--- |
| **ENH-001** | Smart Episode Naming | Auto-generate episode names from the branch name + last commit message instead of requiring manual input (e.g., `feat/login → "Login Flow — add OAuth provider"`). | ✅ Shipped |
| **ENH-002** | Diff Size Guard | Before sending a diff to the sync engine, auto-truncate to 6,000 chars and log a warning if truncation occurred. Prevents silent large-payload failures. | ✅ Shipped |
| **ENH-003** | Context Snapshot on Close | When an episode is auto-closed by the branch watcher, capture a final snapshot: open files, cursor positions, last terminal command. Restore on next open. | ✅ Shipped |
| **ENH-004** | Multi-Root Workspace Support | Detect and handle VS Code multi-root workspaces — create separate projects per root, not one project for the entire workspace. | ✅ Shipped |
| **ENH-005** | Episode Time Estimates | Track time between episode open and close. Show "Active for 2h 15m" in the sidebar and dashboard for productivity insights. | ✅ Shipped |
| **ENH-006** | Stale Episode Detector | Flag episodes that have been open for >24 hours with no file saves or commits. Auto-prompt: "This episode looks stale — close it?" | ✅ Shipped |

### Dashboard Enhancements

| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :--- |
| **ENH-007** | Episode Timeline View | Visual timeline of all episodes per project (Gantt-style), showing which branches were active, when, and for how long. | ✅ Shipped |
| **ENH-008** | Diff Viewer | Inline syntax-highlighted diff viewer for each Call, so developers can review what code was captured without leaving the dashboard. | ✅ Shipped |
| **ENH-009** | AI Call Cost Tracker | Show cumulative Gemini API token usage and estimated cost per project/episode. Helps developers stay aware of spend without surprises. | ✅ Shipped |
| **ENH-010** | Export to Markdown | One-click export of an episode's full context (commits, diffs, AI calls, notes) as a formatted Markdown file — useful for PR descriptions or post-mortems. | ✅ Shipped |
| **ENH-011** | Search Across Episodes | Full-text search across all episodes and calls within a project. Critical as data volume grows. | ✅ Shipped |

### Architecture / Backend Enhancements

| ID | Feature | Description | Priority |
| :--- | :--- | :--- | :--- |
| **** | Token Refresh | Extension AuthManager proactively checks JWT claim and refreshes token every 45 minutes; coordinateRefresh mutex handles concurrency. | ✅ Shipped |
| **** | Rate Limiting | Backend limits all AI-powered routes via `aiLimiter` (30/15min) to prevent accidental quota usage. | ✅ Shipped |
| **** | Payload Validation | Backend validates all endpoint request schemas via `express-validator` middleware. | ✅ Shipped |
| **ENH-015** | Firestore Write Batching | Refactored `/calls/log` to use `db.batch()` to write the call document and increment `callCount` in one operation. | ✅ Shipped |

***

## 📈 Future Vision (Roadmap)

- [ ] Fully collaborative AI pair-programming sessions.
- [ ] Native integrations with Jira and GitHub Issues.
- [ ] Cross-repository semantic search.
- [ ] PR auto-generation from episode context (commits + diffs + AI calls → structured PR description).
- [ ] Replay mode — step through an episode's history like a time-travel debugger.

***

> [!NOTE]
> This history is synthesized from the `/context` folder and development logs. For deep technical details on any specific fix, refer to the corresponding file in `/context`. KI (Known Issues) and ENH (Enhancements) entries are suggestions for the upcoming sprint backlog.
