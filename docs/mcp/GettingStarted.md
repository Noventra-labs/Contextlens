# Getting Started with ContextLens MCP

## Prerequisites

- VS Code 1.80+
- Node.js 18+
- ContextLens extension installed

## Quick Setup

### 1. Install the Extension

Install from VS Code Marketplace:
```
ext install Noventra-Labs.contextlens
```

### 2. Auto-Setup for AI Clients

Run command palette → **ContextLens: Auto-Setup MCP in AI Clients**

This auto-configures:
- Claude Desktop
- Cursor

### 3. Manual Setup

Copy MCP config via: **ContextLens: Copy MCP Configuration**

Paste into your AI client's MCP settings:

```json
{
  "contextlens": {
    "command": "node",
    "args": ["/path/to/mcp-bridge.js"]
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_status` | Extension status, project, episode info |
| `start_episode` | Start tracking a coding task |
| `close_episode` | Stop tracking |
| `log_ai_call` | Log prompt/response to ContextLens |
| `explain_diff` | AI explanation of current changes |
| `search_context` | Search past episodes |
| `get_episode_details` | Get episode details + AI calls |
| `get_recent_episodes` | List recent episodes |
| `explain_past_changes` | AI audit of past episode |

## Available Resources

| URI | Description |
|-----|-------------|
| `workspace://current` | Workspace metadata |
| `workspace://git-diff` | Current uncommitted changes |
| `workspace://episodes` | Episode list |
| `workspace://diagnostics` | VS Code errors/warnings |
| `workspace://symbols` | Code symbols |

## Available Prompts

| Prompt | Description |
|--------|-------------|
| `explain_diff` | Explain code changes |
| `review_code` | Code review with feedback |
| `generate_tests` | Generate unit tests |
| `security_audit` | Security vulnerability scan |
| `summarize_episode` | Summarize a coding episode |

## Troubleshooting

Run **health check**: `GET http://127.0.0.1:3012/mcp/health`

Common issues:
- **401 Unauthorized**: Token expired. Restart VS Code.
- **ECONNREFUSED**: Extension not running. Open VS Code.
- **No active project**: Sign in to ContextLens first.
