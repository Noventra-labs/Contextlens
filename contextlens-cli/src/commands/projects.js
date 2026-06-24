const { request } = require('../api');
const { table, success, error, truncate, formatDate, detail, section } = require('../utils/format');
const { getDefaultProject, setDefaultProject } = require('../utils/config');
const ora = require('ora');
const chalk = require('chalk');

async function listProjects() {
  const spinner = ora('Fetching projects...').start();
  try {
    // The backend doesn't have a dedicated /projects/list endpoint,
    // but we can use search with empty query to list episodes which contains project info.
    // Actually, looking at the Firestore structure, we need to fetch projects directly.
    // The core service doesn't expose a /projects/list — let's add a workaround
    // by using the dashboard's approach of listing from Firestore.
    // For now, we'll note this limitation and use what's available.
    
    // The dashboard fetches projects client-side via Firebase SDK.
    // The backend API doesn't have a /projects/list endpoint.
    // We'll create a search-based approach or list via episodes.
    spinner.stop();
    error('The backend does not currently expose a /projects/list endpoint.');
    console.log(chalk.dim('  Use the dashboard to view all projects, or use a project ID directly.'));
    console.log(chalk.dim('  Set a default project: contextlens config --project <id>'));
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function createProject(options) {
  const spinner = ora('Creating project...').start();
  try {
    const body = {
      name: options.name,
      repoUrl: options.repo || null,
      localWorkspaceName: options.workspace || null,
      defaultBranch: options.branch || 'main',
    };
    const res = await request('/projects/create', body);
    spinner.stop();
    success(`Project created: ${res.projectId}`);
    detail('Name', options.name);
    detail('ID', chalk.cyan(res.projectId));

    if (options.setDefault) {
      setDefaultProject(res.projectId);
      success(`Set as default project.`);
    }
  } catch (err) {
    spinner.stop();
    error(`Failed: ${err.message}`);
    process.exit(1);
  }
}

async function configProject(options) {
  if (options.project) {
    setDefaultProject(options.project);
    success(`Default project set to: ${options.project}`);
  } else {
    const current = getDefaultProject();
    if (current) {
      detail('Default Project', chalk.cyan(current));
    } else {
      error('No default project set. Use: contextlens config --project <id>');
    }
  }
}

module.exports = { listProjects, createProject, configProject };
