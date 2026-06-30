#!/usr/bin/env node

/**
 * mcp-bridge.js
 * 
 * ContextLens MCP Stdio-to-VSCode-Extension Bridge.
 * Translates stdin/stdout JSON-RPC protocol to the local HTTP server
 * hosted inside the ContextLens VS Code extension.
 * 
 * Now uses the ToolRegistry-powered endpoints for tool listing and dispatch.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

const EXTENSION_PORT = 3012;
const EXTENSION_HOST = '127.0.0.1';
// Read MCP secret from environment (set by extension's auto-setup)
// Or fall back to reading the secret file next to the bridge.
let MCP_SECRET = process.env.CONTEXTLENS_MCP_SECRET || '';
if (!MCP_SECRET) {
  try {
    const secretPath = path.join(__dirname, '.mcp-secret.json');
    if (fs.existsSync(secretPath)) {
      const data = fs.readFileSync(secretPath, 'utf8');
      const parsed = JSON.parse(data);
      if (parsed && parsed.secret) {
        MCP_SECRET = parsed.secret;
      }
    }
  } catch (err) {
    // Silent fail
  }
}


// Intercept console functions to prevent corrupting stdout protocol
console.log = (...args) => process.stderr.write(args.join(' ') + '\n');
console.error = (...args) => process.stderr.write(args.join(' ') + '\n');
console.warn = (...args) => process.stderr.write(args.join(' ') + '\n');
console.info = (...args) => process.stderr.write(args.join(' ') + '\n');

process.stdin.setEncoding('utf8');

// Cache for tools list (fetched from registry on first tools/list call)
let cachedTools = null;

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let lineEnd = buffer.indexOf('\n');
  while (lineEnd !== -1) {
    const line = buffer.slice(0, lineEnd).trim();
    buffer = buffer.slice(lineEnd + 1);
    if (line) {
      handleMessage(line).catch(err => {
        sendErrorResponse(null, -32603, `Internal error: ${err.message}`);
      });
    }
    lineEnd = buffer.indexOf('\n');
  }
});

async function handleMessage(line) {
  let request;
  try {
    request = JSON.parse(line);
  } catch (err) {
    sendErrorResponse(null, -32700, 'Parse error');
    return;
  }

  const { jsonrpc, id, method, params } = request;
  if (jsonrpc !== '2.0') {
    sendErrorResponse(id, -32600, 'Invalid Request');
    return;
  }

  switch (method) {
    case 'initialize':
      sendResultResponse(id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'contextlens-mcp-bridge',
          version: '2.0.0'
        }
      });
      break;

    case 'notifications/initialized':
      break;

    case 'ping':
      sendResultResponse(id, {});
      break;

    case 'tools/list':
      await handleToolsList(id);
      break;

    case 'tools/call':
      await handleToolCall(id, params);
      break;

    default:
      sendErrorResponse(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Fetch tool list from the registry endpoint.
 * Falls back to hardcoded list if registry endpoint unavailable (backward compat).
 */
async function handleToolsList(id) {
  try {
    const res = await extensionRequest('/mcp/tools/list', 'POST');
    if (res.tools) {
      cachedTools = res.tools;
      sendResultResponse(id, { tools: res.tools });
      return;
    }
  } catch (err) {
    // Registry endpoint not available — fall back to hardcoded list
    console.error('Registry endpoint unavailable, using fallback tool list');
  }

  // Fallback: hardcoded tools (for older extension versions)
  sendResultResponse(id, {
    tools: getFallbackToolList()
  });
}

/**
 * Dispatch tool call through registry endpoint.
 * Falls back to legacy per-endpoint routing if registry unavailable.
 */
async function handleToolCall(id, params) {
  const { name, arguments: args } = params;

  try {
    // Try registry-powered dispatch first
    const res = await extensionRequest('/mcp/tools/call', 'POST', {
      name,
      arguments: args || {}
    });

    if (res.isError) {
      sendToolError(id, res.text);
    } else {
      sendToolResult(id, res.text);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      sendToolError(id, 'ContextLens VS Code Extension is not running. Please open VS Code and activate the ContextLens extension first.');
    } else {
      // Registry dispatch failed — try legacy routing
      try {
        await handleToolCallLegacy(id, params);
      } catch (legacyErr) {
        sendToolError(id, legacyErr.message);
      }
    }
  }
}

