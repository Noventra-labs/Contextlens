# Implement All Unchecked Items from VERSIONS_AND_FIXES.md

Implement remaining features and enhancements from [VERSIONS_AND_FIXES.md](file:///c:/Users/shasa/Projects/ContextLens/docs/VERSIONS_AND_FIXES.md). Excludes future-vision roadmap items (collaborative sessions, Jira, cross-repo search, replay mode) — those need major architectural work.

---

## User Review Required

> [!IMPORTANT]
> **Scope is large** — 14 items across 3 subsystems. Recommend implementing in 3 phases so we can verify each before moving on.

> [!WARNING]
> **SQLite Offline Mode (Phase 2)** requires adding `better-sqlite3` native dep to the extension. This changes the build pipeline (webpack externals, .node binaries). **Skip or defer?**

> [!WARNING]
> **Team Workspaces** requires Firestore schema restructuring + new security rules. This is foundational — breaks existing data paths. **Skip or defer to separate PR?**

## Open Questions

1. **Dark Mode toggle** — should it persist via `localStorage` or Firestore user settings?
2. **ENH-005 Episode Time** — the `startedAt`/`endedAt` data already exists in Firestore. Just needs display. Confirm you want this in both sidebar tree AND dashboard?
3. **ENH-012 Token Refresh Endpoint** — the extension already has a 45-min proactive refresh via `securetoken.googleapis.com`. Adding a backend `/auth/refresh` duplicates this. **Still want it?**
4. **ENH-013 Rate Limiting** — already implemented (`aiLimiter` 30/15min). Mark as done?
5. **ENH-014 Zod vs express-validator** — `express-validator` chains already exist for all routes. Switching to Zod is a rewrite. **Keep current validator and mark done?**

---

## Proposed Changes

### Phase 1: Dashboard Features (Dark Mode, Empty States, Sync Indicator, Timeline, Diff Viewer, Search)

Items: Dark Mode, Refined Empty States, Sync Status Indicator, ENH-007 Timeline, ENH-008 Diff Viewer, ENH-011 Search

---

#### [MODIFY] [tailwind.config.js](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/tailwind.config.js)
- Add `darkMode: 'class'` support
- Add dark mode color variants

#### [MODIFY] [index.css](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/index.css)
- Add `.dark` class overrides for background, text, borders
- Add `prefers-color-scheme` media query as default

#### [NEW] [ThemeContext.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/context/ThemeContext.tsx)
- Theme state: `'light' | 'dark' | 'system'`
- Persist to `localStorage`
- Toggle component for settings + TopBar

#### [MODIFY] [Sidebar.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/layout/Sidebar.tsx)
- Update color classes to use Tailwind dark: variants

#### [MODIFY] [TopBar.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/layout/TopBar.tsx)
- Add dark mode toggle (Sun/Moon icon)
- Add sync status indicator badge

#### [MODIFY] [main.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/main.tsx)
- Wrap with `<ThemeProvider>`

#### [MODIFY] [EmptyState.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/ui/EmptyState.tsx)
- Add illustrations/icons for different empty state contexts
- More descriptive messaging with setup steps

#### [MODIFY] [HomePage.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/pages/HomePage.tsx)
- Enhanced empty states for projects and episodes sections
- Add search bar with `SearchContext` integration (ENH-011)

#### [NEW] [EpisodeTimeline.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/episodes/EpisodeTimeline.tsx)
- Gantt-style visual timeline using CSS (no extra deps)
- Shows branches as swim lanes, episodes as bars
- Color-coded by status (open=green, closed=gray)
- Hover tooltip with episode details

#### [MODIFY] [ProjectPage.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/pages/ProjectPage.tsx)
- Add timeline view toggle (list vs timeline)
- Integrate `EpisodeTimeline` component

#### [MODIFY] [DiffViewer component](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/episodes/DiffViewer.tsx)
- Already exists — ensure it's used in `CallItem` for inline diff viewing
- `react-diff-viewer-continued` already in deps

#### [NEW] [SearchPage.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/pages/SearchPage.tsx)
- Full-text search UI across episodes and calls
- Uses existing `/search` backend endpoint
- Filters: branch, date range, source type
- Results grouped by episode

#### [MODIFY] [routes/index.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/routes/index.tsx)
- Add `/dashboard/search` route

---

### Phase 2: Extension Enhancements (Context Snapshot, Multi-Root, Episode Time)

Items: ENH-003 Context Snapshot, ENH-004 Multi-Root, ENH-005 Episode Time

---

#### [MODIFY] [episodeStore.ts](file:///c:/Users/shasa/Projects/ContextLens/vscode-extension/src/episodeStore.ts)
- **ENH-003**: On `closeEpisodeSilent()`, capture snapshot: open editor file paths, cursor positions. Store in `workspaceState` keyed by branch. On `autoCreateEpisode()`, check for matching branch snapshot and restore.
- **ENH-005**: Track `lastActivityAt` timestamp. Add `getDuration()` method returning human-readable elapsed time.

#### [MODIFY] [watchers.ts](file:///c:/Users/shasa/Projects/ContextLens/vscode-extension/src/watchers.ts)
- **ENH-004**: Iterate `vscode.workspace.workspaceFolders` instead of `[0]` only. Create separate project per root folder. Map each root to its own episode.

#### [MODIFY] [stateTreeProvider.ts](file:///c:/Users/shasa/Projects/ContextLens/vscode-extension/src/stateTreeProvider.ts)
- **ENH-005**: Show elapsed time in the active episode tree item: `"Active for 2h 15m"`

#### [MODIFY] [EpisodeDetailPage.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/pages/EpisodeDetailPage.tsx)
- **ENH-005**: Show duration in episode header

---

### Phase 3: Backend Enhancements (Export, Cost Tracker, Write Batching)

Items: ENH-009 Cost Tracker, ENH-010 Export, ENH-015 Write Batching

---

#### [MODIFY] [api.js](file:///c:/Users/shasa/Projects/ContextLens/src/routes/api.js)
- **ENH-010**: Add `POST /episodes/export` — fetches episode + all calls, formats as Markdown, returns as `text/markdown`.
- **ENH-015**: Refactor `POST /calls/log` to use `db.batch()` for the call doc write + callCount increment instead of separate `set()` + `runTransaction()`.

#### [MODIFY] [validate.js](file:///c:/Users/shasa/Projects/ContextLens/src/middleware/validate.js)
- Add `exportEpisodeRules` validation chain

#### [MODIFY] [lib/api.ts](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/lib/api.ts)
- Add `exportEpisode(projectId, episodeId)` API call

#### [NEW] [ExportButton.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/components/episodes/ExportButton.tsx)
- One-click "Export to Markdown" button
- Downloads `.md` file via browser

#### [MODIFY] [EpisodeDetailPage.tsx](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/pages/EpisodeDetailPage.tsx)
- Add ExportButton to episode header
- **ENH-009**: Show cumulative token usage per episode (sum from calls data already fetched)

#### [MODIFY] [firestoreHooks.ts](file:///c:/Users/shasa/Projects/ContextLens/contextlens-dashboard/src/lib/firestoreHooks.ts)
- Add token usage aggregation to `useCalls` return

---

## Items to Mark as Already Done

Based on codebase analysis:

| ID | Feature | Evidence |
|---|---|---|
| **ENH-012** | Token Refresh Endpoint | Extension already refreshes via `securetoken.googleapis.com` + 45-min interval in `watchers.ts` |
| **ENH-013** | Rate Limiting on AI | `aiLimiter` (30/15min) already applied to `/calls/log`, `/episodes/explain`, `/branches/summarize` |
| **ENH-014** | Payload Validation | `express-validator` chains exist for all routes in `validate.js` |

---

## Items Deferred (Recommend Separate PR)

| Item | Reason |
|---|---|
| **Offline Mode Phase 2 (SQLite)** | Requires native Node addon, changes build pipeline, needs thorough testing |
| **Team Workspaces** | Requires Firestore schema restructuring, new security rules, breaks existing data model |

---

## Verification Plan

### Automated Tests
- `cd contextlens-dashboard && npm run build` — TypeScript + Vite build passes
- `cd . && npm test` — backend Jest tests pass
- `cd vscode-extension && npx tsc --noEmit` — extension compiles

### Manual Verification
- Dark mode toggle works across all pages
- Empty states show when no data
- Episode timeline renders with real episode data
- Diff viewer shows inline diffs in call items
- Search returns results from backend
- Export produces valid Markdown file
- Episode duration shows in sidebar + dashboard
