/**
 * MCP Tool Registry
 *
 * Central registry for all MCP tools. Tools self-register on import.
 * Generates tools/list response, dispatches tools/call, enforces permissions and feature flags.
 */

import { McpPermission, validatePermissions } from '../permissions';
import { McpFeatureFlag, isFeatureEnabled } from '../featureFlags';

/**
 * Standard tool schema — every MCP tool must conform to this interface.
 */
export interface McpToolDefinition {
  /** Unique tool name (e.g. 'get_status') */
  name: string;
  /** Human-readable description */
  description: string;
  /** Semantic version */
  version: string;
  /** Grouping category */
  category: 'status' | 'episode' | 'ai' | 'git' | 'search' | 'memory' | 'system';
  /** JSON Schema for input */
  inputSchema: Record<string, any>;
  /** JSON Schema for output (informational) */
  outputSchema?: Record<string, any>;
  /** Required permissions */
  permissions: McpPermission[];
  /** Feature flag gating this tool — tool hidden if flag disabled */
  featureFlag?: McpFeatureFlag;
  /** Handler function — receives args, returns result text */
  handler: (args: Record<string, any>, context: ToolContext) => Promise<string>;
}

/**
 * Runtime context passed to every tool handler.
 */
export interface ToolContext {
  /** Client identifier (e.g. 'claude-desktop', 'cursor') */
  clientId?: string;
  /** Granted permissions for this request */
  grantedPermissions: McpPermission[];
}

/**
 * Singleton tool registry.
 */
export class ToolRegistry {
  private static instance: ToolRegistry;
  private tools: Map<string, McpToolDefinition> = new Map();

  private constructor() {}

  static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  /**
   * Register a tool. Overwrites if same name exists (for hot-reload / versioning).
   */
  register(tool: McpToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Get a tool by name.
   */
  get(name: string): McpToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * List all tools visible to clients (respects feature flags).
   * Returns MCP-compliant tools/list response format.
   */
  listTools(): Array<{
    name: string;
    description: string;
    inputSchema: Record<string, any>;
  }> {
    const result: Array<{ name: string; description: string; inputSchema: Record<string, any> }> = [];

    for (const tool of this.tools.values()) {
      // Skip tools gated behind disabled feature flags
      if (tool.featureFlag && !isFeatureEnabled(tool.featureFlag)) {
        continue;
      }
      result.push({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      });
    }

    return result;
  }

  /**
   * Execute a tool by name. Validates permissions before running.
   * Returns { text, isError } for MCP response.
   */
  async callTool(
    name: string,
    args: Record<string, any>,
    context: ToolContext
  ): Promise<{ text: string; isError: boolean }> {
    const tool = this.tools.get(name);

    if (!tool) {
      return { text: `Tool not found: ${name}`, isError: true };
    }

    // Check feature flag
    if (tool.featureFlag && !isFeatureEnabled(tool.featureFlag)) {
      return { text: `Tool '${name}' is not available`, isError: true };
    }

    // Validate permissions
    const permCheck = validatePermissions(tool.permissions, context.grantedPermissions);
    if (!permCheck.allowed) {
      return {
        text: `Permission denied for tool '${name}'. Missing: ${permCheck.missing.join(', ')}`,
        isError: true,
      };
    }

    try {
      const result = await tool.handler(args, context);
      return { text: result, isError: false };
    } catch (err: any) {
      return { text: `Error executing '${name}': ${err.message}`, isError: true };
    }
  }

  /**
   * Get count of registered tools.
   */
  get size(): number {
    return this.tools.size;
  }

  /**
   * Get all tool definitions (for internal use / debugging).
   */
  getAllTools(): McpToolDefinition[] {
    return Array.from(this.tools.values());
  }
}