/**
 * Legacy tool call routing — direct HTTP endpoint mapping.
 * Used when the registry endpoint is unavailable (older extension versions).
 */
async function handleToolCallLegacy(id, params) {
  const { name, arguments: args } = params;

  switch (name) {
    case 'get_status': {
      const res = await extensionRequest('/status', 'GET');
      const text = [
        `VS Code Connection: ✅ Online`,
        `Project ID: ${res.projectId || '❌ Not configured in VS Code'}`,
        `Project Name: ${res.projectName || 'N/A'}`,
        `Active Episode ID: ${res.episodeId || '❌ None active'}`,
        `Active Episode Name: ${res.activeEpisodeName || 'N/A'}`,
        `Authentication: ${res.authenticated ? '✅ Authenticated' : '❌ Not signed in inside VS Code'}`
      ].join('\n');
      sendToolResult(id, text);
      break;
    }

    case 'start_episode': {
      const res = await extensionRequest('/start-episode', 'POST', { name: args?.label });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        sendToolResult(id, `Successfully created new episode: "${res.episode.name}" (ID: ${res.episode.id})`);
      }
      break;
    }

    case 'close_episode': {
      const res = await extensionRequest('/close-episode', 'POST');
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        sendToolResult(id, `Successfully closed the active episode.`);
      }
      break;
    }

    case 'log_ai_call': {
      const res = await extensionRequest('/log-call', 'POST', {
        promptText: args.prompt,
        modelResponse: args.response,
        modelName: args.modelName,
        intentTag: args.intent
      });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        sendToolResult(id, `AI call logged successfully inside active VS Code episode!`);
      }
      break;
    }

    case 'explain_diff': {
      const res = await extensionRequest('/explain-diff', 'POST');
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        const text = [
          `### AI Explanation of Episode Diffs`,
          `**Summary:**`,
          res.summary || 'No changes to explain.',
          `\n**Risks Identified:**`,
          (res.risks && res.risks.length > 0) ? res.risks.map(r => `- ${r}`).join('\n') : '- None',
          `\n**Suggested Checks:**`,
          (res.checks && res.checks.length > 0) ? res.checks.map(c => `- ${c}`).join('\n') : '- None'
        ].join('\n');
        sendToolResult(id, text);
      }
      break;
    }

    case 'search_context': {
      const res = await extensionRequest('/search', 'POST', { q: args.query });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        const episodesText = (res.episodes || []).map(e => `- [${e.status}] "${e.label}" (ID: ${e.id}, Branch: ${e.branchName})`).join('\n') || 'None';
        const callsText = (res.calls || []).map(c => `- Call ID: ${c.id}\n  Episode ID: ${c.episodeId}\n  Source: ${c.source}\n  Prompt: ${c.promptText.substring(0, 100)}...\n  Response: ${c.modelResponse.substring(0, 100)}...`).join('\n\n') || 'None';
        
        const text = [
          `### Search Results for "${args.query}"`,
          `**Episodes:**`,
          episodesText,
          `\n**AI Calls:**`,
          callsText
        ].join('\n');
        sendToolResult(id, text);
      }
      break;
    }

    case 'get_episode_details': {
      const res = await extensionRequest('/get-episode', 'POST', { episodeId: args.episodeId });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        const ep = res.episode;
        const calls = res.calls || [];
        const callsText = calls.map(c => `[${new Date(c.createdAt?._seconds * 1000 || c.createdAt).toLocaleString()}] ${c.source.toUpperCase()} (${c.modelName || 'Unknown model'})\n- Prompt: ${c.promptText}\n- Response: ${c.modelResponse}`).join('\n\n') || 'No calls in this episode.';
        
        const text = [
          `### Episode Details: "${ep.label}"`,
          `- ID: ${ep.id}`,
          `- Status: ${ep.status}`,
          `- Branch: ${ep.branchName}`,
          `- Started At: ${new Date(ep.startedAt?._seconds * 1000 || ep.startedAt).toLocaleString()}`,
          `- Changed Files: ${ep.changedFiles?.join(', ') || 'None'}`,
          `\n**AI Activity Log:**`,
          callsText
        ].join('\n');
        sendToolResult(id, text);
      }
      break;
    }

    case 'get_recent_episodes': {
      const res = await extensionRequest('/list-episodes', 'POST', { limit: args.limit });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        const text = [
          `### Recent Coding Episodes`,
          (res.episodes || []).map(e => `- [${e.status}] "${e.label}" (ID: ${e.id}, Branch: ${e.branchName}, Started: ${new Date(e.startedAt?._seconds * 1000 || e.startedAt).toLocaleString()})`).join('\n') || 'No episodes found.'
        ].join('\n');
        sendToolResult(id, text);
      }
      break;
    }

    case 'explain_past_changes': {
      const res = await extensionRequest('/explain-past-changes', 'POST', { episodeId: args.episodeId });
      if (res.error) {
        sendToolError(id, res.error);
      } else {
        const text = [
          `### AI Explanation of Past Episode Diffs`,
          `**Summary:**`,
          res.summary || 'No changes to explain.',
          `\n**Risks Identified:**`,
          (res.risks && res.risks.length > 0) ? res.risks.map(r => `- ${r}`).join('\n') : '- None',
          `\n**Suggested Checks:**`,
          (res.checks && res.checks.length > 0) ? res.checks.map(c => `- ${c}`).join('\n') : '- None'
        ].join('\n');
        sendToolResult(id, text);
      }
      break;
    }

    default:
      sendErrorResponse(id, -32601, `Tool not found: ${name}`);
  }
}

