const { login } = require('../auth');
const { success, error, info } = require('../utils/format');
const ora = require('ora');

async function loginCommand() {
  info('Opening browser for Google Sign-In...');
  const spinner = ora('Waiting for authentication...').start();

  try {
    const creds = await login();
    spinner.stop();
    success(`Logged in as ${creds.email} (uid: ${creds.uid})`);
  } catch (err) {
    spinner.stop();
    error(`Login failed: ${err.message}`);
    process.exit(1);
  }
}

module.exports = loginCommand;
