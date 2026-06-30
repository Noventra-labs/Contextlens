# ContextLens Public MCP Roadmap

## Vision

Build a production-quality Model Context Protocol (MCP) platform that is
secure, extensible, and publicly available for any AI client (Claude
Desktop, Cursor, VS Code Agent, Antigravity IDE, Gemini CLI, OpenAI
Agents, etc.).

------------------------------------------------------------------------

# Phase 1 -- Stabilize the Foundation (Critical)

## 1. Tool Registry

**Goal:** Replace hardcoded tools with a dynamic registry.

### Tasks

-   [ ] Create `ToolRegistry`
-   [ ] Implement `registerTool()`
-   [ ] Move each MCP tool into its own module
-   [ ] Auto-register tools on startup
-   [ ] Generate `tools/list` automatically

### Suggested Structure

``` text
src/mcp/
├── registry/
│   └── ToolRegistry.ts
├── tools/
│   ├── status.ts
│   ├── search.ts
│   ├── episode.ts
│   ├── git.ts
│   ├── ai.ts
│   └── memory.ts
```

------------------------------------------------------------------------

## 2. Permission System

### Tasks

-   [ ] Create permission enum
-   [ ] Assign permissions to every tool
-   [ ] Validate permissions before execution
-   [ ] Return proper MCP errors

Permissions:

-   READ
-   WRITE
-   ADMIN
-   AI
-   SEARCH

------------------------------------------------------------------------

## 3. Feature Flags

### Tasks

-   [ ] MCP_ENABLED
-   [ ] MCP_BETA
-   [ ] MCP_INTERNAL
-   [ ] MCP_EXPERIMENTAL
-   [ ] Hide unfinished tools

------------------------------------------------------------------------

## 4. Standard Tool Schema

Every tool should expose:

-   Name
-   Description
-   Version
-   Category
-   Input Schema
-   Output Schema
-   Permissions

------------------------------------------------------------------------

# Phase 2 -- Security (Critical)

## 5. Authentication

### Tasks

-   [ ] Replace permanent secret file with rotating tokens
-   [ ] Support token regeneration
-   [ ] Token expiration

------------------------------------------------------------------------

## 6. Client Identity

Track:

-   Claude Desktop
-   Cursor
-   Antigravity
-   VS Code Agent
-   Gemini CLI

Store:

-   Client ID
-   Version
-   Last connection

------------------------------------------------------------------------

## 7. Rate Limiting

-   [ ] Request limits
-   [ ] Burst protection
-   [ ] Queue expensive requests

------------------------------------------------------------------------

## 8. Input Validation

-   [ ] Validate every request
-   [ ] Validate every response
-   [ ] Standardize errors

------------------------------------------------------------------------

# Phase 3 -- Full MCP Features

## 9. Resources

Implement resources such as:

-   workspace://current
-   workspace://git-diff
-   workspace://episodes
-   workspace://diagnostics
-   workspace://symbols

------------------------------------------------------------------------

## 10. Prompt Library

Create reusable prompts:

-   Explain Diff
-   Review Code
-   Generate Tests
-   Security Audit
-   Summarize Episode

------------------------------------------------------------------------

## 11. Notifications

Push events:

-   Episode Started
-   Episode Closed
-   Git Changed
-   Workspace Changed
-   Index Complete

------------------------------------------------------------------------

## 12. Session Manager

Track:

-   Workspace
-   Project
-   Active Episode
-   Tool History
-   Connected Client

------------------------------------------------------------------------

# Phase 4 -- Developer Experience

## 13. One-Click Installation

-   [ ] Auto-detect supported clients
-   [ ] Configure automatically
-   [ ] Validate installation

------------------------------------------------------------------------

## 14. CLI

Commands:

-   contextlens mcp install
-   contextlens mcp uninstall
-   contextlens mcp doctor
-   contextlens mcp logs
-   contextlens mcp status

------------------------------------------------------------------------

## 15. Health Check

Verify:

-   Server
-   Port
-   Client Config
-   Extension
-   Bridge
-   Node Version

------------------------------------------------------------------------

## 16. Error Handling

Provide actionable error messages with unique error codes.

------------------------------------------------------------------------

# Phase 5 -- Platform Architecture

## 17. Plugin System

Support:

-   registerTool()
-   registerPrompt()
-   registerResource()
-   registerEvent()

Future plugins:

-   GitHub
-   GitLab
-   Docker
-   Jira
-   Slack
-   Kubernetes

------------------------------------------------------------------------

## 18. AI Provider Abstraction

Support:

-   Gemini
-   GPT
-   Claude
-   OpenRouter
-   Ollama
-   DeepSeek

------------------------------------------------------------------------

## 19. Background Jobs

Queue:

-   Repository Indexing
-   Embeddings
-   Explain Diff
-   AI Summaries

------------------------------------------------------------------------

## 20. Multi-Workspace Support

Each workspace maintains:

-   Git State
-   Episodes
-   Search Index
-   Memory

------------------------------------------------------------------------

# Phase 6 -- Production Readiness

## 21. Logging

Capture:

-   Tool
-   Client
-   Duration
-   Errors
-   Timestamp

------------------------------------------------------------------------

## 22. Metrics

Track:

-   Active Clients
-   Calls/Day
-   Tool Usage
-   Latency
-   Failure Rate

------------------------------------------------------------------------

## 23. Versioning

Version every tool:

-   search@1
-   search@2

Never introduce breaking changes.

------------------------------------------------------------------------

## 24. Testing

-   [ ] Unit Tests
-   [ ] Integration Tests
-   [ ] Bridge Tests
-   [ ] Security Tests
-   [ ] Load Tests

------------------------------------------------------------------------

## 25. Documentation

Create:

-   Architecture.md
-   GettingStarted.md
-   API.md
-   ToolReference.md
-   Resources.md
-   Prompts.md
-   Security.md
-   Troubleshooting.md
-   Migration.md

------------------------------------------------------------------------

# Phase 7 -- Public Release

## GitHub

-   [ ] CONTRIBUTING.md
-   [ ] CODE_OF_CONDUCT.md
-   [ ] SECURITY.md
-   [ ] LICENSE
-   [ ] CHANGELOG.md

------------------------------------------------------------------------

## Website

Include:

-   Installation
-   Documentation
-   Supported Clients
-   Examples
-   Roadmap

------------------------------------------------------------------------

## Example Projects

Provide examples for:

-   Claude Desktop
-   Cursor
-   Antigravity IDE
-   VS Code Agent
-   Gemini CLI
-   OpenAI Agents SDK

------------------------------------------------------------------------

## Distribution

Publish:

-   VS Code Marketplace
-   npm
-   GitHub Releases
-   Homebrew (optional)
-   Winget (optional)

------------------------------------------------------------------------

## CI/CD

Automate:

-   Build
-   Tests
-   Security Scan
-   Marketplace Release
-   npm Publish

------------------------------------------------------------------------

# Final Milestone Checklist

  Phase   Deliverables                                           Priority
  ------- ------------------------------------------------------ ----------
  1       Tool Registry, Permissions, Feature Flags, Schemas     Critical
  2       Authentication, Rate Limiting, Validation              Critical
  3       Resources, Prompts, Notifications, Sessions            High
  4       Installer, CLI, Health Checks, Errors                  High
  5       Plugins, AI Providers, Background Jobs                 Medium
  6       Logging, Metrics, Versioning, Testing, Documentation   High
  7       Packaging, CI/CD, Website, Community Release           High