/**
 * Fallback tool list for backward compatibility with older extension versions.
 */
function getFallbackToolList() {
  return [
    {
      name: 'get_status',
      description: 'Get ContextLens VS Code extension active status, active project, and active episode',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'start_episode',
      description: 'Start a new tracking episode in the active VS Code workspace',
      inputSchema: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'Label/description for this episode (e.g. Fixing billing bug)' }
        }
      }
    },
    {
      name: 'close_episode',
      description: 'Close the currently active episode in VS Code',
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'log_ai_call',
      description: 'Log an AI tool call, prompt, and response to ContextLens for tracing',
      inputSchema: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'The prompt/instructions sent to the AI' },
          response: { type: 'string', description: 'The response/code generated by the AI' },
          modelName: { type: 'string', description: 'Name of the model used (optional)' },
          intent: { type: 'string', description: 'Intent tag/category (optional)' }
        },
        required: ['prompt', 'response']
      }
    },
    {
      name: 'explain_diff',
      description: "Request an AI explanation and code audit of the current episode's diff",
      inputSchema: { type: 'object', properties: {} }
    },
    {
      name: 'search_context',
      description: 'Search for past episodes and AI calls by topic or content',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search term or query' }
        },
        required: ['query']
      }
    },
    {
      name: 'get_episode_details',
      description: 'Get detailed information about a specific episode and its AI calls',
      inputSchema: {
        type: 'object',
        properties: {
          episodeId: { type: 'string', description: 'The UUID of the episode' }
        },
        required: ['episodeId']
      }
    },
    {
      name: 'get_recent_episodes',
      description: 'Get recently accessed or modified episodes',
      inputSchema: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum number of episodes to return (optional, default 5)' }
        }
      }
    },
    {
      name: 'explain_past_changes',
      description: 'Request an AI explanation and audit of changes in a specific past episode',
      inputSchema: {
        type: 'object',
        properties: {
          episodeId: { type: 'string', description: 'The UUID of the episode' }
        },
        required: ['episodeId']
      }
    }
  ];
}

function extensionRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: EXTENSION_HOST,
      port: EXTENSION_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-MCP-Secret': MCP_SECRET,
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (payload) req.write(payload);
    req.end();
  });
}

function sendResultResponse(id, result) {
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    id,
    result
  });
  process.stdout.write(msg + '\n');
}

function sendErrorResponse(id, code, message) {
  const msg = JSON.stringify({
    jsonrpc: '2.0',
    id,
    error: { code, message }
  });
  process.stdout.write(msg + '\n');
}

function sendToolResult(id, text) {
  sendResultResponse(id, {
    content: [
      {
        type: 'text',
        text
      }
    ]
  });
}

function sendToolError(id, message) {
  sendResultResponse(id, {
    content: [
      {
        type: 'text',
        text: `Error: ${message}`
      }
    ],
    isError: true
  });
}
