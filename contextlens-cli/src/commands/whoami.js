const { whoami } = require('../auth');
const { success, error, detail, section } = require('../utils/format');
const chalk = require('chalk');

function whoamiCommand() {
  const user = whoami();

  if (!user) {
    error('Not logged in. Run `contextlens login` first.');
    process.exit(1);
  }

  section('Current User');
  detail('Email', chalk.white.bold(user.email));
  detail('UID', user.uid);
  detail('Token Expires', user.expiresAt);
  detail('Status', user.isExpired ? chalk.red('Expired') : chalk.green('Active'));
  console.log();
}

module.exports = whoamiCommand;
