# Example: Episode Tracking Workflow

Track a complete coding session: start → code → close.

## Workflow

### 1. Start an Episode

Ask your AI client:
```
Start a new episode called "Add user authentication" using start_episode
```

Tool call:
```json
{
  "name": "start_episode",
  "arguments": {
    "title": "Add user authentication"
  }
}
```

### 2. Work on Your Code

Write code as normal. ContextLens automatically captures:
- File changes (git diffs)
- AI interactions logged via `log_ai_call`

### 3. Check Progress

```
What changes have I made so far? Use explain_diff to analyze my current changes.
```

### 4. Log Important AI Interactions

```json
{
  "name": "log_ai_call",
  "arguments": {
    "prompt": "How should I structure the auth middleware?",
    "response": "Use a middleware pattern with JWT verification...",
    "model": "claude-sonnet-4-20250514"
  }
}
```

### 5. Close the Episode

```
Close the current episode with close_episode
```

### 6. Review Later

```
Show me my recent episodes using get_recent_episodes
```

```
Explain what happened in episode ep-abc123 using explain_past_changes
```

## Expected Flow

```
start_episode("Add auth")
  → Code changes captured automatically
  → AI interactions logged
  → Diffs recorded
close_episode()
  → Episode saved with full context
  → Available for future search and review
```
