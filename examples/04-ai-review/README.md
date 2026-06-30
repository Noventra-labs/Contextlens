# Example: AI Code Review

Use ContextLens MCP prompts for AI-powered code review.

## Review Current Changes

Ask your AI client:
```
Review my current code changes. Use explain_diff to analyze 
what I've changed and identify any issues.
```

### explain_diff Tool

```json
{
  "name": "explain_diff",
  "arguments": {}
}
```

Returns:
- Summary of changes
- Risk assessment
- Suggested follow-ups

## Use the Review Prompt

The `review_code` prompt template provides structured feedback:

```json
{
  "method": "prompts/get",
  "params": {
    "name": "review_code",
    "arguments": {
      "code": "function authenticate(token) { ... }",
      "language": "typescript",
      "focus": "security"
    }
  }
}
```

## Security Audit

```json
{
  "method": "prompts/get",
  "params": {
    "name": "security_audit",
    "arguments": {
      "code": "app.post('/login', (req, res) => { ... })",
      "type": "api"
    }
  }
}
```

## Generate Tests

```json
{
  "method": "prompts/get",
  "params": {
    "name": "generate_tests",
    "arguments": {
      "code": "class AuthService { ... }",
      "framework": "jest",
      "language": "typescript"
    }
  }
}
```

## Review Past Episode Changes

```json
{
  "name": "explain_past_changes",
  "arguments": {
    "episodeId": "ep-abc123"
  }
}
```

Returns AI-generated:
- Change summary
- Identified risks
- Suggested checks
