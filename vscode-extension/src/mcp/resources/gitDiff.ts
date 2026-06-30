/**
 * MCP Resource: workspace://git-diff
 *
 * Returns the current git diff for the workspace.
 */

import { GitContext } from '../../gitContext';
import { McpResource } from './workspace';

export const gitDiffResource: McpResource = {
  uri: 'workspace://git-diff',
  name: 'Git Diff',
  description: 'Current uncommitted changes (git diff) in the active workspace',
  mimeType: 'text/plain',
  handler: async () => {
    const ctx = await GitContext.getContext();
    return {
      uri: 'workspace://git-diff',
      mimeType: 'text/plain',
      text: ctx.diff || 'No uncommitted changes.',
    };
  },
};
