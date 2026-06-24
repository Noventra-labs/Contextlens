const { logout } = require('../auth');
const { success } = require('../utils/format');

function logoutCommand() {
  logout();
  success('Logged out. Credentials cleared.');
}

module.exports = logoutCommand;
