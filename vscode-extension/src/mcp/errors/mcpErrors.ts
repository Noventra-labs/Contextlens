/**
 * MCP Error Codes & Error Handling
 *
 * Unique error codes with actionable messages.
 * Provides an error catalog for clients to reference.
 */

export interface McpErrorInfo {
  code: string;
  httpStatus: number;
  message: string;
  action: string;
}

/**
 * ContextLens MCP Error Catalog.
 * Format: CL-MCP-XXX
 */
export const MCP_ERRORS: Record<string, McpErrorInfo> = {
  'CL-MCP-001': {
    code: 'CL-MCP-001',
    httpStatus: 401,
    message: 'Authentication failed — invalid or expired MCP token',
    action: 'Restart VS Code to generate a new token, or check if the extension is running.',
  },
  'CL-MCP-002': {
    code: 'CL-MCP-002',
    httpStatus: 429,
    message: 'Rate limit exceeded',
    action: 'Wait before retrying. Check X-RateLimit-Remaining header for remaining quota.',
  },
  'CL-MCP-003': {
    code: 'CL-MCP-003',
    httpStatus: 403,
    message: 'Permission denied for this tool',
    action: 'This tool requires elevated permissions. Check tool documentation.',
  },
  'CL-MCP-004': {
    code: 'CL-MCP-004',
    httpStatus: 404,
    message: 'Tool not found',
    action: 'Use tools/list to see available tools. Check tool name spelling.',
  },
  'CL-MCP-005': {
    code: 'CL-MCP-005',
    httpStatus: 400,
    message: 'Invalid input parameters',
    action: 'Check the tool inputSchema for required fields and types.',
  },
  'CL-MCP-006': {
    code: 'CL-MCP-006',
    httpStatus: 503,
    message: 'Extension not running or not reachable',
    action: 'Open VS Code and ensure the ContextLens extension is activated.',
  },
  'CL-MCP-007': {
    code: 'CL-MCP-007',
    httpStatus: 400,
    message: 'No active project configured',
    action: 'Sign in to ContextLens and open a workspace folder in VS Code.',
  },
  'CL-MCP-008': {
    code: 'CL-MCP-008',
    httpStatus: 400,
    message: 'No active episode',
    action: 'Start an episode first using the start_episode tool.',
  },
  'CL-MCP-009': {
    code: 'CL-MCP-009',
    httpStatus: 500,
    message: 'Backend API error',
    action: 'Check your internet connection. The ContextLens backend may be temporarily unavailable.',
  },
  'CL-MCP-010': {
    code: 'CL-MCP-010',
    httpStatus: 400,
    message: 'Feature not available',
    action: 'This feature is gated behind a feature flag. It may be in beta or experimental.',
  },
};

/**
 * Get error info by code.
 */
export function getErrorInfo(code: string): McpErrorInfo | undefined {
  return MCP_ERRORS[code];
}

/**
 * Create a structured error response with actionable guidance.
 */
export function createActionableError(
  errorCode: string,
  additionalContext?: string
): { error: string; code: string; action: string; details?: string } {
  const info = MCP_ERRORS[errorCode];
  if (!info) {
    return {
      error: 'Unknown error',
      code: errorCode,
      action: 'Contact ContextLens support.',
      details: additionalContext,
    };
  }
  return {
    error: info.message,
    code: info.code,
    action: info.action,
    ...(additionalContext ? { details: additionalContext } : {}),
  };
}

/**
 * Get the full error catalog (for documentation / debugging).
 */
export function getErrorCatalog(): McpErrorInfo[] {
  return Object.values(MCP_ERRORS);
}
