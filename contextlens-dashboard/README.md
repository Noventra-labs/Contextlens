# ContextLens Web Dashboard

The ContextLens Web Dashboard is a premium, real-time interface for visualizing coding activity, managing projects, and generating AI-driven insights from your development workflow.

## Features

- **Project Timeline**: Visualize coding episodes across branches and time.
- **Episode Deep-Dive**: See the specific diffs, files, and AI interactions for any given task.
- **AI Summary Generator**: Generate Pull Request descriptions and high-level branch summaries.
- **Interactive Diffs**: Review code changes with AI-enhanced explanations and risk assessments.
- **Real-time Sync**: Automatically updates as you work in VS Code.
- **Modern UI**: Built with React, Tailwind CSS, and a premium design system.

## Setup

### Prerequisites

- Node.js v18+
- Firebase Project

### Installation

```bash
cd contextlens-dashboard
npm install
```

### Configuration

Copy the example environment file and fill in your Firebase credentials:

```bash
cp .env.example .env.local
```

### Local Development

```bash
npm run dev
```

The dashboard will be available at [http://localhost:5173](http://localhost:5173).

## Build & Deploy

### Building for Production

```bash
npm run build
```

### Deploying to Firebase Hosting

From the root of the repository:

```bash
firebase deploy --only hosting
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_FIREBASE_API_KEY` | Firebase Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `project-id.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | `project-id.appspot.com` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | From Firebase console |
| `VITE_FIREBASE_APP_ID` | From Firebase console |
| `VITE_API_BASE_URL` | Deployed backend Cloud Functions URL |

## License

MIT

