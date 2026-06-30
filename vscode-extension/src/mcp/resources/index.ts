/**
 * MCP Resource Registry
 *
 * Central registry for all MCP resources. Supports resources/list and resources/read.
 */

import { McpResource } from './workspace';
import { workspaceResource } from './workspace';
import { gitDiffResource } from './gitDiff';
import { episodesResource } from './episodes';
import { diagnosticsResource } from './diagnostics';
import { symbolsResource } from './symbols';

const resources: Map<string, McpResource> = new Map();

// Register all resources
[workspaceResource, gitDiffResource, episodesResource, diagnosticsResource, symbolsResource].forEach(r => {
  resources.set(r.uri, r);
});

/**
 * List all available resources.
 */
export function listResources(): Array<{
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}> {
  return Array.from(resources.values()).map(r => ({
    uri: r.uri,
    name: r.name,
    description: r.description,
    mimeType: r.mimeType,
  }));
}

/**
 * Read a resource by URI.
 */
export async function readResource(
  uri: string
): Promise<{ uri: string; mimeType: string; text: string } | null> {
  const resource = resources.get(uri);
  if (!resource) return null;
  return resource.handler();
}

/**
 * Register an additional resource (for plugin system).
 */
export function registerResource(resource: McpResource): void {
  resources.set(resource.uri, resource);
}
