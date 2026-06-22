const Sentry = require("@sentry/google-cloud-serverless");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

// Initialize Sentry early so it can instrument everything
Sentry.init({
  dsn: "https://a962136739b601108e5f6f939e88ccac@o4511412497350656.ingest.de.sentry.io/4511412627570768",
  // Fix 5: Disable PII collection (GDPR compliance)
  sendDefaultPii: false,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Fix 5: Reduce sampling to production-safe levels (was 1.0 / 100%)
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.1,
});

module.exports = Sentry;
