#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');

const program = new Command();

program
  .name('contextlens')
  .description(chalk.bold('ContextLens CLI') + chalk.dim(' — manage projects, episodes & AI from the terminal'))
  .version('1.0.0');

// ── Auth Commands ───────────────────────────────────────────────────────────

program
  .command('login')
  .description('Sign in with Google (opens browser)')
  .action(async () => {
    const cmd = require('../src/commands/login');
    await cmd();
  });

program
  .command('logout')
  .description('Clear saved credentials')
  .action(() => {
    const cmd = require('../src/commands/logout');
    cmd();
  });

program
  .command('whoami')
  .description('Show current authenticated user')
  .action(() => {
    const cmd = require('../src/commands/whoami');
    cmd();
  });

// ── Status ──────────────────────────────────────────────────────────────────

program
  .command('status')
  .description('Show current user, git context, and open episodes')
  .action(async () => {
    const cmd = require('../src/commands/status');
    await cmd();
  });

// ── Init ────────────────────────────────────────────────────────────────────

program
  .command('init')
  .description('Initialize ContextLens project from current directory (auto-detects git)')
  .option('-n, --name <name>', 'Project name (defaults to folder name)')
  .action(async (options) => {
    const cmd = require('../src/commands/init');
    await cmd(options);
  });

// ── Dashboard ───────────────────────────────────────────────────────────────

program
  .command('dashboard')
  .alias('dash')
  .description('Open ContextLens web dashboard in browser')
  .action(async () => {
    const cmd = require('../src/commands/dashboard');
    await cmd();
  });

// ── Config ──────────────────────────────────────────────────────────────────

program
  .command('config')
  .description('Get or set CLI configuration')
  .option('-p, --project <id>', 'Set default project ID')
  .action(async (options) => {
    const { configProject } = require('../src/commands/projects');
    await configProject(options);
  });

// ── Projects ────────────────────────────────────────────────────────────────

const projects = program
  .command('projects')
  .description('Manage projects');

projects
  .command('list')
  .description('List all projects')
  .action(async () => {
    const { listProjects } = require('../src/commands/projects');
    await listProjects();
  });

projects
  .command('create')
  .description('Create a new project')
  .requiredOption('-n, --name <name>', 'Project name')
  .option('-r, --repo <url>', 'Repository URL')
  .option('-w, --workspace <name>', 'Local workspace name')
  .option('-b, --branch <branch>', 'Default branch', 'main')
  .option('-d, --set-default', 'Set as default project')
  .action(async (options) => {
    const { createProject } = require('../src/commands/projects');
    await createProject(options);
  });

// ── Episodes ────────────────────────────────────────────────────────────────

const episodes = program
  .command('episodes')
  .description('Manage coding episodes');

episodes
  .command('list')
  .description('List episodes for a project')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .option('-l, --limit <n>', 'Max episodes to fetch', '20')
  .option('-a, --all', 'Include closed episodes')
  .action(async (options) => {
    const { listEpisodes } = require('../src/commands/episodes');
    await listEpisodes(options);
  });

episodes
  .command('create')
  .description('Create a new episode')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .option('-b, --branch <name>', 'Branch name', 'main')
  .option('--label <label>', 'Episode label')
  .action(async (options) => {
    const { createEpisode } = require('../src/commands/episodes');
    await createEpisode(options);
  });

episodes
  .command('close')
  .description('Close an episode')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-e, --episode <id>', 'Episode ID')
  .action(async (options) => {
    const { closeEpisode } = require('../src/commands/episodes');
    await closeEpisode(options);
  });

episodes
  .command('get')
  .description('Get episode details with AI calls')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-e, --episode <id>', 'Episode ID')
  .action(async (options) => {
    const { getEpisode } = require('../src/commands/episodes');
    await getEpisode(options);
  });

episodes
  .command('export')
  .description('Export episode as markdown')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-e, --episode <id>', 'Episode ID')
  .option('-o, --output <file>', 'Output file path')
  .action(async (options) => {
    const { exportEpisode } = require('../src/commands/episodes');
    await exportEpisode(options);
  });

// ── Search ──────────────────────────────────────────────────────────────────

program
  .command('search')
  .description('Search episodes and AI calls')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-q, --query <text>', 'Search query')
  .action(async (options) => {
    const cmd = require('../src/commands/search');
    await cmd(options);
  });

// ── AI ──────────────────────────────────────────────────────────────────────

const ai = program
  .command('ai')
  .description('AI-powered analysis');

ai
  .command('explain')
  .description('Get AI explanation of episode diff')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-e, --episode <id>', 'Episode ID')
  .action(async (options) => {
    const { explainCommand } = require('../src/commands/ai');
    await explainCommand(options);
  });

ai
  .command('summarize')
  .description('Summarize branch activity')
  .option('-p, --project <id>', 'Project ID (or uses default)')
  .requiredOption('-b, --branch <name>', 'Branch name')
  .action(async (options) => {
    const { summarizeCommand } = require('../src/commands/ai');
    await summarizeCommand(options);
  });

// ── Parse & Run ─────────────────────────────────────────────────────────────

program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  console.log();
  console.log(chalk.bold.cyan('  ContextLens CLI') + chalk.dim(' v1.0.0'));
  console.log(chalk.dim('  Manage projects, episodes & AI from the terminal.'));
  console.log();
  program.outputHelp();
}
