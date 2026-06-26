const { request } = require('../api');
const { whoami } = require('../auth');
const { success, error, detail, section, info, warn, table, truncate, formatDate } = require('../utils/format');
const { getDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');
const { execSync } = require('child_process');

async function statusCommand() {
  const user = whoami();
  if (!user) {
    error('Not logged in. Run `contextlens login` first.');
    process.exit(1);
  }

  section('ContextLens Status');
  detail('User', chalk.white.bold(user.email));
  detail('Token', user.isExpired ? chalk.red('Expired') : chalk.green('Active'));

  // Try to detect current git branch
  let currentBranch = null;
  let remoteUrl = null;
  try {
    currentBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    detail('Git Branch', chalk.cyan(currentBranch));
  } catch {
    detail('Git Branch', chalk.dim('not in a git repo'));
  }

  try {
    remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    detail('Git Remote', chalk.dim(remoteUrl));
  } catch {}

  const projectId = getDefaultProject();
  if (!projectId) {
    console.log();
    warn('No default project set. Use: contextlens config --project <id>');
    console.log();
    return;
  }

  detail('Default Project', chalk.cyan(projectId));

  // Fetch recent open episodes
  const spinner = ora('Fetching recent activity...').start();
  try {
    const res = await request('/episodes/list', {
      projectId,
      limit: 5,
      includeClosed: false,
    });
    spinner.stop();

    const episodes = res.episodes || [];
    if (episodes.length > 0) {
      section(`Open Episodes (${episodes.length})`);
      table(
        ['ID', 'Branch', 'Calls', 'Started', 'Label'],
        episodes.map(ep => [
          truncate(ep.id, 12),
          truncate(ep.branchName || 'main', 20),
          String(ep.callCount || 0),
          formatDate(ep.startedAt),
          truncate(ep.label || '', 25),
        ])
      );
    } else {
      console.log();
      info('No open episodes.');
    }
    console.log();
  } catch (err) {
    spinner.stop();
    warn(`Could not fetch episodes: ${err.message}`);
    console.log();
  }
}

module.exports = statusCommand;
