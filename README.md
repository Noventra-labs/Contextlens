# ContextLens
>[!WARNING]
> **Please star this repo if you like this tool.**
 
> **Bridging the gap between code and context.**

> [!WARNING]
> **ContextLens is currently under active development.** Some features and integrations are in preview states, and certain functions may not work as expected or change without notice. Please use with caution in production workspaces.

ContextLens is an AI-driven developer companion that captures your coding intent, tracks development "episodes," and provides high-level project insights through a unified dashboard. It ensures that the *why* behind every change is never lost.

## 🌟 Features

- **Episode-Based Tracking**: Organize your work into logical episodes (features, bugfixes, refactors).
- **AI-Powered Context**: Automatically captures diffs and AI interactions to build a semantic history of your project.
- **Visual Timeline**: A premium web dashboard to visualize project progress across branches.
- **Smart Summaries**: Automatically generate PR descriptions and branch-level impact assessments using Gemini.
- **Offline-First Sync**: A robust sync engine in the VS Code extension ensures no context is lost, even without a connection.

## 🏗️ Repository Structure

This monorepo contains the following components:

| Component | Path | Description |
|---|---|---|
| **VS Code Extension** | [`/vscode-extension`](./vscode-extension/) | The primary client for context capture. |
| **Web Dashboard** | [`/contextlens-dashboard`](./contextlens-dashboard/) | React-based visual interface for project insights. |
| **Backend** | [`/src`](./src/) | Firebase Cloud Functions + Firestore for data processing. |
| **Documentation** | [`/docs`](./docs/) | Architectural deep-dives and design specifications. |

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [Firebase CLI](https://firebase.google.com/docs/cli)
- Google Cloud Platform account with Vertex AI enabled.

### Development Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/89Aman/ContextLens.git
    cd ContextLens
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    # Follow subdirectory READMEs for specific component setup
    ```

3.  **Configure Environment**:
    - Set up your Firebase project.
    - Add your service account to `GOOGLE_APPLICATION_CREDENTIALS`.
    - Fill in `.env` files in `contextlens-dashboard` and `src` (backend).

## 📘 Documentation

- [Getting Started Guide](./docs/DOCUMENTATION.md)
- [Versions & Fixes History](./docs/VERSIONS_AND_FIXES.md)
- [Technical Workflows](./docs/WORKFLOW_AND_PROCESSES.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Contributing Guidelines](./docs/CONTRIBUTING.md)
- [Project Trackers](./docs/CONTRIBUTIONS_TRACKER.md)

## 🛡️ License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

Built with ❤️ by [89Aman](https://github.com/89Aman)
