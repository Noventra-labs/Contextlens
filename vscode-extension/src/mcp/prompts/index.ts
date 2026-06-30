/**
 * MCP Prompt Library
 *
 * Reusable prompt templates for AI-powered operations.
 * Supports prompts/list and prompts/get MCP protocol methods.
 */

export interface McpPrompt {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  /** Generate the prompt messages given arguments */
  handler: (args: Record<string, string>) => Array<{
    role: 'user' | 'assistant';
    content: { type: 'text'; text: string };
  }>;
}

// ── Explain Diff ────────────────────────────────────────────────────────────

const explainDiffPrompt: McpPrompt = {
  name: 'explain_diff',
  description: 'Generate a detailed explanation of code changes in a git diff',
  arguments: [
    { name: 'diff', description: 'The git diff to explain', required: true },
    { name: 'context', description: 'Additional context about the changes', required: false },
  ],
  handler: (args) => [{
    role: 'user',
    content: {
      type: 'text',
      text: `Analyze the following code diff and provide:
1. A summary of what changed
2. The likely intent behind these changes
3. Any potential risks or issues
4. Suggested follow-up actions

${args.context ? `Context: ${args.context}\n\n` : ''}Diff:
\`\`\`diff
${args.diff}
\`\`\``,
    },
  }],
};

// ── Review Code ─────────────────────────────────────────────────────────────

const reviewCodePrompt: McpPrompt = {
  name: 'review_code',
  description: 'Perform a thorough code review with actionable feedback',
  arguments: [
    { name: 'code', description: 'The code to review', required: true },
    { name: 'language', description: 'Programming language', required: false },
    { name: 'focus', description: 'Areas to focus on (security, performance, style)', required: false },
  ],
  handler: (args) => [{
    role: 'user',
    content: {
      type: 'text',
      text: `Review the following ${args.language || ''} code. ${args.focus ? `Focus on: ${args.focus}.` : ''}

Provide feedback on:
1. Code quality and readability
2. Potential bugs or edge cases
3. Performance considerations
4. Security concerns
5. Suggested improvements

\`\`\`${args.language || ''}
${args.code}
\`\`\``,
    },
  }],
};

// ── Generate Tests ──────────────────────────────────────────────────────────

const generateTestsPrompt: McpPrompt = {
  name: 'generate_tests',
  description: 'Generate unit tests for given code',
  arguments: [
    { name: 'code', description: 'The code to generate tests for', required: true },
    { name: 'framework', description: 'Test framework (jest, mocha, vitest)', required: false },
    { name: 'language', description: 'Programming language', required: false },
  ],
  handler: (args) => [{
    role: 'user',
    content: {
      type: 'text',
      text: `Generate comprehensive unit tests for the following code using ${args.framework || 'the appropriate test framework'}.

Include:
1. Happy path tests
2. Edge case tests
3. Error handling tests
4. Mock setup where needed

\`\`\`${args.language || ''}
${args.code}
\`\`\``,
    },
  }],
};

// ── Security Audit ──────────────────────────────────────────────────────────

const securityAuditPrompt: McpPrompt = {
  name: 'security_audit',
  description: 'Perform a security audit of code or configuration',
  arguments: [
    { name: 'code', description: 'The code or config to audit', required: true },
    { name: 'type', description: 'Type of audit (code, config, api, auth)', required: false },
  ],
  handler: (args) => [{
    role: 'user',
    content: {
      type: 'text',
      text: `Perform a security audit on the following ${args.type || 'code'}.

Check for:
1. Input validation vulnerabilities
2. Authentication/authorization issues
3. Data exposure risks
4. Injection vulnerabilities (SQL, XSS, command)
5. Secrets or credentials in code
6. Insecure configurations
7. OWASP Top 10 concerns

Rate severity: Critical, High, Medium, Low

\`\`\`
${args.code}
\`\`\``,
    },
  }],
};

// ── Summarize Episode ───────────────────────────────────────────────────────

const summarizeEpisodePrompt: McpPrompt = {
  name: 'summarize_episode',
  description: 'Generate a summary of a coding episode and its AI interactions',
  arguments: [
    { name: 'episodeData', description: 'JSON data of the episode including AI calls', required: true },
  ],
  handler: (args) => [{
    role: 'user',
    content: {
      type: 'text',
      text: `Summarize the following coding episode. Provide:
1. What the developer was working on
2. Key decisions made
3. AI tools used and how they helped
4. Files changed and why
5. Potential follow-up tasks

Episode data:
\`\`\`json
${args.episodeData}
\`\`\``,
    },
  }],
};

// ── Registry ────────────────────────────────────────────────────────────────

const prompts: Map<string, McpPrompt> = new Map();
[explainDiffPrompt, reviewCodePrompt, generateTestsPrompt, securityAuditPrompt, summarizeEpisodePrompt].forEach(p => {
  prompts.set(p.name, p);
});

export function listPrompts(): Array<{
  name: string;
  description: string;
  arguments?: Array<{ name: string; description: string; required: boolean }>;
}> {
  return Array.from(prompts.values()).map(p => ({
    name: p.name,
    description: p.description,
    arguments: p.arguments,
  }));
}

export function getPrompt(
  name: string,
  args: Record<string, string>
): Array<{ role: string; content: { type: string; text: string } }> | null {
  const prompt = prompts.get(name);
  if (!prompt) return null;
  return prompt.handler(args);
}

export function registerPrompt(prompt: McpPrompt): void {
  prompts.set(prompt.name, prompt);
}
