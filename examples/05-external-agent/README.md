# Example: External Agent Automation

Use ContextLens MCP from an external Python agent using the OpenAI Agents SDK.

## Setup

```bash
pip install openai-agents
```

## Python Agent

```python
"""
ContextLens automation agent.
Connects to ContextLens MCP bridge and automates episode management.
"""

from agents import Agent, Runner
from agents.mcp import MCPServerStdio

# Configure MCP connection
contextlens = MCPServerStdio(
    name="contextlens",
    command="node",
    args=["/path/to/vscode-extension/mcp-bridge.js"]
)

# Create an agent with ContextLens tools
agent = Agent(
    name="dev-assistant",
    instructions="""You are a development assistant with access to ContextLens.
    Use ContextLens tools to:
    1. Track coding episodes
    2. Analyze code changes
    3. Search past work for context
    4. Generate code reviews
    Always start by checking the current status.""",
    mcp_servers=[contextlens]
)

async def main():
    async with contextlens:
        # Run the agent
        result = await Runner.run(
            agent,
            input="Check the current ContextLens status and list recent episodes"
        )
        print(result.final_output)

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
```

## Automated Daily Summary

```python
"""Generate a daily coding summary from ContextLens episodes."""

agent = Agent(
    name="daily-summarizer",
    instructions="""Retrieve recent episodes and generate a daily summary.
    Include: what was worked on, key decisions, and follow-up tasks.""",
    mcp_servers=[contextlens]
)

async def daily_summary():
    async with contextlens:
        result = await Runner.run(
            agent,
            input="Get my recent episodes and create a daily development summary"
        )
        
        # Save to file or send to Slack
        with open("daily-summary.md", "w") as f:
            f.write(result.final_output)

asyncio.run(daily_summary())
```

## CI Integration

```python
"""Use ContextLens in CI to auto-review PRs."""

agent = Agent(
    name="pr-reviewer",
    instructions="""Review the current code changes using explain_diff.
    Focus on security issues and potential bugs.
    Output a structured review.""",
    mcp_servers=[contextlens]
)
```
