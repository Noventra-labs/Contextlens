/**
 * Advanced Redaction Engine
 * 
 * Automatically strips sensitive data (API keys, tokens, PII, secrets)
 * from file diffs and context before any data leaves the local machine.
 * 
 * Implements ENH from VERSIONS_AND_FIXES.md:
 * "Automatically strip API keys and PII from file diffs and context
 *  before any data leaves the local machine."
 */

interface RedactionRule {
  /** Human-readable label shown in logs */
  label: string;
  /** Regex pattern to match */
  pattern: RegExp;
  /** Replacement string */
  replacement: string;
}

const REDACTION_RULES: RedactionRule[] = [
  // ── API Keys & Tokens ──────────────────────────────────────────────────

  // OpenAI / Anthropic-style keys
  {
    label: 'OpenAI API Key',
    pattern: /sk-[A-Za-z0-9_-]{20,}/g,
    replacement: '[REDACTED_API_KEY]',
  },
  // OpenAI project keys
  {
    label: 'OpenAI Project Key',
    pattern: /sk-proj-[A-Za-z0-9_-]{20,}/g,
    replacement: '[REDACTED_OPENAI_PROJECT_KEY]',
  },
  // AWS Access Key IDs (AKIA...)
  {
    label: 'AWS Access Key',
    pattern: /(?:AKIA|ABIA|ACCA|ASIA)[0-9A-Z]{16}/g,
    replacement: '[REDACTED_AWS_KEY]',
  },
  // AWS Secret Access Key (40 chars, often follows "aws_secret_access_key" or "=")
  {
    label: 'AWS Secret Key',
    pattern: /(?<=(?:aws_secret_access_key|secret_key|SECRET_KEY)\s*[=:]\s*["']?)[A-Za-z0-9/+=]{40}(?=["']?\s)/g,
    replacement: '[REDACTED_AWS_SECRET]',
  },
  // GitHub Personal Access Tokens (ghp_, gho_, ghu_, ghs_, ghr_)
  {
    label: 'GitHub Token',
    pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
    replacement: '[REDACTED_GITHUB_TOKEN]',
  },
  // GitHub fine-grained tokens
  {
    label: 'GitHub Fine-Grained Token',
    pattern: /github_pat_[A-Za-z0-9_]{22,}/g,
    replacement: '[REDACTED_GITHUB_PAT]',
  },
  // Google API keys
  {
    label: 'Google API Key',
    pattern: /AIza[0-9A-Za-z_-]{35}/g,
    replacement: '[REDACTED_GOOGLE_API_KEY]',
  },
  // Slack tokens
  {
    label: 'Slack Token',
    pattern: /xox[bpors]-[A-Za-z0-9-]{10,}/g,
    replacement: '[REDACTED_SLACK_TOKEN]',
  },
  // Stripe keys
  {
    label: 'Stripe Key',
    pattern: /(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{20,}/g,
    replacement: '[REDACTED_STRIPE_KEY]',
  },
  // NPM tokens
  {
    label: 'NPM Token',
    pattern: /npm_[A-Za-z0-9]{36}/g,
    replacement: '[REDACTED_NPM_TOKEN]',
  },
  // Twilio
  {
    label: 'Twilio API Key',
    pattern: /SK[a-f0-9]{32}/g,
    replacement: '[REDACTED_TWILIO_KEY]',
  },
  // SendGrid
  {
    label: 'SendGrid Key',
    pattern: /SG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}/g,
    replacement: '[REDACTED_SENDGRID_KEY]',
  },

  // ── JWT & Bearer Tokens ────────────────────────────────────────────────

  {
    label: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '[REDACTED_JWT]',
  },

  // ── Credentials in Config / Env Files ──────────────────────────────────

  // Generic password/secret in env-like files (KEY=value or KEY="value")
  {
    label: 'Env Secret Value',
    pattern: /(?<=(?:PASSWORD|SECRET|TOKEN|API_KEY|APIKEY|AUTH|CREDENTIAL|PRIVATE_KEY)\s*[=:]\s*["']?)[^\s"']{8,}(?=["']?\s*$)/gim,
    replacement: '[REDACTED_ENV_VALUE]',
  },
  // Connection strings (postgresql://, mysql://, mongodb://, redis://)
  {
    label: 'Connection String',
    pattern: /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|amqp|mssql):\/\/[^\s"'<>]{10,}/gi,
    replacement: '[REDACTED_CONNECTION_STRING]',
  },

  // ── PII ────────────────────────────────────────────────────────────────

  // Email addresses (broad match)
  {
    label: 'Email Address',
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: '[REDACTED_EMAIL]',
  },
  // IP addresses (IPv4 — private ranges are common in configs)
  {
    label: 'IP Address',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[REDACTED_IP]',
  },
  // SSH private keys
  {
    label: 'SSH Private Key',
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    replacement: '[REDACTED_PRIVATE_KEY]',
  },
];

export class Redaction {
  /**
   * Applies all redaction rules to the input content.
   * Returns a sanitized version safe for transmission.
   * 
   * @param content Raw text content (diff, file contents, etc.)
   * @returns Redacted content with sensitive data replaced by labels.
   */
  static redact(content: string): string {
    if (!content) return content;

    let redacted = content;
    const matches: string[] = [];

    for (const rule of REDACTION_RULES) {
      // Reset regex lastIndex for global patterns
      rule.pattern.lastIndex = 0;

      const before = redacted;
      redacted = redacted.replace(rule.pattern, rule.replacement);

      if (redacted !== before) {
        matches.push(rule.label);
      }
    }

    if (matches.length > 0) {
      console.log(
        `[ContextLens:Redaction] Scrubbed ${matches.length} pattern(s): ${matches.join(', ')}`
      );
    }

    return redacted;
  }

  /**
   * Quick check to determine if content contains any sensitive patterns.
   * Useful for gating expensive operations.
   * 
   * @param content Text to scan.
   * @returns true if at least one pattern matches.
   */
  static containsSensitive(content: string): boolean {
    if (!content) return false;

    for (const rule of REDACTION_RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(content)) {
        return true;
      }
    }
    return false;
  }
}
