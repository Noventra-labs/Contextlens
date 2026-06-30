# ContextLens MCP API Reference

This document lists all available tools, resources, and prompts provided by the ContextLens MCP server.

---

## 🛠️ Tools

### 1. `get_status`
Returns the status of the active VS Code session, current project, and active episode details.
* **Arguments**: None
* **Required Permissions**: `read`

### 2. `start_episode`
Starts a new coding episode to track developer intent and context.
* **Arguments**:
  * `title` (string, required): Title describing the work (e.g. "Fix auth bug").
* **Required Permissions**: `write`

### 3. `close_episode`
Closes the currently active episode.
* **Arguments**: None
* **Required Permissions**: `write`

### 4. `log_ai_call`
Logs a prompt and response from an AI interaction to the current episode context.
* **Arguments**:
  * `prompt` (string, required): The prompt sent to the AI.
  * `response` (string, required): The response received from the AI.
  * `model` (string, optional): The AI model name.
* **Required Permissions**: `ai`

### 5. `explain_diff`
Generates an AI summary, risk analysis, and checklist for the current uncommitted git changes.
* **Arguments**: None
* **Required Permissions**: `ai`

### 6. `search_context`
Searches past episodes and coding history semantically.
* **Arguments**:
  * `query` (string, required): Search query.
* **Required Permissions**: `search`

### 7. `get_episode_details`
Retrieves full details of a specific episode including recorded AI calls and changes.
* **Arguments**:
  * `episodeId` (string, required): The UUID of the episode.
* **Required Permissions**: `read`

### 8. `get_recent_episodes`
Lists recently created or updated episodes.
* **Arguments**:
  * `limit` (number, optional, default: 5): Maximum number of episodes.
* **Required Permissions**: `read`

### 9. `explain_past_changes`
Analyzes and audits the changes made in a specific past episode.
* **Arguments**:
  * `episodeId` (string, required): The UUID of the episode.
* **Required Permissions**: `ai`

---

## 📂 Resources

ContextLens exposes workspace state as read-only resources:

### `workspace://current`
Metadata about the active workspace folders, active project, current episode, and authentication status.
* **MIME Type**: `application/json`

### `workspace://git-diff`
Current uncommitted changes (git diff) in the active workspace.
* **MIME Type**: `text/plain`

### `workspace://episodes`
List of coding episodes in the current project.
* **MIME Type**: `application/json`

### `workspace://diagnostics`
Current VS Code workspace diagnostics (errors, warnings, hints, information).
* **MIME Type**: `application/json`

### `workspace://symbols`
Top-level code symbols (classes, functions, interfaces) in the workspace.
* **MIME Type**: `application/json`

---

## 📝 Prompts

ContextLens provides pre-defined prompt templates:

### `explain_diff`
Generates a prompt to explain code changes.
* **Arguments**:
  * `diff` (string, required): The git diff content.
  * `context` (string, optional): Additional context.

### `review_code`
Performs a code review with actionable feedback.
* **Arguments**:
  * `code` (string, required): Code content to review.
  * `language` (string, optional): Programming language.
  * `focus` (string, optional): Areas to focus on.

### `generate_tests`
Generates unit tests for a block of code.
* **Arguments**:
  * `code` (string, required): Target code block.
  * `framework` (string, optional): Testing framework.
  * `language` (string, optional): Programming language.

### `security_audit`
Scans code for security vulnerabilities.
* **Arguments**:
  * `code` (string, required): Code or configuration file.
  * `type` (string, optional): Audit type (code, config, api).

### `summarize_episode`
Summarizes all activity in a coding episode.
* **Arguments**:
  * `episodeData` (string, required): JSON string of episode details.
