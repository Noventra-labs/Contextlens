/**
 * MCP Permission System
 * 
 * Defines permission levels for MCP tools.
 * Each tool declares required permissions; validated before execution.
 */

export enum McpPermission {
  /** Read-only access to workspace state, episodes, status */
  READ = 'READ',
  /** Write access — create/close episodes, log calls */
  WRITE = 'WRITE',
  /** Administrative operations — configuration, setup */
  ADMIN = 'ADMIN',
  /** AI-powered operations — explain diff, summaries */
  AI = 'AI',
  /** Search operations — context search, history queries */
  SEARCH = 'SEARCH',
}

/**
 * Validate that requested permissions are satisfied by granted permissions.
 * Currently all permissions are granted (single-user local extension).
 * This infrastructure exists for future multi-user / remote MCP scenarios.
 */
export function validatePermissions(
  required: McpPermission[],
  granted: McpPermission[] = Object.values(McpPermission)
): { allowed: boolean; missing: McpPermission[] } {
  const missing = required.filter(p => !granted.includes(p));
  return {
    allowed: missing.length === 0,
    missing,
  };
}
