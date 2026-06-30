/**
 * MCP Resource: workspace://episodes
 *
 * Returns list of episodes for the current project.
 */

import { EpisodeStore } from '../../episodeStore';
import { ApiClient } from '../../apiClient';
import { McpResource } from './workspace';

export const episodesResource: McpResource = {
  uri: 'workspace://episodes',
  name: 'Episodes',
  description: 'List of coding episodes in the current ContextLens project',
  mimeType: 'application/json',
  handler: async () => {
    const store = EpisodeStore.get();
    const projectId = store.getProjectId();

    if (!projectId) {
      return {
        uri: 'workspace://episodes',
        mimeType: 'application/json',
        text: JSON.stringify({ episodes: [], error: 'No active project' }),
      };
    }

    try {
      const result: any = await ApiClient.post('/episodes/list', { projectId, limit: 20 });
      return {
        uri: 'workspace://episodes',
        mimeType: 'application/json',
        text: JSON.stringify({ episodes: result.episodes || [] }, null, 2),
      };
    } catch (err: any) {
      return {
        uri: 'workspace://episodes',
        mimeType: 'application/json',
        text: JSON.stringify({ episodes: [], error: err.message }),
      };
    }
  },
};
