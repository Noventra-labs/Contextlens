const { request } = require('../api');
const { table, success, error, truncate, formatDate, detail, section } = require('../utils/format');
const { getDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

function resolveProject(options) {
  const projectId = options.project || getDefaultProject();
  if (!projectId) {
    error('No project specified. Use --project <id> or set a default with: contextlens config --project <id>');
    process.exit(1);
  }
  return projectId;
}

async function listEpisodes(options) {
  const projectId = resolveProject(options);
  const spinner = ora('Fetching episodes...').start();
  try {
    const res = await request('/episodes/list', {
      projectId,
      limit: parseInt(options.limit, 10) || 20,
      includeClosed: !!options.all,
    });
    spinner.stop();

    const episodes = res.episodes || [];
    section(`Episodes (${episodes.length})`);
    table(
      ['ID', 'Branch', 'Status', 'Calls', 'Started', 'Label'],
      episodes.map(ep => [
        truncate(ep.id, 12),
        truncate(ep.branchName || 'main', 20),
        ep.status === 'open' ? chalk.green(ep.status) : chalk.dim(ep.status),
        String(ep.callCount || 0),
        formatDate(ep.startedAt),
        truncate(ep.label || '', 30),
      ])
    );
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function createEpisode(options) {
  const projectId = resolveProject(options);
  const spinner = ora('Creating episode...').start();
  try {
    const res = await request('/episodes/create', {
      projectId,
      branchName: options.branch || 'main',
      label: options.label || null,
    });
    spinner.stop();
    success(`Episode created: ${res.episodeId}`);
    detail('Project', projectId);
    detail('Branch', options.branch || 'main');
    detail('Label', options.label || '(none)');
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function closeEpisode(options) {
  const projectId = resolveProject(options);
  if (!options.episode) {
    error('Missing --episode <id>');
    process.exit(1);
  }
  const spinner = ora('Closing episode...').start();
  try {
    await request('/episodes/close', {
      projectId,
      episodeId: options.episode,
    });
    spinner.stop();
    success(`Episode ${options.episode} closed.`);
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function getEpisode(options) {
  const projectId = resolveProject(options);
  if (!options.episode) {
    error('Missing --episode <id>');
    process.exit(1);
  }
  const spinner = ora('Fetching episode...').start();
  try {
    const res = await request('/episodes/get', {
      projectId,
      episodeId: options.episode,
    });
    spinner.stop();

    const ep = res.episode;
    section(`Episode: ${ep.label || ep.id}`);
    detail('ID', ep.id);
    detail('Branch', ep.branchName);
    detail('Status', ep.status === 'open' ? chalk.green(ep.status) : chalk.dim(ep.status));
    detail('Started', formatDate(ep.startedAt));
    detail('Ended', formatDate(ep.endedAt));
    detail('AI Calls', String(ep.callCount || 0));
    detail('Notes', ep.manualNotes || chalk.dim('none'));

    if (ep.changedFiles && ep.changedFiles.length > 0) {
      console.log();
      console.log(chalk.dim('  Changed Files:'));
      ep.changedFiles.forEach(f => console.log(`    ${chalk.white(f)}`));
    }

    const calls = res.calls || [];
    if (calls.length > 0) {
      section('AI Calls');
      table(
        ['ID', 'Source', 'Model', 'Latency', 'Created'],
        calls.slice(0, 10).map(c => [
          truncate(c.id, 12),
          c.source || '—',
          truncate(c.modelName || '—', 20),
          c.latencyMs ? `${c.latencyMs}ms` : '—',
          formatDate(c.createdAt),
        ])
      );
    }
    console.log();
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function exportEpisode(options) {
  const projectId = resolveProject(options);
  if (!options.episode) {
    error('Missing --episode <id>');
    process.exit(1);
  }
  const spinner = ora('Exporting episode...').start();
  try {
    const res = await request('/episodes/export', {
      projectId,
      episodeId: options.episode,
    });
    spinner.stop();

    const content = res.raw || JSON.stringify(res, null, 2);
    const outFile = options.output || `episode-${options.episode}.md`;
    fs.writeFileSync(outFile, content, 'utf-8');
    success(`Episode exported to: ${path.resolve(outFile)}`);
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = { listEpisodes, createEpisode, closeEpisode, getEpisode, exportEpisode };
