const Sentry = require("@sentry/google-cloud-serverless");
const { nodeProfilingIntegration } = require("@sentry/profiling-node");

// Initialize Sentry early so it can instrument everything
Sentry.init({
  dsn: "https://a962136739b601108e5f6f939e88ccac@o4511412497350656.ingest.de.sentry.io/4511412627570768",
  sendDefaultPii: true,
  integrations: [
    nodeProfilingIntegration(),
  ],
  // Tracing
  tracesSampleRate: 1.0, // Capture 100% of the transactions
  // Set sampling rate for profiling - this is relative to tracesSampleRate
  profilesSampleRate: 1.0,
});

module.exports = Sentry;
