# ContextLens MCP — Example Configurations

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%/Claude/claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "contextlens": {
      "command": "node",
      "args": ["/path/to/vscode-extension/mcp-bridge.js"]
    }
  }
}
```

## Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "contextlens": {
      "command": "node",
      "args": ["/path/to/vscode-extension/mcp-bridge.js"]
    }
  }
}
```

## Antigravity IDE

Add to `~/.gemini/config/mcp.json`:

```json
{
  "contextlens": {
    "command": "node",
    "args": ["/path/to/vscode-extension/mcp-bridge.js"]
  }
}
```

## VS Code Agent Mode

The extension auto-registers when installed. No manual configuration needed.

## Gemini CLI

```bash
# Set environment variable
export CONTEXTLENS_MCP_BRIDGE="/path/to/vscode-extension/mcp-bridge.js"

# Configure in Gemini CLI settings
gemini config set mcp.contextlens.command "node"
gemini config set mcp.contextlens.args "$CONTEXTLENS_MCP_BRIDGE"
```

## OpenAI Agents SDK (Python)

```python
from agents import Agent
from agents.mcp import MCPServerStdio

mcp = MCPServerStdio(
    name="contextlens",
    command="node",
    args=["/path/to/vscode-extension/mcp-bridge.js"]
)

agent = Agent(
    name="coding-assistant",
    mcp_servers=[mcp]
)
```

## Notes

- The path to `mcp-bridge.js` depends on your VS Code extension installation path
- Use the **ContextLens: Copy MCP Configuration** command to get the correct path
- Use **ContextLens: Auto-Setup MCP in AI Clients** for automatic configuration
