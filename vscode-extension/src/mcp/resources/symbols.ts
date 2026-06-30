/**
 * MCP Resource: workspace://symbols
 *
 * Returns workspace symbol information.
 */

import * as vscode from 'vscode';
import { McpResource } from './workspace';

export const symbolsResource: McpResource = {
  uri: 'workspace://symbols',
  name: 'Workspace Symbols',
  description: 'Top-level code symbols (classes, functions, interfaces) in the workspace',
  mimeType: 'application/json',
  handler: async () => {
    try {
      const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
        'vscode.executeWorkspaceSymbolProvider',
        '' // Empty query = all top-level symbols
      );

      const entries = (symbols || []).slice(0, 200).map(s => ({
        name: s.name,
        kind: vscode.SymbolKind[s.kind],
        file: vscode.workspace.asRelativePath(s.location.uri),
        line: s.location.range.start.line + 1,
      }));

      return {
        uri: 'workspace://symbols',
        mimeType: 'application/json',
        text: JSON.stringify({ symbolCount: entries.length, symbols: entries }, null, 2),
      };
    } catch {
      return {
        uri: 'workspace://symbols',
        mimeType: 'application/json',
        text: JSON.stringify({ symbolCount: 0, symbols: [], error: 'Symbol provider unavailable' }),
      };
    }
  },
};
