import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { EpisodeStore } from './episodeStore';
import { getAuthManager } from './auth';
import { ApiClient } from './apiClient';
import { GitContext } from './gitContext';
import { createHash, randomBytes } from 'crypto';
import { ToolRegistry } from './mcp/registry/ToolRegistry';
import { McpPermission } from './mcp/permissions';

// Import all tools — side-effect registers them into the registry
import './mcp/tools/index';

let server: http.Server | null = null;
const PORT = 3012;

// Per-session local secret for MCP auth.
// Only the bridge process (which reads this secret) can make requests.
let localSecret: string = '';

export function getMcpSecret(): string {
  return localSecret;
}

export function startMcpServer() {
  if (server) return;

  // Generate a random secret for this session
  localSecret = randomBytes(32).toString('hex');

  // Save secret for local bridge access
  try {
    const secretPath = path.join(__dirname, '..', '.mcp-secret.json');
    fs.writeFileSync(secretPath, JSON.stringify({ secret: localSecret }), 'utf8');
  } catch (err: any) {
    console.error('[ContextLens] Failed to save MCP secret file:', err);
  }

  const registry = ToolRegistry.getInstance();

  server = http.createServer(async (req, res) => {
    // Enable JSON responses
    res.setHeader('Content-Type', 'application/json');

    // CORS headers for safety
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-MCP-Secret');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Validate local secret on every request
    const requestSecret = req.headers['x-mcp-secret'] as string;
    if (!requestSecret || requestSecret !== localSecret) {
      res.writeHead(401);
      res.end(JSON.stringify({ error: 'Unauthorized — invalid or missing MCP secret' }));
      return;
    }

    const url = new URL(req.url || '', `http://${req.headers.host}`);

    try {
      // ── Registry-powered tool dispatch ──────────────────────────────────

      if (req.method === 'POST' && url.pathname === '/mcp/tools/list') {
        const tools = registry.listTools();
        res.writeHead(200);
        res.end(JSON.stringify({ tools }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/mcp/tools/call') {
        const body = await getBody(req);
        const { name, arguments: args } = body;
        const result = await registry.callTool(name, args || {}, {
          clientId: req.headers['x-mcp-client'] as string,
          grantedPermissions: Object.values(McpPermission),
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      // ── Legacy endpoints (backward compatibility) ───────────────────────
      // These remain so existing bridge versions continue working.

      if (req.method === 'GET' && url.pathname === '/status') {
        const store = EpisodeStore.get();
        const authManager = getAuthManager();
        const isAuthenticated = authManager ? !!(await authManager.getIdToken()) : false;

        res.writeHead(200);
        res.end(JSON.stringify({
          projectId: store.getProjectId(),
          episodeId: store.getActiveEpisode()?.id || null,
          projectName: store.getProjectName(),
          activeEpisodeName: store.getActiveEpisode()?.name || null,
          authenticated: isAuthenticated
        }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/start-episode') {
        const body = await getBody(req);
        const name = body.name || `MCP Session ${new Date().toISOString().slice(0, 10)}`;
        await EpisodeStore.get().createEpisode(name);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, episode: EpisodeStore.get().getActiveEpisode() }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/close-episode') {
        await EpisodeStore.get().closeEpisode();
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/log-call') {
        const body = await getBody(req);
        if (!body.promptText) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'promptText is required' }));
          return;
        }

        const gitCtx = await GitContext.getContext();
        const payload = {
          promptText: body.promptText,
          modelResponse: body.modelResponse || '',
          source: body.source || 'chat',
          modelName: body.modelName || 'agent',
          intentTag: body.intentTag || 'developer-assistant',
          branchName: gitCtx.branch || 'main',
          activeFilePath: body.activeFilePath || '',
          relatedFiles: body.relatedFiles || [],
          diffSnapshot: gitCtx.diff || null,
          diffHash: gitCtx.diff ? createHash('md5').update(gitCtx.diff).digest('hex') : null
        };

        EpisodeStore.get().enqueueCall(payload);
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/explain-diff') {
        const store = EpisodeStore.get();
        const episode = store.getActiveEpisode();
        const projectId = store.getProjectId();

        if (!episode || !projectId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No active episode or project' }));
          return;
        }

        const gitCtx = await GitContext.getContext();
        if (!gitCtx.diff) {
          res.writeHead(200);
          res.end(JSON.stringify({ summary: 'No changes to explain.' }));
          return;
        }

        const diffHash = createHash('md5').update(gitCtx.diff).digest('hex');
        const result = await ApiClient.explainDiff({
          projectId,
          episodeId: episode.id,
          diffHash,
          changedFiles: episode.changedFiles
        });

        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/search') {
        const body = await getBody(req);
        const store = EpisodeStore.get();
        const projectId = store.getProjectId();
        if (!projectId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No active project' }));
          return;
        }
        const result = await ApiClient.post('/search', {
          projectId,
          q: body.q || ''
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/get-episode') {
        const body = await getBody(req);
        const store = EpisodeStore.get();
        const projectId = store.getProjectId();
        if (!projectId || !body.episodeId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'projectId and episodeId are required' }));
          return;
        }
        const result = await ApiClient.post('/episodes/get', {
          projectId,
          episodeId: body.episodeId
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/list-episodes') {
        const body = await getBody(req);
        const store = EpisodeStore.get();
        const projectId = store.getProjectId();
        if (!projectId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No active project' }));
          return;
        }
        const result = await ApiClient.post('/episodes/list', {
          projectId,
          limit: body.limit
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/explain-past-changes') {
        const body = await getBody(req);
        const store = EpisodeStore.get();
        const projectId = store.getProjectId();
        if (!projectId || !body.episodeId) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'projectId and episodeId are required' }));
          return;
        }
        const result = await ApiClient.post('/episodes/explain', {
          projectId,
          episodeId: body.episodeId
        });
        res.writeHead(200);
        res.end(JSON.stringify(result));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not Found' }));
    } catch (err: any) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[ContextLens] MCP helper server running on http://127.0.0.1:${PORT}`);
  });
}

export function stopMcpServer() {
  if (server) {
    server.close();
    server = null;
  }
  try {
    const secretPath = path.join(__dirname, '..', '.mcp-secret.json');
    if (fs.existsSync(secretPath)) {
      fs.unlinkSync(secretPath);
    }
  } catch (err: any) {
    console.error('[ContextLens] Failed to delete MCP secret file:', err);
  }
}

function getBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}
