const { request } = require('../api');
const { success, error, detail, info, warn } = require('../utils/format');
const { setDefaultProject, getDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');
const { execSync } = require('child_process');
const path = require('path');

async function initCommand(options) {
  // Detect git repo info
  let repoUrl = null;
  let branch = 'main';
  let workspaceName = path.basename(process.cwd());

  try {
    repoUrl = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    warn('No git remote found. Project will be created without repo URL.');
  }

  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {}

  const projectName = options.name || workspaceName;

  info(`Initializing ContextLens project from current directory...`);
  detail('Name', chalk.white.bold(projectName));
  detail('Workspace', workspaceName);
  detail('Repo', repoUrl || chalk.dim('none'));
  detail('Branch', branch);
  console.log();

  const spinner = ora('Creating project on ContextLens...').start();
  try {
    const res = await request('/projects/create', {
      name: projectName,
      repoUrl: repoUrl || null,
      localWorkspaceName: workspaceName,
      defaultBranch: branch,
    });
    spinner.stop();

    // Set as default project
    setDefaultProject(res.projectId);

    success(`Project created & set as default!`);
    detail('Project ID', chalk.cyan(res.projectId));
    console.log();
    info('Now use:');
    console.log(chalk.dim('  contextlens episodes create --branch ' + branch));
    console.log(chalk.dim('  contextlens status'));
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = initCommand;
