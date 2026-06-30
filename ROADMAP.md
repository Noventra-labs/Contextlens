# ContextLens Roadmap

## Current: v1.0 — Foundation Release

### ✅ Completed
- Episode-based context tracking
- MCP server with 9 tools, 5 resources, 5 prompts
- Security layer (token rotation, rate limiting, input validation)
- Plugin system for extensibility
- Multi-provider AI support (Gemini, GPT, Claude, Ollama, DeepSeek)
- Background job queue for expensive operations
- Structured logging and metrics
- Health check system
- Auto-setup for Claude Desktop and Cursor
- CI/CD pipeline

### 🔜 In Progress
- Documentation website
- npm package publishing
- VS Code Marketplace optimization

---

## v1.1 — Enhanced Intelligence

- [ ] Repository-wide code indexing and embeddings
- [ ] Semantic search across all episodes and code
- [ ] Auto-episode detection (start/stop based on git activity)
- [ ] Workspace-level AI summaries
- [ ] Enhanced diff explanations with file-level context

## v1.2 — Collaboration

- [ ] Team episode sharing
- [ ] Multi-user project dashboards
- [ ] Code review integration
- [ ] PR description auto-generation from episode context
- [ ] Slack/Discord notifications

## v2.0 — Platform

- [ ] Plugin marketplace for community tools
- [ ] Custom resource providers
- [ ] Webhook integrations
- [ ] REST API for external services
- [ ] Self-hosted deployment option

## v2.1 — Advanced AI

- [ ] Multi-model comparison (run same prompt across providers)
- [ ] Context-aware code completion via MCP
- [ ] Automated code review pipelines
- [ ] AI-powered project onboarding
- [ ] Knowledge graph of codebase relationships

---

## How We Prioritize

1. **User feedback** — Issues and feature requests drive priorities
2. **Security** — Security fixes ship immediately
3. **Stability** — Bug fixes before new features
4. **Community** — Features that help the most users come first

## Feature Requests

Have an idea? [Open a feature request](https://github.com/Noventra-labs/Contextlens/issues/new?template=feature_request.yml)
