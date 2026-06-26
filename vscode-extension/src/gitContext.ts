import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitContextData {
  branch: string | null;
  diff: string | null;
  activeFile: string | null;
  markers: string[];
  isGitRepo: boolean;
}

export class GitContext {
  static async getContext(workspaceRoot?: string): Promise<GitContextData> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return {
        branch: null,
        diff: null,
        activeFile: null,
        markers: [],
        isGitRepo: false
      };
    }

    let cwd = workspaceRoot;
    if (!cwd) {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const folder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
        if (folder) cwd = folder.uri.fsPath;
      }
      if (!cwd) cwd = workspaceFolders[0].uri.fsPath;
    }
    let isGitRepo = true;
    let branch = null;
    let diff = null;

    try {
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', { cwd });
      if (stdout.trim() !== 'true') {
        isGitRepo = false;
      }
    } catch {
      isGitRepo = false;
    }

    if (isGitRepo) {
      try {
        const { stdout: branchOut } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd });
        branch = branchOut.trim();
        const { stdout: diffOut } = await execAsync('git diff', { cwd });
        diff = diffOut.trim();
      } catch (e) {
        console.error('Git execution failed', e);
      }
    }

    let activeFile = null;
    const markers: string[] = [];
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      activeFile = editor.document.uri.fsPath;
      const text = editor.document.getText();
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (/(TODO|FIXME|HACK)/.test(line)) {
          markers.push(`Line ${index + 1}: ${line.trim()}`);
        }
      });
    }

    return {
      branch,
      diff,
      activeFile,
      markers,
      isGitRepo
    };
  }
}
