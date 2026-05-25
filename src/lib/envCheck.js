/**
 * Validates that all required environment variables are set at startup.
 * Throws immediately if any required variable is missing so the function
 * instance fails fast rather than silently connecting to the wrong project.
 *
 * Optional variables are logged as warnings.
 */

const REQUIRED_VARS = [
  'GOOGLE_CLOUD_PROJECT',
  'CLIENT_FIREBASE_API_KEY',
  'CLIENT_FIREBASE_AUTH_DOMAIN',
  'CLIENT_FIREBASE_PROJECT_ID',
];

const OPTIONAL_VARS = [
  'VERTEX_LOCATION',
  'VERTEX_MODEL',
  'VERTEX_TIMEOUT_MS',
  'VERTEX_RETRY_ATTEMPTS',
  'USE_VERTEX',
  'CORS_ALLOWED_ORIGINS',
  'SETTINGS_ENCRYPTION_KEY',
];

/**
 * Checks environment variables and throws if required ones are missing.
 * Should be called once at module load time.
 */
function validateEnv() {
  if (!process.env.GOOGLE_CLOUD_PROJECT && process.env.GCLOUD_PROJECT) {
    process.env.GOOGLE_CLOUD_PROJECT = process.env.GCLOUD_PROJECT;
  }

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    throw new Error(
      `[ContextLens] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set them in your Firebase Functions configuration or .env file.'
    );
  }

  const unset = OPTIONAL_VARS.filter((v) => !process.env[v]);
  if (unset.length > 0) {
    console.warn(
      `[ContextLens] Optional environment variable(s) not set (using defaults): ${unset.join(', ')}`
    );
  }
}

module.exports = { validateEnv };
