# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | ✅ Active support  |
| < 1.0   | ❌ No support      |

## Reporting a Vulnerability

**Do NOT report security vulnerabilities through public GitHub issues.**

Instead, please email: **shasarita23@gmail.com**

Please include:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: Within 48 hours
- **Assessment**: Within 7 days
- **Fix**: Based on severity
  - Critical: 24-48 hours
  - High: 1 week
  - Medium: 2 weeks
  - Low: Next release

## Security Measures

ContextLens MCP implements:

- **Token Rotation**: 30-minute rotating authentication tokens
- **Local Binding**: Server listens only on 127.0.0.1
- **Rate Limiting**: Per-client request throttling
- **Input Validation**: JSON Schema validation on all inputs
- **No Secret Exposure**: API keys and tokens never included in responses
- **Grace Period Auth**: Smooth token transitions without request failures

## Scope

This security policy covers:
- ContextLens VS Code Extension
- MCP Bridge (mcp-bridge.js)
- MCP Server (mcpServer.ts)
- All MCP tools, resources, and prompts

Out of scope:
- Third-party AI client configurations
- User's own AI provider API keys
