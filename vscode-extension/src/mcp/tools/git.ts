/**
 * MCP Tools: Git operations
 *
 * explain_diff, explain_past_changes
 */

import { ToolRegistry, McpToolDefinition } from '../registry/ToolRegistry';
import { McpPermission } from '../permissions';
import { EpisodeStore } from '../../episodeStore';
import { ApiClient } from '../../apiClient';
import { GitContext } from '../../gitContext';
import { createHash } from 'crypto';

// ── explain_diff ────────────────────────────────────────────────────────────

const explainDiff: McpToolDefinition = {
  name: 'explain_diff',
  description: "Request an AI explanation and code audit of the current episode's diff",
  version: '1.0.0',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  permissions: [McpPermission.READ, McpPermission.AI],
  handler: async (_args, _context) => {
    const store = EpisodeStore.get();
    const episode = store.getActiveEpisode();
    const projectId = store.getProjectId();

    if (!episode || !projectId) {
      throw new Error('No active episode or project');
    }

    const gitCtx = await GitContext.getContext();
    if (!gitCtx.diff) {
      return 'No changes to explain.';
    }

    const diffHash = createHash('md5').update(gitCtx.diff).digest('hex');
    const result: any = await ApiClient.explainDiff({
      projectId,
      episodeId: episode.id,
      diffHash,
      changedFiles: episode.changedFiles,
    });

    if (result.error) { throw new Error(result.error); }

    const lines = [
      `### AI Explanation of Episode Diffs`,
      `**Summary:**`,
      result.summary || 'No changes to explain.',
      `\n**Risks Identified:**`,
      (result.risks && result.risks.length > 0) ? result.risks.map((r: string) => `- ${r}`).join('\n') : '- None',
      `\n**Suggested Checks:**`,
      (result.checks && result.checks.length > 0) ? result.checks.map((c: string) => `- ${c}`).join('\n') : '- None',
    ];
    return lines.join('\n');
  },
};

// ── explain_past_changes ────────────────────────────────────────────────────

const explainPastChanges: McpToolDefinition = {
  name: 'explain_past_changes',
  description: 'Request an AI explanation and audit of changes in a specific past episode',
  version: '1.0.0',
  category: 'git',
  inputSchema: {
    type: 'object',
    properties: {
      episodeId: { type: 'string', description: 'The UUID of the episode' },
    },
    required: ['episodeId'],
  },
  permissions: [McpPermission.READ, McpPermission.AI],
  handler: async (args, _context) => {
    const store = EpisodeStore.get();
    const projectId = store.getProjectId();
    if (!projectId || !args.episodeId) {
      throw new Error('projectId and episodeId are required');
    }

    const result: any = await ApiClient.post('/episodes/explain', {
      projectId,
      episodeId: args.episodeId,
    });

    if (result.error) { throw new Error(result.error); }

    const lines = [
      `### AI Explanation of Past Episode Diffs`,
      `**Summary:**`,
      result.summary || 'No changes to explain.',
      `\n**Risks Identified:**`,
      (result.risks && result.risks.length > 0) ? result.risks.map((r: string) => `- ${r}`).join('\n') : '- None',
      `\n**Suggested Checks:**`,
      (result.checks && result.checks.length > 0) ? result.checks.map((c: string) => `- ${c}`).join('\n') : '- None',
    ];
    return lines.join('\n');
  },
};

// ── Register ────────────────────────────────────────────────────────────────

const registry = ToolRegistry.getInstance();
registry.register(explainDiff);
registry.register(explainPastChanges);

export { explainDiff, explainPastChanges };
