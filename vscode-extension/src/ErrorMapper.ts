import * as vscode from 'vscode';

/**
 * ErrorMapper — translates raw API errors into user-friendly notifications.
 *
 * Maps:
 * - API error codes (from backend's errors.js) → user messages + actions
 * - Network errors → offline messages
 * - Auth errors → sign-in prompts
 *
 * Usage:
 *   const mapped = ErrorMapper.map(error);
 *   notifier.fromMapped(mapped);
 */

export interface MappedError {
  /** Notification severity level. */
  level: 'success' | 'info' | 'warning' | 'error';
  /** User-friendly message to display. */
  message: string;
  /** Optional action button. */
  action?: {
    label: string;
    onAction: () => void;
  };
  /** Whether the operation should be retried automatically. */
  retryable: boolean;
  /** Original error code for programmatic use. */
  code: string;
}

// ── Error Code → User Message Map ──────────────────────────────────────────

const ERROR_MAP: Record<string, {
  level: MappedError['level'];
  message: string;
  actionLabel?: string;
  actionCommand?: string;
  retryable: boolean;
}> = {
  AUTH_ERROR: {
    level: 'warning',
    message: 'Authentication failed. Please sign in again.',
    actionLabel: 'Sign In',
    actionCommand: 'contextlens.signIn',
    retryable: false,
  },
  AUTH_EXPIRED: {
    level: 'warning',
    message: 'Session expired. Sign in again to continue syncing.',
    actionLabel: 'Sign In',
    actionCommand: 'contextlens.signIn',
    retryable: false,
  },
  NETWORK_OFFLINE: {
    level: 'info',
    message: "You're offline. Changes are saved locally and will sync automatically.",
    retryable: true,
  },
  NETWORK_TIMEOUT: {
    level: 'warning',
    message: 'Request timed out. Will retry automatically.',
    retryable: true,
  },
  RATE_LIMITED: {
    level: 'info',
    message: 'Too many requests. Backing off and retrying shortly.',
    retryable: true,
  },
  VALIDATION_ERROR: {
    level: 'warning',
    message: 'Some data was incomplete and could not be processed.',
    retryable: false,
  },
  PERMISSION_DENIED: {
    level: 'error',
    message: "You don't have permission to access this resource.",
    retryable: false,
  },
  RESOURCE_NOT_FOUND: {
    level: 'warning',
    message: 'The requested resource was not found. It may have been deleted.',
    retryable: false,
  },
  PAYLOAD_TOO_LARGE: {
    level: 'warning',
    message: 'Data payload is too large. Some content will be truncated.',
    retryable: false,
  },
  DUPLICATE_EVENT: {
    level: 'info',
    message: 'Duplicate event skipped.',
    retryable: false,
  },
  AI_SERVICE_UNAVAILABLE: {
    level: 'info',
    message: 'AI summary is temporarily unavailable. Your work is still saved.',
    retryable: true,
  },
  AI_RESPONSE_INVALID: {
    level: 'warning',
    message: 'AI returned an unexpected response. Your data is safe.',
    retryable: true,
  },
  STORAGE_WRITE_FAILED: {
    level: 'error',
    message: 'Failed to save data. Will retry automatically.',
    retryable: true,
  },
  FIRESTORE_ERROR: {
    level: 'warning',
    message: 'Cloud storage is temporarily unavailable. Retrying automatically.',
    retryable: true,
  },
  CONFIG_ERROR: {
    level: 'error',
    message: 'Server configuration error. Please check your settings.',
    actionLabel: 'Open Settings',
    actionCommand: 'contextlens.openSettings',
    retryable: false,
  },
  INTERNAL_ERROR: {
    level: 'error',
    message: 'Unexpected server error. Please try again later.',
    retryable: true,
  },
};

// ── Network Error Detection ────────────────────────────────────────────────

const NETWORK_PATTERNS = [
  'network', 'fetch failed', 'econnrefused', 'enotfound',
  'etimedout', 'failed to fetch', 'net::err', 'econnreset',
  'socket hang up', 'dns', 'offline',
];

function isNetworkError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return NETWORK_PATTERNS.some(p => msg.includes(p));
}

function isTimeoutError(err: any): boolean {
  const msg = (err?.message || '').toLowerCase();
  return msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted');
}

// ── Main Mapper ────────────────────────────────────────────────────────────

export class ErrorMapper {
  /**
   * Maps a raw error or API response error to a user-friendly notification descriptor.
   *
   * @param err - Raw error, or parsed API error body.
   * @param retryCallback - Optional callback for retry action buttons.
   */
  static map(err: any, retryCallback?: () => void): MappedError {
    // 1. Try to extract structured error code from API response
    const code: string | undefined = err?.code || err?.error?.code;
    if (code && ERROR_MAP[code]) {
      const entry = ERROR_MAP[code];
      let action: MappedError['action'] | undefined;

      if (entry.actionLabel && entry.actionCommand) {
        action = {
          label: entry.actionLabel,
          onAction: () => vscode.commands.executeCommand(entry.actionCommand!),
        };
      } else if (entry.retryable && retryCallback) {
        action = { label: 'Retry', onAction: retryCallback };
      }

      return {
        level: entry.level,
        message: entry.message,
        action,
        retryable: entry.retryable,
        code,
      };
    }

    // 2. Network error detection
    if (isNetworkError(err)) {
      return {
        level: 'info',
        message: "You're offline. Changes are saved locally and will sync automatically.",
        retryable: true,
        code: 'NETWORK_OFFLINE',
      };
    }

    // 3. Timeout detection
    if (isTimeoutError(err)) {
      return {
        level: 'warning',
        message: 'Request timed out. Will retry automatically.',
        retryable: true,
        code: 'NETWORK_TIMEOUT',
        action: retryCallback ? { label: 'Retry', onAction: retryCallback } : undefined,
      };
    }

    // 4. HTTP status code fallback
    const status = err?.status || err?.statusCode;
    if (status === 401 || status === 403) {
      return {
        level: 'warning',
        message: 'Authentication failed. Please sign in again.',
        action: {
          label: 'Sign In',
          onAction: () => vscode.commands.executeCommand('contextlens.signIn'),
        },
        retryable: false,
        code: 'AUTH_ERROR',
      };
    }
    if (status === 429) {
      return {
        level: 'info',
        message: 'Too many requests. Backing off and retrying shortly.',
        retryable: true,
        code: 'RATE_LIMITED',
      };
    }

    // 5. Fallback — generic error
    return {
      level: 'error',
      message: 'An unexpected error occurred. Please try again.',
      retryable: true,
      code: 'INTERNAL_ERROR',
      action: retryCallback ? { label: 'Retry', onAction: retryCallback } : undefined,
    };
  }
}
