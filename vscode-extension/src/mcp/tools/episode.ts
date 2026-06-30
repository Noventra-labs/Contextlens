/**
 * MCP Tools: Episode management
 *
 * start_episode, close_episode, get_episode_details, get_recent_episodes
 */

import { ToolRegistry, McpToolDefinition } from '../registry/ToolRegistry';
import { McpPermission } from '../permissions';
import { EpisodeStore } from '../../episodeStore';
import { ApiClient } from '../../apiClient';

// ── start_episode ───────────────────────────────────────────────────────────

const startEpisode: McpToolDefinition = {
  name: 'start_episode',
  description: 'Start a new tracking episode in the active VS Code workspace',
  version: '1.0.0',
  category: 'episode',
  inputSchema: {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'Label/description for this episode (e.g. Fixing billing bug)' },
    },
  },
  permissions: [McpPermission.WRITE],
  handler: async (args, _context) => {
    const name = args.label || `MCP Session ${new Date().toISOString().slice(0, 10)}`;
    await EpisodeStore.get().createEpisode(name);
    const episode = EpisodeStore.get().getActiveEpisode();
    return `Successfully created new episode: "${episode?.name}" (ID: ${episode?.id})`;
  },
};

// ── close_episode ───────────────────────────────────────────────────────────

const closeEpisode: McpToolDefinition = {
  name: 'close_episode',
  description: 'Close the currently active episode in VS Code',
  version: '1.0.0',
  category: 'episode',
  inputSchema: {
    type: 'object',
    properties: {},
  },
  permissions: [McpPermission.WRITE],
  handler: async (_args, _context) => {
    await EpisodeStore.get().closeEpisode();
    return 'Successfully closed the active episode.';
  },
};

// ── get_episode_details ─────────────────────────────────────────────────────

const getEpisodeDetails: McpToolDefinition = {
  name: 'get_episode_details',
  description: 'Get detailed information about a specific episode and its AI calls',
  version: '1.0.0',
  category: 'episode',
  inputSchema: {
    type: 'object',
    properties: {
      episodeId: { type: 'string', description: 'The UUID of the episode' },
    },
    required: ['episodeId'],
  },
  permissions: [McpPermission.READ],
  handler: async (args, _context) => {
    const store = EpisodeStore.get();
    const projectId = store.getProjectId();
    if (!projectId || !args.episodeId) {
      throw new Error('projectId and episodeId are required');
    }
    const res: any = await ApiClient.post('/episodes/get', {
      projectId,
      episodeId: args.episodeId,
    });
    if (res.error) { throw new Error(res.error); }

    const ep = res.episode;
    const calls = res.calls || [];
    const callsText = calls.map((c: any) =>
      `[${new Date(c.createdAt?._seconds * 1000 || c.createdAt).toLocaleString()}] ${c.source.toUpperCase()} (${c.modelName || 'Unknown model'})\n- Prompt: ${c.promptText}\n- Response: ${c.modelResponse}`
    ).join('\n\n') || 'No calls in this episode.';

    const lines = [
      `### Episode Details: "${ep.label}"`,
      `- ID: ${ep.id}`,
      `- Status: ${ep.status}`,
      `- Branch: ${ep.branchName}`,
      `- Started At: ${new Date(ep.startedAt?._seconds * 1000 || ep.startedAt).toLocaleString()}`,
      `- Changed Files: ${ep.changedFiles?.join(', ') || 'None'}`,
      `\n**AI Activity Log:**`,
      callsText,
    ];
    return lines.join('\n');
  },
};

// ── get_recent_episodes ─────────────────────────────────────────────────────

const getRecentEpisodes: McpToolDefinition = {
  name: 'get_recent_episodes',
  description: 'Get recently accessed or modified episodes',
  version: '1.0.0',
  category: 'episode',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Maximum number of episodes to return (optional, default 5)' },
    },
  },
  permissions: [McpPermission.READ],
  handler: async (args, _context) => {
    const store = EpisodeStore.get();
    const projectId = store.getProjectId();
    if (!projectId) { throw new Error('No active project'); }

    const res: any = await ApiClient.post('/episodes/list', {
      projectId,
      limit: args.limit,
    });
    if (res.error) { throw new Error(res.error); }

    const lines = [
      `### Recent Coding Episodes`,
      (res.episodes || []).map((e: any) =>
        `- [${e.status}] "${e.label}" (ID: ${e.id}, Branch: ${e.branchName}, Started: ${new Date(e.startedAt?._seconds * 1000 || e.startedAt).toLocaleString()})`
      ).join('\n') || 'No episodes found.',
    ];
    return lines.join('\n');
  },
};

// ── Register all ────────────────────────────────────────────────────────────

const registry = ToolRegistry.getInstance();
registry.register(startEpisode);
registry.register(closeEpisode);
registry.register(getEpisodeDetails);
registry.register(getRecentEpisodes);

export { startEpisode, closeEpisode, getEpisodeDetails, getRecentEpisodes };
