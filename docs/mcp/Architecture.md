# ContextLens MCP Architecture

## Overview

ContextLens MCP is a two-tier architecture that exposes VS Code extension capabilities to any AI client via the Model Context Protocol.

```
┌─────────────────────┐         ┌─────────────────────────────────┐
│   AI Client         │         │   VS Code Extension             │
│   (Claude, Cursor)  │         │                                 │
└────────┬────────────┘         │  ┌───────────────────────────┐  │
         │ stdio JSON-RPC       │  │  ToolRegistry             │  │
         ▼                      │  │  ├── status.ts            │  │
┌────────┴────────────┐         │  │  ├── episode.ts           │  │
│   mcp-bridge.js     │◄───────►│  │  ├── ai.ts               │  │
│   (MCP Server)      │  HTTP   │  │  ├── git.ts              │  │
└─────────────────────┘  :3012  │  │  └── search.ts           │  │
                                │  ├───────────────────────────┤  │
                                │  │  Resources                │  │
                                │  │  ├── workspace://current  │  │
                                │  │  ├── workspace://git-diff │  │
                                │  │  └── workspace://episodes │  │
                                │  ├───────────────────────────┤  │
                                │  │  Security Layer           │  │
                                │  │  ├── TokenManager         │  │
                                │  │  ├── RateLimiter          │  │
                                │  │  └── Validator            │  │
                                │  └───────────────────────────┘  │
                                └─────────────────────────────────┘
```

## Directory Structure

```
src/mcp/
├── auth/
│   ├── tokenManager.ts      # Rotating token authentication
│   └── clientIdentity.ts    # Client tracking
├── errors/
│   └── mcpErrors.ts         # Error catalog (CL-MCP-XXX)
├── health/
│   └── healthCheck.ts       # Pipeline health verification
├── jobs/
│   └── jobQueue.ts          # Background job processing
├── notifications/
│   └── notificationManager.ts  # Push event system
├── observability/
│   ├── logger.ts            # Structured logging
│   └── metrics.ts           # Usage metrics
├── permissions.ts           # Permission enum + validation
├── featureFlags.ts          # Feature flag system
├── plugins/
│   └── pluginManager.ts     # Plugin registration
├── prompts/
│   └── index.ts             # Prompt template library
├── providers/
│   └── providerManager.ts   # AI provider abstraction
├── registry/
│   └── ToolRegistry.ts      # Central tool registry
├── resources/
│   ├── index.ts             # Resource registry
│   ├── workspace.ts         # workspace://current
│   ├── gitDiff.ts           # workspace://git-diff
│   ├── episodes.ts          # workspace://episodes
│   ├── diagnostics.ts       # workspace://diagnostics
│   └── symbols.ts           # workspace://symbols
├── security/
│   ├── rateLimiter.ts       # Token bucket rate limiting
│   └── validator.ts         # Input/output validation
├── session/
│   └── sessionManager.ts    # Session state tracking
├── tools/
│   ├── index.ts             # Barrel import (auto-registers all)
│   ├── status.ts            # get_status
│   ├── episode.ts           # start/close/get/list episodes
│   ├── ai.ts                # log_ai_call
│   ├── git.ts               # explain_diff, explain_past_changes
│   └── search.ts            # search_context
├── versioning/
│   └── versionManager.ts    # Tool versioning
└── workspace/
    └── workspaceManager.ts  # Multi-workspace support
```

## Security Model

1. **Token Rotation**: 30-minute rotating tokens with 1-minute grace period
2. **Client Identity**: Track connecting clients by type and version
3. **Rate Limiting**: Token bucket with separate limits for expensive ops
4. **Input Validation**: JSON Schema validation on tool inputs
5. **Local Binding**: Server listens only on 127.0.0.1

## MCP Protocol Support

| Method | Supported |
|--------|-----------|
| initialize | ✅ |
| tools/list | ✅ |
| tools/call | ✅ |
| resources/list | ✅ |
| resources/read | ✅ |
| prompts/list | ✅ |
| prompts/get | ✅ |
| ping | ✅ |
