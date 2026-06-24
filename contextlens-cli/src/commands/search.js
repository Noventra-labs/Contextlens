const { request } = require('../api');
const { table, success, error, truncate, formatDate, section } = require('../utils/format');
const { getDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');

async function searchCommand(options) {
  const projectId = options.project || getDefaultProject();
  if (!projectId) {
    error('No project specified. Use --project <id> or set a default.');
    process.exit(1);
  }
  if (!options.query) {
    error('Missing --query <text>');
    process.exit(1);
  }

  const spinner = ora(`Searching for "${options.query}"...`).start();
  try {
    const res = await request('/search', {
      projectId,
      q: options.query,
    });
    spinner.stop();

    const episodes = res.episodes || [];
    const calls = res.calls || [];

    section(`Search Results: "${options.query}"`);

    if (episodes.length > 0) {
      console.log(chalk.bold.white(`\n  Episodes (${episodes.length}):`));
      table(
        ['ID', 'Branch', 'Status', 'Label', 'Started'],
        episodes.map(ep => [
          truncate(ep.id, 12),
          truncate(ep.branchName || 'main', 20),
          ep.status === 'open' ? chalk.green(ep.status) : chalk.dim(ep.status),
          truncate(ep.label || '', 25),
          formatDate(ep.startedAt),
        ])
      );
    }

    if (calls.length > 0) {
      console.log(chalk.bold.white(`\n  AI Calls (${calls.length}):`));
      table(
        ['ID', 'Episode', 'Source', 'Model', 'Prompt'],
        calls.map(c => [
          truncate(c.id, 12),
          truncate(c.episodeId, 12),
          c.source || '—',
          truncate(c.modelName || '—', 15),
          truncate(c.promptText || '', 40),
        ])
      );
    }

    if (episodes.length === 0 && calls.length === 0) {
      console.log(chalk.dim('  No results found.'));
    }
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = searchCommand;
