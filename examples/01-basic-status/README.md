# Example: Basic Status Query

A simple example showing how to connect to ContextLens MCP and query the extension status.

## Prerequisites

- ContextLens VS Code extension installed and running
- MCP bridge configured in your AI client

## Usage

### With Claude Desktop

Simply ask:
```
What's the current status of my ContextLens setup?
Use the get_status tool.
```

### Expected Output

```json
{
  "content": [
    {
      "type": "text",
      "text": "ContextLens Status:\n- Signed in: Yes\n- Project: my-project (abc123)\n- Active Episode: Feature Login (ep-456)\n- Episode active for: 23 minutes\n- Auto-sync: enabled\n- Total synced episodes: 12"
    }
  ]
}
```

### Programmatic (Node.js)

```javascript
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

async function main() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['/path/to/mcp-bridge.js'],
  });

  const client = new Client({ name: 'example-client', version: '1.0.0' }, {});
  await client.connect(transport);

  // List available tools
  const tools = await client.listTools();
  console.log('Available tools:', tools.tools.map(t => t.name));

  // Call get_status
  const result = await client.callTool({ name: 'get_status', arguments: {} });
  console.log('Status:', result.content[0].text);

  await client.close();
}

main().catch(console.error);
```
