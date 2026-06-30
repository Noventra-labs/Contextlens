# ContextLens Phase 7 --- Public Release Master Plan

> **Objective:** Launch ContextLens as a professional, trusted, and
> maintainable public MCP platform that developers can discover,
> install, contribute to, and build upon.

------------------------------------------------------------------------

# Success Criteria

A successful Phase 7 release means:

-   VS Code extension is installable from the Marketplace.
-   MCP bridge/CLI is installable from npm.
-   Documentation covers installation, architecture, APIs, and
    troubleshooting.
-   Automated CI/CD produces reproducible releases.
-   Community members can contribute without needing private knowledge.
-   Every release is versioned, tested, and documented.

------------------------------------------------------------------------

# Workstream A --- GitHub Repository

## Goals

Create a repository that looks and behaves like a mature open-source
project.

## Repository Structure

``` text
/
├── docs/
├── examples/
├── packages/
├── vscode-extension/
├── scripts/
├── .github/
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── SECURITY.md
├── LICENSE
├── ROADMAP.md
└── README.md
```

## Deliverables

-   [ ] Professional README
-   [ ] Installation guide
-   [ ] Architecture diagram
-   [ ] Feature overview
-   [ ] Screenshots
-   [ ] Demo GIF
-   [ ] Project roadmap
-   [ ] FAQ

### README should include

-   Project overview
-   Why ContextLens exists
-   Supported MCP clients
-   Features
-   Installation
-   Quick Start
-   Architecture
-   Example workflows
-   Documentation links
-   Community links
-   License

------------------------------------------------------------------------

# Workstream B --- Documentation Website

## Suggested Stack

-   Docusaurus
-   Mintlify
-   VitePress

## Information Architecture

``` text
Introduction
Getting Started
Installation
Architecture
Concepts
API
Resources
Prompts
CLI
Security
Examples
Troubleshooting
FAQ
Contributing
```

## Required Pages

### Getting Started

Explain:

-   What MCP is
-   What ContextLens provides
-   Installation
-   First tool call
-   First episode

------------------------------------------------------------------------

### Architecture

Include diagrams for

-   Extension
-   Bridge
-   Registry
-   Events
-   Resources
-   Sessions
-   Plugin System

------------------------------------------------------------------------

### API Reference

Document every

-   Tool
-   Resource
-   Prompt
-   Notification
-   Error Code

------------------------------------------------------------------------

### Tutorials

Create step-by-step guides

-   Connect Claude Desktop
-   Connect Cursor
-   Connect Antigravity IDE
-   Connect Gemini CLI
-   Connect OpenAI Agents

------------------------------------------------------------------------

# Workstream C --- npm Publishing

## Package Layout

``` text
@contextlens/mcp
@contextlens/cli
@contextlens/sdk
```

## Tasks

-   [ ] Configure package metadata
-   [ ] Add README
-   [ ] Publish automation
-   [ ] Semantic versioning
-   [ ] Release notes

------------------------------------------------------------------------

# Workstream D --- VS Code Marketplace

## Before Publishing

-   [ ] Extension icon
-   [ ] Banner
-   [ ] Screenshots
-   [ ] Demo video
-   [ ] Keywords
-   [ ] Categories
-   [ ] Verified publisher profile

## Marketplace Description

Include

-   Features
-   Architecture
-   Supported clients
-   Installation
-   Links to documentation

------------------------------------------------------------------------

# Workstream E --- CI/CD

## Recommended Platform

GitHub Actions

## Pipelines

### Pull Request

-   Install dependencies
-   Lint
-   Type check
-   Unit tests
-   Integration tests
-   Build

### Main Branch

-   Version validation
-   Build artifacts
-   Package extension
-   Package npm modules

### Release

-   Publish npm packages
-   Publish VS Code extension
-   Create GitHub Release
-   Upload artifacts
-   Publish release notes

------------------------------------------------------------------------

# Workstream F --- Quality Assurance

