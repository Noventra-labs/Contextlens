# Contributing to ContextLens

Thank you for your interest in contributing to ContextLens! 🎉

## Development Setup

```bash
# Clone the repository
git clone https://github.com/Noventra-labs/Contextlens.git
cd Contextlens

# Install dependencies
cd vscode-extension
npm install

# Build
npx webpack --mode none

# Run tests
npm test
```

## Project Structure

```
├── docs/                    # Documentation
│   └── mcp/                 # MCP-specific docs
├── vscode-extension/        # Main VS Code extension
│   ├── src/                 # TypeScript source
│   │   ├── mcp/             # MCP implementation
│   │   ├── extension.ts     # Extension entry point
│   │   └── mcpServer.ts     # HTTP server for MCP
│   ├── mcp-bridge.js        # stdio JSON-RPC bridge
│   └── test/                # Test files
└── README.md
```

## How to Contribute

### Reporting Bugs

1. Check existing issues first
2. Use the bug report template
3. Include: VS Code version, OS, steps to reproduce, expected vs actual behavior

### Feature Requests

1. Check the [MCP Roadmap](docs/ContextLens_Public_MCP_Roadmap.md)
2. Open an issue with the `enhancement` label
3. Describe the use case and proposed solution

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Make your changes
4. Ensure webpack compiles: `npx webpack --mode none`
5. Write tests for new functionality
6. Commit with conventional commits: `feat(mcp): add new tool`
7. Push and open a PR

### Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(scope): description` — New features
- `fix(scope): description` — Bug fixes
- `docs(scope): description` — Documentation
- `refactor(scope): description` — Code changes that neither fix bugs nor add features
- `test(scope): description` — Test additions/changes

### Code Style

- TypeScript strict mode
- No `any` types unless absolutely necessary
- All new tools must implement `McpToolDefinition`
- All new resources must implement `McpResource`
- Write JSDoc comments for public APIs

### Adding a New MCP Tool

1. Create `src/mcp/tools/your-tool.ts`
2. Implement `McpToolDefinition` interface
3. Register with `ToolRegistry.getInstance().register()`
4. Import in `src/mcp/tools/index.ts`
5. Add tests in `test/mcp/`

### Adding a New Resource

1. Create `src/mcp/resources/your-resource.ts`
2. Implement `McpResource` interface
3. Register in `src/mcp/resources/index.ts`

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT License.
