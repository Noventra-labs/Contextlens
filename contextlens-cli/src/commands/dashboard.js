const { success, info } = require('../utils/format');
const open = require('open');

const DASHBOARD_URL = 'https://contextlens-backend-001.web.app';

async function dashboardCommand() {
  info('Opening ContextLens dashboard in browser...');
  await open(DASHBOARD_URL);
  success(`Opened: ${DASHBOARD_URL}`);
}

module.exports = dashboardCommand;
