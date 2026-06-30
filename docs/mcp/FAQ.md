# ContextLens MCP FAQ

### What is Model Context Protocol (MCP)?
MCP is an open standard developed by Anthropic that allows AI models to connect securely to local data sources and tools. ContextLens uses MCP to expose VS Code workspace context to your AI clients.

### Does ContextLens send my code to external servers?
No. The ContextLens MCP server binds only to the local loopback address (`127.0.0.1`). All communication between your AI client and VS Code happens locally on your machine. Diffs are analyzed locally or sent to your configured Vertex AI / Gemini API project.

### How often do the authentication tokens rotate?
Tokens rotate every 30 minutes. If a token rotates while a request is in-flight, the bridge automatically fetches the new token from the local secret file and retries the request transparently without showing errors to the user.

### Can I write custom tools for ContextLens?
Yes! You can build custom plugins using the `@contextlens/sdk`. Plugins register new tools, prompts, or resources which are dynamically served to your AI client through the `PluginManager`.

### Which AI clients are supported?
ContextLens is fully tested with:
- Claude Desktop
- Cursor
- Antigravity IDE
- VS Code Agent Mode
- Gemini CLI
- OpenAI Agents SDK (via stdio bridge)

### How can I verify that my installation works?
Open your terminal and run:
```bash
contextlens mcp doctor
```
This runs self-tests and outputs a health report for your setup.

### How do I report a security vulnerability?
Please do not open a public issue. See [SECURITY.md](../../SECURITY.md) for instructions on submitting a report privately.
