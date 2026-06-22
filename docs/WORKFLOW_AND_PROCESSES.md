# ContextLens: Workflows & Technical Processes

This document provides a deep dive into the operational mechanics of the ContextLens ecosystem, specifically focusing on the VS Code Extension and the automated project lifecycle.

---

## 🧩 1. VS Code Extension Mechanics

The extension acts as the primary "Context Sensor." It captures real-time development signals and synchronizes them with the cloud.

### 📦 Installation & Activation
1.  **Distribution**: The extension is packaged as a `.vsix` file or distributed via the VS Code Marketplace.
2.  **Activation**: It activates on `onStartupFinished` or when specific ContextLens commands are invoked.
3.  **Authentication Callback**:
    *   **Trigger**: If no auth token is found in the local `SecretStorage`.
    *   **Redirect**: Opens the browser to the Firebase Auth landing page.
    *   **Return**: Upon successful login, the browser redirects to `vscode://89Aman.contextlens/auth?token=...`.
    *   **Handler**: The extension's `CustomUriHandler` parses the token and saves it securely for all future API requests.

### 🕵️ Autonomous Watchers
The extension runs background processes ("Watchers") that monitor:
-   **Active Editor**: Tracks which file you are currently focused on.
-   **Text Changes**: Detects diffs and AI-generated code patterns.
-   **Git Context**: Monitors branch switches (`onDidChangeBranch`) to ensure data is attributed to the correct development stream.

---

## 🚀 2. Automatic Project Creation

ContextLens minimizes manual setup by automatically resolving project identities.

### 🔍 The "Fingerprinting" Process
When the VS Code extension initializes in a new folder:
1.  **Remote Check**: It executes `git remote get-url origin`.
2.  **Naming**: It defaults the project name to the folder's name (e.g., `ContextLens`).
3.  **Creation Request**: It calls `POST /api/projects` with the `repoUrl` and `name`.

### 🧠 Backend Resolution Logic
1.  **Deduplication**: The backend checks the Firestore `projects` collection for a record matching the `UID` (user) and the `repoUrl`.
2.  **Upsert**: 
    *   If a match exists, it returns the existing `projectId`.
    *   If no match exists, it creates a new project record and returns the new `projectId`.
3.  **Client-Side Persistence**: The Extension saves this ID in its `workspaceState` (linked to that specific folder), ensuring that future activations are instant.

---

## 📊 3. The Sync Engine

To ensure data integrity during offline development:
1.  **Buffering**: All "Calls" and "Events" are first written to a local JSON buffer.
2.  **Retry Logic**: A background sync loop attempts to push the buffer to the cloud every 30 seconds.
3.  **Atomic Flushes**: Once the backend acknowledges receipt (200 OK), the local buffer is cleared.

---


