# ContextLens MCP Security Guide

## Authentication

### Token Rotation
- Tokens rotate every 30 minutes by default
- Previous token remains valid for 60 seconds (grace period)
- Bridge auto-refreshes: re-reads `.mcp-secret.json` on 401 and retries

### Secret Storage
- Secret stored in `.mcp-secret.json` next to the extension
- File deleted on extension deactivation
- Never committed to version control (in `.gitignore`)

## Rate Limiting

### Standard Limits
- 120 requests per minute
- 20 request burst allowance

### Expensive Operations
- 10 requests per minute for: `explain_diff`, `explain_past_changes`, `search_context`
- 3 request burst allowance

### Headers
- `X-RateLimit-Remaining`: Remaining requests in window
- `X-RateLimit-Limit`: Total limit
- `Retry-After`: Seconds to wait (on 429)

## Input Validation
- All tool inputs validated against JSON Schema
- Required field checks
- Type checking (string, number, boolean, array, object)

## Network Security
- Server binds to `127.0.0.1` only (no network exposure)
- CORS headers included for browser safety
- No authentication tokens exposed in responses

## Error Codes

| Code | Description |
|------|-------------|
| CL-MCP-001 | Authentication failed |
| CL-MCP-002 | Rate limit exceeded |
| CL-MCP-003 | Permission denied |
| CL-MCP-004 | Tool not found |
| CL-MCP-005 | Invalid input |
| CL-MCP-006 | Extension not running |
| CL-MCP-007 | No active project |
| CL-MCP-008 | No active episode |
| CL-MCP-009 | Backend API error |
| CL-MCP-010 | Feature not available |

## Reporting Vulnerabilities

Email: Shasarita23@gmail.com
