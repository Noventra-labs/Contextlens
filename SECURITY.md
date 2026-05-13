# Security Policy

## Supported Versions

We currently support and provide security updates for the following versions of ContextLens:

| Version | Supported          |
| ------- | ------------------ |
| v1.0.x  | :white_check_mark: |
| < v1.0  | :x:                |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability within ContextLens, please follow these steps:

1.  **Do not disclose it publicly** until it has been addressed.
2.  **Email us**: Send a detailed report to `security@contextlens.dev` (placeholder email).
3.  **Include details**:
    -   Type of issue (e.g., XSS, data leak, RCE).
    -   Steps to reproduce.
    -   Potential impact.
    -   Any suggested fixes.

We will acknowledge your report within 48 hours and provide a timeline for resolution.

## Our Security Commitments

- **No PII/Secrets Upload**: We are committed to never uploading raw secrets or Personally Identifiable Information (PII) to our backend.
- **Local Redaction**: Redaction of sensitive data happens locally in the extension before transmission.
- **Secure Storage**: We use VS Code's `SecretStorage` for all credentials.
- **Regular Audits**: We perform internal security audits of our Cloud Functions and dashboard.
