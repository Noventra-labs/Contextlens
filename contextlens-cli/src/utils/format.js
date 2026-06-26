const chalk = require('chalk');

/**
 * Print a formatted table to stdout.
 * @param {string[]} headers - Column headers.
 * @param {string[][]} rows - Array of row arrays.
 */
function table(headers, rows) {
  if (rows.length === 0) {
    console.log(chalk.dim('  No results.'));
    return;
  }

  // Calculate column widths
  const widths = headers.map((h, i) => {
    const maxRow = rows.reduce((max, row) => Math.max(max, (row[i] || '').length), 0);
    return Math.max(h.length, maxRow);
  });

  // Header line
  const headerLine = headers.map((h, i) => chalk.bold.cyan(h.padEnd(widths[i]))).join('  ');
  const separator = widths.map(w => chalk.dim('─'.repeat(w))).join('──');

  console.log(`  ${headerLine}`);
  console.log(`  ${separator}`);

  for (const row of rows) {
    const line = row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  ');
    console.log(`  ${line}`);
  }
}

/**
 * Truncate text to maxLen with ellipsis.
 */
function truncate(text, maxLen = 40) {
  if (!text) return '';
  text = String(text);
  return text.length > maxLen ? text.slice(0, maxLen - 1) + '…' : text;
}

/**
 * Format a Firestore timestamp or ISO string to a readable date.
 */
function formatDate(ts) {
  if (!ts) return '—';
  try {
    if (ts._seconds) {
      return new Date(ts._seconds * 1000).toLocaleString();
    }
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

/**
 * Print a success message.
 */
function success(msg) {
  console.log(chalk.green('✔') + ' ' + msg);
}

/**
 * Print an error message.
 */
function error(msg) {
  console.error(chalk.red('✖') + ' ' + msg);
}

/**
 * Print an info message.
 */
function info(msg) {
  console.log(chalk.blue('ℹ') + ' ' + msg);
}

/**
 * Print a warning message.
 */
function warn(msg) {
  console.log(chalk.yellow('⚠') + ' ' + msg);
}

/**
 * Print a key-value detail line.
 */
function detail(key, value) {
  console.log(`  ${chalk.dim(key + ':')} ${value || chalk.dim('—')}`);
}

/**
 * Print a section header.
 */
function section(title) {
  console.log();
  console.log(chalk.bold.white(`  ${title}`));
  console.log(chalk.dim('  ' + '─'.repeat(title.length + 4)));
}

module.exports = {
  table,
  truncate,
  formatDate,
  success,
  error,
  info,
  warn,
  detail,
  section,
};
