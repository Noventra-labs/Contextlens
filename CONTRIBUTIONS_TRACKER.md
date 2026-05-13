# Changelog - 50 Contributions to ContextLens

This document tracks the 50 contributions made to the ContextLens project to improve its robustness, documentation, and feature set.

## [1.0.0] - 2026-05-13

### Documentation
- [x] 1. Update `ContextLens_Build_Spec.txt` with detailed workflow explanations.
- [x] 2. Add JSDoc comments to `episodeStore.ts`.
- [x] 3. Add JSDoc comments to `syncEngine.ts`.
- [x] 4. Add JSDoc comments to `apiClient.ts`.
- [ ] 5. Update `vscode-extension/README.md` with setup instructions.
- [ ] 6. Update `contextlens-dashboard/README.md` with setup instructions.
- [ ] 7. Improve `CONTRIBUTING.md`.
- [ ] 8. Add a detailed `ARCHITECTURE.md` in the `docs` folder.
- [ ] 9. Improve `package.json` descriptions and keywords.
- [ ] 10. This `CHANGELOG.md` file.

### Code Quality & Refactoring
- [x] 11. Refactor `extension.ts` and extract `statusBar.ts` (includes bugfix for `episodeStore` undefined).
- [ ] 12. Ensure consistent error handling in `apiClient.ts`.
- [ ] 13. Implement a proper logger utility in the extension.
- [ ] 14. Add type definitions for all API responses.
- [x] 15. Use `async/await` consistently in `episodeStore.ts` and add validation.
- [ ] 16. Improve `gitContext.ts` robustness.
- [x] 17. Optimize `syncEngine.ts` interval and flush logic.
- [ ] 18. Clean up unused imports across the extension.
- [ ] 19. Clean up unused imports across the dashboard.
- [ ] 20. Implement a standard response wrapper in the backend.
- [ ] 21. Add `try-catch` blocks to all backend routes.
- [ ] 22. Refactor backend `index.js` to use a separate `app.js`.
- [ ] 23. Move Firestore logic in backend to a dedicated service.
- [ ] 24. Improve environment variable validation in backend.
- [ ] 25. Add a `.editorconfig` to ensure consistent formatting.

### Testing
- [ ] 26. Set up Jest for the VS Code extension.
- [ ] 27. Add unit tests for `gitContext.ts`.
- [ ] 28. Add unit tests for `redaction.ts`.
- [ ] 29. Add unit tests for `auth.ts` logic.
- [ ] 30. Add unit tests for backend `lib/redact.js`.
- [ ] 31. Add unit tests for backend `routes/api.js`.
- [ ] 32. Add unit tests for backend `services/gemini.js`.
- [ ] 33. Add component tests for dashboard `Sidebar`.
- [ ] 34. Add component tests for dashboard `ProjectCard`.
- [ ] 35. Set up a basic CI workflow in `.github/workflows`.

### UI/UX Polish
- [ ] 36. Add a loading spinner to the extension chat webview.
- [ ] 37. Improve the styling of the extension sidebar tree view.
- [ ] 38. Add tooltips to all buttons in the extension.
- [ ] 39. Implement a dark mode theme for the dashboard.
- [ ] 40. Add skeleton loaders to the dashboard episode timeline.
- [ ] 41. Improve the "Explain Diff" display.
- [ ] 42. Add a "Copy to Clipboard" button for AI responses.
- [ ] 43. Implement toast notifications in the dashboard.
- [ ] 44. Add a "Search" bar to the dashboard sidebar.
- [ ] 45. Improve the dashboard's responsive layout.

### Feature Enhancements
- [ ] 46. Implement "Secret Redaction" before upload.
- [ ] 47. Implement "Intent Labeling".
- [ ] 48. Add "Copy-as-Markdown PR summary" feature.
- [x] 49. Implement "Keyboard Shortcuts" for extension.
- [ ] 50. Add "Git Commit Linking".
