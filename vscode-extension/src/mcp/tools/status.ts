/**
 * MCP Tool: get_status
 * 
 * Returns ContextLens extension status, active project, and episode info.
 */

import { ToolRegistry, McpToolDefinition } from '../registry/ToolRegistry';
import { McpPermission } from '../permissions';
import { EpisodeStore } from '../../episodeStore';
import { getAuthManager } from '../../auth';

const statusTool: McpToolDefinition = {
  name: 'get_status',
  description: 'Get ContextLens VS Code extension active status, active project, and active episode',
  version: '1.0.0',
  category: 'status',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  permissions: [McpPermission.READ],
  handler: async (_args, _context) => {
    const store = EpisodeStore.get();
    const authManager = getAuthManager();
    const isAuthenticated = authManager ? !!(await authManager.getIdToken()) : false;

    const lines = [
      `VS Code Connection: ✅ Online`,
      `Project ID: ${store.getProjectId() || '❌ Not configured in VS Code'}`,
      `Project Name: ${store.getProjectName() || 'N/A'}`,
      `Active Episode ID: ${store.getActiveEpisode()?.id || '❌ None active'}`,
      `Active Episode Name: ${store.getActiveEpisode()?.name || 'N/A'}`,
      `Authentication: ${isAuthenticated ? '✅ Authenticated' : '❌ Not signed in inside VS Code'}`,
    ];
    return lines.join('\n');
  },
};

ToolRegistry.getInstance().register(statusTool);

export default statusTool;
