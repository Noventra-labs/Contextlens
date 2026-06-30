/**
 * MCP Feature Flags
 *
 * Controls visibility and availability of MCP tools.
 * Tools with disabled flags are hidden from tools/list.
 */

export enum McpFeatureFlag {
  /** Master switch — disables entire MCP server when off */
  MCP_ENABLED = 'MCP_ENABLED',
  /** Beta tools — visible but marked as beta */
  MCP_BETA = 'MCP_BETA',
  /** Internal-only tools — hidden from public clients */
  MCP_INTERNAL = 'MCP_INTERNAL',
  /** Experimental tools — may change or break */
  MCP_EXPERIMENTAL = 'MCP_EXPERIMENTAL',
}

/**
 * Default flag states. All stable features enabled by default.
 */
const flagDefaults: Record<McpFeatureFlag, boolean> = {
  [McpFeatureFlag.MCP_ENABLED]: true,
  [McpFeatureFlag.MCP_BETA]: true,
  [McpFeatureFlag.MCP_INTERNAL]: false,
  [McpFeatureFlag.MCP_EXPERIMENTAL]: false,
};

/** Runtime overrides (can be set via VS Code settings or env vars) */
const flagOverrides: Map<McpFeatureFlag, boolean> = new Map();

/**
 * Check if a feature flag is enabled.
 */
export function isFeatureEnabled(flag: McpFeatureFlag): boolean {
  if (flagOverrides.has(flag)) {
    return flagOverrides.get(flag)!;
  }
  return flagDefaults[flag] ?? false;
}

/**
 * Override a feature flag at runtime.
 */
export function setFeatureFlag(flag: McpFeatureFlag, enabled: boolean): void {
  flagOverrides.set(flag, enabled);
}

/**
 * Reset all overrides back to defaults.
 */
export function resetFeatureFlags(): void {
  flagOverrides.clear();
}
