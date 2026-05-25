# Environment Variables Reference

## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `GOOGLE_CLOUD_PROJECT` | GCP project ID. Auto-set by Firebase CLI during deployment. | `contextlens-backend-001` |
| `CLIENT_FIREBASE_API_KEY` | Firebase Web API key for the sign-in page. | `AIzaSy...` |
| `CLIENT_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain for the sign-in page. | `your-project.firebaseapp.com` |
| `CLIENT_FIREBASE_PROJECT_ID` | Firebase project ID for the sign-in page. | `your-project-id` |

> **Note:** If `GOOGLE_CLOUD_PROJECT` is missing but `GCLOUD_PROJECT` exists, the backend will auto-alias it.

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VERTEX_LOCATION` | `us-central1` | GCP region for Vertex AI calls. |
| `VERTEX_MODEL` | `gemini-1.5-pro` | Default Vertex AI model name. |
| `VERTEX_TIMEOUT_MS` | `30000` | Timeout in ms for AI model calls. |
| `VERTEX_RETRY_ATTEMPTS` | `2` | Max retry attempts for transient AI errors. |
| `USE_VERTEX` | `true` | Set to `false` to disable Vertex AI (uses mock responses). |
| `ALLOWED_ORIGINS` | `http://localhost:3000,vscode-webview://*` | Comma-separated CORS origins. |
| `SETTINGS_ENCRYPTION_KEY` | _(none)_ | AES-256 key for encrypting API keys at rest. 64 hex chars (32 bytes). |
| `SENTRY_DSN` | _(none)_ | Sentry error tracking DSN. |
| `NODE_ENV` | _(none)_ | Set to `production` for structured logs and no stack traces. |

## Generating an Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Validation

The backend validates all required variables at boot via `src/lib/envCheck.js`.
Missing required variables cause an immediate crash with a clear error message.
Missing optional variables log a warning but allow startup.
