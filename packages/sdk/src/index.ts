/**
 * ContextLens SDK
 *
 * Types and interfaces for creating custom tools, resources, and prompts.
 */

export enum McpPermission {
  READ = 'read',
  WRITE = 'write',
  ADMIN = 'admin',
  AI = 'ai',
  SEARCH = 'search'
}

export interface ToolContext {
  clientId?: string;
  grantedPermissions?: McpPermission[];
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
  outputSchema?: Record<string, any>;
  version: string;
  requiredPermissions: McpPermission[];
  handler: (args: any, context: ToolContext) => Promise<{
    content: Array<{
      type: 'text';
      text: string;
    }>;
    isError?: boolean;
  }>;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: () => Promise<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  handler: (args: Record<string, string>) => Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
}

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
}

export interface PluginRegistration {
  manifest: PluginManifest;
  tools?: McpToolDefinition[];
  prompts?: McpPrompt[];
  resources?: McpResource[];
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
}
