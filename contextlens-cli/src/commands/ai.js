const { request } = require('../api');
const { success, error, detail, section, warn } = require('../utils/format');
const { getDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');

async function explainCommand(options) {
  const projectId = options.project || getDefaultProject();
  if (!projectId) {
    error('No project specified. Use --project <id> or set a default.');
    process.exit(1);
  }
  if (!options.episode) {
    error('Missing --episode <id>');
    process.exit(1);
  }

  const spinner = ora('Generating AI explanation...').start();
  try {
    const res = await request('/episodes/explain', {
      projectId,
      episodeId: options.episode,
    });
    spinner.stop();

    section('AI Diff Explanation');
    if (res.fromCache) {
      console.log(chalk.dim('  (cached result)'));
    }

    console.log();
    console.log(chalk.white(`  ${res.summary}`));

    if (res.risks && res.risks.length > 0) {
      console.log();
      console.log(chalk.bold.yellow('  ⚠ Risks:'));
      res.risks.forEach(r => console.log(chalk.yellow(`    • ${r}`)));
    }

    if (res.checks && res.checks.length > 0) {
      console.log();
      console.log(chalk.bold.cyan('  ✓ Review Checks:'));
      res.checks.forEach(c => console.log(chalk.cyan(`    □ ${c}`)));
    }
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function summarizeCommand(options) {
  const projectId = options.project || getDefaultProject();
  if (!projectId) {
    error('No project specified. Use --project <id> or set a default.');
    process.exit(1);
  }
  if (!options.branch) {
    error('Missing --branch <name>');
    process.exit(1);
  }

  const spinner = ora(`Summarizing branch "${options.branch}"...`).start();
  try {
    // First, fetch episodes for this branch to pass as context
    let episodes = [];
    try {
      const epRes = await request('/episodes/list', {
        projectId,
        limit: 50,
        includeClosed: true,
      });
      episodes = (epRes.episodes || [])
        .filter(ep => ep.branchName === options.branch)
        .map(ep => ({
          episodeSummary: ep.label || `Episode on ${ep.branchName}`,
          label: ep.label,
        }));
    } catch {
      // Continue with empty episodes
    }

    if (episodes.length === 0) {
      spinner.stop();
      warn(`No episodes found for branch "${options.branch}". Summary may be limited.`);
      spinner.start();
    }

    const res = await request('/branches/summarize', {
      projectId,
      branchName: options.branch,
      episodes,
    });
    spinner.stop();

    section(`Branch Summary: ${options.branch}`);
    console.log();
    console.log(chalk.white(`  ${res.pr_summary}`));

    if (res.key_changes && res.key_changes.length > 0) {
      console.log();
      console.log(chalk.bold.cyan('  Key Changes:'));
      res.key_changes.forEach(c => console.log(chalk.white(`    • ${c}`)));
    }

    if (res.review_risks && res.review_risks.length > 0) {
      console.log();
      console.log(chalk.bold.yellow('  ⚠ Review Risks:'));
      res.review_risks.forEach(r => console.log(chalk.yellow(`    • ${r}`)));
    }
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { explainCommand, summarizeCommand };