## Test Matrix

### Platforms

-   Windows
-   Linux
-   macOS

### Node Versions

-   LTS
-   Current

### VS Code

-   Stable
-   Insiders

### MCP Clients

-   Claude Desktop
-   Cursor
-   Antigravity IDE
-   Gemini CLI
-   OpenAI Agents

## Validation Checklist

-   Install succeeds
-   Auto setup works
-   Bridge launches
-   Authentication works
-   All tools respond
-   Error handling verified
-   Upgrade path verified

------------------------------------------------------------------------

# Workstream G --- Example Projects

Create complete sample repositories.

## Examples

### Beginner

Simple status query.

### Search

Semantic search workflow.

### Episode Tracking

Start → Code → Close.

### AI Review

Explain diff and review changes.

### Automation

Use ContextLens from an external agent.

Each example should include:

-   README
-   Architecture
-   Source code
-   Expected output

------------------------------------------------------------------------

# Workstream H --- Community

## GitHub Configuration

Create:

-   ISSUE_TEMPLATE (Bug)
-   ISSUE_TEMPLATE (Feature)
-   ISSUE_TEMPLATE (Question)
-   Pull Request Template
-   Discussions enabled

## Contribution Guide

Document:

-   Development setup
-   Branch naming
-   Commit conventions
-   Testing requirements
-   Review process
-   Coding standards

------------------------------------------------------------------------

# Workstream I --- Versioning

## Semantic Versioning

Follow:

``` text
MAJOR.MINOR.PATCH
```

### MAJOR

Breaking changes.

### MINOR

New features.

### PATCH

Bug fixes.

## Release Process

1.  Update CHANGELOG.
2.  Bump version.
3.  Run CI.
4.  Create Git tag.
5.  Publish packages.
6.  Publish Marketplace extension.
7.  Publish release notes.

------------------------------------------------------------------------

# Workstream J --- Security

## SECURITY.md

Include:

-   Supported versions
-   Vulnerability reporting
-   Disclosure policy
-   Response timelines

## Security Review

Checklist

-   Authentication
-   Permissions
-   Rate limiting
-   Input validation
-   Dependency audit
-   Secret handling

------------------------------------------------------------------------

# Multi-Agent Execution Plan

Treat each workstream as an independent agent with clear ownership.

  ---------------------------------------------------------------------------
  Agent           Responsibility               Inputs         Outputs
  --------------- ---------------------------- -------------- ---------------
  Release Manager Coordinate milestones and    Roadmap        Release
                  releases                                    checklist

  Documentation   Documentation website and    Source code    Docs site
  Agent           README                                      

  DevOps Agent    CI/CD, publishing,           Repository     Automated
                  automation                                  pipelines

  Packaging Agent npm and Marketplace          Build          Published
                  packaging                    artifacts      packages

  QA Agent        Cross-platform testing       Release        Test reports
                                               candidate      

  Security Agent  Security review and audits   Codebase       Audit findings

  Community Agent Templates, discussions,      Repository     Community
                  contribution process                        assets

  Example Agent   Sample integrations and      Public APIs    Example
                  tutorials                                   repositories

  Design Agent    Branding, icons,             Product assets Marketplace
                  screenshots, diagrams                       visuals
  ---------------------------------------------------------------------------

Each agent should maintain its own checklist, deliverables, acceptance
criteria, and documentation while reporting progress to the Release
Manager.

------------------------------------------------------------------------

# Final Exit Criteria

The release is complete only when all of the following are true:

-   [ ] CI passes on all supported platforms.
-   [ ] npm packages are published.
-   [ ] VS Code Marketplace extension is live.
-   [ ] Documentation website is publicly available.
-   [ ] Example repositories are complete.
-   [ ] CHANGELOG is updated.
-   [ ] GitHub Release is published.
-   [ ] Community templates are enabled.
-   [ ] Security documentation is published.
-   [ ] Installation succeeds on all supported MCP clients.
