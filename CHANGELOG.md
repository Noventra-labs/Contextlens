# Changelog

All notable changes to ContextLens MCP will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Phase 1 — Foundation
- `ToolRegistry` singleton for dynamic tool registration and dispatch
- `McpPermission` enum (READ, WRITE, ADMIN, AI, SEARCH) with validation
- `McpFeatureFlag` system with runtime overrides
- 9 modular tool definitions extracted from monolithic server
- Registry-powered endpoints `/mcp/tools/list` and `/mcp/tools/call`
- `mcp-bridge.js` v2.0 with registry-first routing and legacy fallback

#### Phase 2 — Security
- `TokenManager` with 30-minute rotation and 1-minute grace period
- `ClientIdentityTracker` for AI client connection tracking
- `RateLimiter` with token bucket algorithm and per-tool limits
- Input validator with JSON Schema type/required checking
- `McpErrorCode` enum for standardized error responses
- Bridge auto-refreshes token on 401 (transparent rotation)

#### Phase 3 — Full MCP Features
- 5 MCP Resources: workspace://current, git-diff, episodes, diagnostics, symbols
- 5 Prompt templates: explain_diff, review_code, generate_tests, security_audit, summarize_episode
- `NotificationManager` for push events (episode/git/workspace changes)
- `SessionManager` tracking session state and tool call history
- Bridge supports resources/list, resources/read, prompts/list, prompts/get

#### Phase 4 — Developer Experience
- Health check system (Node version, server, bridge, secret, extension)
- MCP error catalog with unique codes (CL-MCP-001 through CL-MCP-010)
- `/mcp/health` and `/mcp/errors` endpoints

#### Phase 5 — Platform Architecture
- `PluginManager` for third-party tool/prompt/resource registration
- `ProviderManager` supporting Gemini, GPT, Claude, Ollama, DeepSeek, OpenRouter
- `JobQueue` for background processing with concurrency control
- `WorkspaceManager` for multi-workspace isolation

#### Phase 6 — Production Readiness
- `McpLogger` with structured JSON logging and queryable history
- `MetricsCollector` tracking calls/day, latency (avg/p95/max), failure rate
- `VersionManager` for tool versioning and deprecation
- Unit tests for registry, permissions, security modules
- Architecture, Getting Started, and Security documentation

#### Phase 7 — Community & Release
- CONTRIBUTING.md with development setup and PR guidelines
- CODE_OF_CONDUCT.md (Contributor Covenant v2.1)
- SECURITY.md with vulnerability reporting process
- CHANGELOG.md
- CI/CD workflow for automated build and test
- MCP example configurations for Claude Desktop, Cursor, and more
