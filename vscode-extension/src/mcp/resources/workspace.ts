/**
 * MCP Resource: workspace://current
 *
 * Returns current workspace metadata.
 */

import * as vscode from 'vscode';
import { EpisodeStore } from '../../episodeStore';
import { getAuthManager } from '../../auth';

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  handler: () => Promise<{ uri: string; mimeType: string; text: string }>;
}

export const workspaceResource: McpResource = {
  uri: 'workspace://current',
  name: 'Current Workspace',
  description: 'Metadata about the current VS Code workspace, project, and active episode',
  mimeType: 'application/json',
  handler: async () => {
    const store = EpisodeStore.get();
    const folders = vscode.workspace.workspaceFolders || [];
    const authManager = getAuthManager();
    const isAuthenticated = authManager ? !!(await authManager.getIdToken()) : false;

    const data = {
      workspaceName: vscode.workspace.name || null,
      workspaceFolders: folders.map(f => ({
        name: f.name,
        uri: f.uri.toString(),
      })),
      projectId: store.getProjectId(),
      projectName: store.getProjectName(),
      activeEpisode: store.getActiveEpisode() || null,
      authenticated: isAuthenticated,
      vscodeVersion: vscode.version,
    };

    return {
      uri: 'workspace://current',
      mimeType: 'application/json',
      text: JSON.stringify(data, null, 2),
    };
  },
};
