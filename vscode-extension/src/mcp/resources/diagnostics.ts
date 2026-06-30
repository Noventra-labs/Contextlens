/**
 * MCP Resource: workspace://diagnostics
 *
 * Returns current VS Code diagnostics (errors, warnings) for the workspace.
 */

import * as vscode from 'vscode';
import { McpResource } from './workspace';

export const diagnosticsResource: McpResource = {
  uri: 'workspace://diagnostics',
  name: 'Diagnostics',
  description: 'Current VS Code diagnostics (errors, warnings, hints) across the workspace',
  mimeType: 'application/json',
  handler: async () => {
    const allDiagnostics = vscode.languages.getDiagnostics();
    const entries: Array<{
      file: string;
      severity: string;
      message: string;
      line: number;
      column: number;
      source: string;
    }> = [];

    for (const [uri, diagnostics] of allDiagnostics) {
      for (const diag of diagnostics) {
        entries.push({
          file: vscode.workspace.asRelativePath(uri),
          severity: vscode.DiagnosticSeverity[diag.severity],
          message: diag.message,
          line: diag.range.start.line + 1,
          column: diag.range.start.character + 1,
          source: diag.source || 'unknown',
        });
      }
    }

    const summary = {
      totalFiles: new Set(entries.map(e => e.file)).size,
      errors: entries.filter(e => e.severity === 'Error').length,
      warnings: entries.filter(e => e.severity === 'Warning').length,
      hints: entries.filter(e => e.severity === 'Hint' || e.severity === 'Information').length,
      diagnostics: entries.slice(0, 100), // Cap at 100
    };

    return {
      uri: 'workspace://diagnostics',
      mimeType: 'application/json',
      text: JSON.stringify(summary, null, 2),
    };
  },
};
