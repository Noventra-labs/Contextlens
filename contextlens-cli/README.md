# @noventra-labs/contextlens-cli

> **ContextLens CLI** — manage projects, episodes, and AI-driven coding insights directly from your terminal.

ContextLens is an AI-powered developer companion that bridges the gap between your codebase changes and design intent. This command-line utility lets you organize your changes into **Episodes**, search your development history, and trigger **Gemini-powered AI analyses** of diffs and branch history.

---

##  Installation

Install the CLI globally via `npm`:

```bash
npm install -g @noventra-labs/contextlens-cli
```

Ensure you have Node.js version **16.0.0 or higher** installed.

---

##  Quick Start

### 1. Authenticate
Authenticate your CLI with your Google Account:
```bash
contextlens login
```
This opens your browser for secure authentication. To see who you are logged in as:
```bash
contextlens whoami
```

### 2. Link Your Codebase Project
Initialize ContextLens in your workspace directory:
```bash
contextlens init
```
*This command auto-detects your current folder, git repository URL, and active branch, establishing it as the default project.*

### 3. Check Status
Get current git details and active context:
```bash
contextlens status
```

### 4. Launch Dashboard
Open the ContextLens web interface:
```bash
contextlens dashboard
# or use alias
contextlens dash
```

---

##  Command Reference

Run `contextlens --help` or `contextlens [command] --help` for detailed parameters.

### Authentications
* `contextlens login`: Authenticate with Google
* `contextlens logout`: Log out and clear saved credentials
* `contextlens whoami`: Show current logged-in user
* `contextlens status`: View status of projects, current git state, and open episodes

### Project Management
* `contextlens init [-n <name>]`: Link current folder as a project
* `contextlens config -p <project-id>`: Set the default active project
* `contextlens projects list`: List linked projects
* `contextlens projects create -n <name> [-r <repo-url>] [-w <workspace>] [-b <branch>] [-d]`: Create a new project

### Episode Management
* `contextlens episodes list [-p <project-id>] [-l <limit>] [-a]`: List episodes (add `-a` to include closed ones)
* `contextlens episodes create [-p <project-id>] [-b <branch>] [--label <label>]`: Create a new tracking episode
* `contextlens episodes close -e <episode-id> [-p <project-id>]`: Close an active episode
* `contextlens episodes get -e <episode-id> [-p <project-id>]`: Retrieve episode metadata and logged AI calls
* `contextlens episodes export -e <episode-id> [-p <project-id>] -o <output-file>`: Export episode summary as Markdown

### AI Insights
* `contextlens ai explain -e <episode-id> [-p <project-id>]`: Generate a Gemini AI explanation of the episode's changes/diff
* `contextlens ai summarize -b <branch-name> [-p <project-id>]`: Generate a summary of work done on a specific branch

### Search
* `contextlens search -q <query> [-p <project-id>]`: Full-text search across episodes and AI interactions

---

##  Local Config

Configuration and authentication tokens are securely cached locally in your home directory:
`~/.contextlens/`

* `credentials.json`: Authentications & tokens
* `config.json`: Default project mappings

---

##  License

MIT License. See root directory for details.
