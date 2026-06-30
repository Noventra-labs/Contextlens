#!/usr/bin/env node

/**
 * ContextLens CLI
 *
 * Implements mcp install, uninstall, and doctor commands.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as http from 'http';

const VERSION = '1.0.0';
const MCP_PORT = 3012;

function printHelp() {
  console.log(`
ContextLens CLI v${VERSION}

Usage:
  contextlens mcp install     - Install ContextLens MCP configuration for Claude and Cursor
  contextlens mcp uninstall   - Remove ContextLens MCP configuration
  contextlens mcp doctor      - Run health checks and diagnostics
  contextlens mcp run         - Run the MCP bridge (JSON-RPC)
  contextlens --help          - Show this help message
`);
}

/**
 * Locate the active VS Code extension directory.
 */
function findExtensionDir(): string | null {
  const home = os.homedir();
  const extensionsDir = path.join(home, '.vscode', 'extensions');
  if (!fs.existsSync(extensionsDir)) {
    return null;
  }

  try {
    const dirs = fs.readdirSync(extensionsDir);
    const matches = dirs.filter(d => d.toLowerCase().startsWith('noventra-labs.contextlens-'));
    if (matches.length === 0) return null;

    // Sort to get the latest version
    matches.sort();
    return path.join(extensionsDir, matches[matches.length - 1]);
  } catch {
    return null;
  }
}

/**
 * Find the secret token file.
 */
function findSecret(): string | null {
  // Check standard extension location
  const extDir = findExtensionDir();
  if (extDir) {
    const secretPath = path.join(extDir, '.mcp-secret.json');
    if (fs.existsSync(secretPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
        return data.secret || null;
      } catch {}
    }
  }
  return null;
}

/**
 * Configure Claude Desktop.
 */
function configureClaude(install: boolean): boolean {
  const home = os.homedir();
  let configPath = '';

  if (process.platform === 'win32') {
    configPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  } else if (process.platform === 'darwin') {
    configPath = path.join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  } else {
    // Linux
    configPath = path.join(home, '.config', 'Claude', 'claude_desktop_config.json');
  }

  if (!fs.existsSync(path.dirname(configPath))) {
    return false;
  }

  try {
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    if (install) {
      config.mcpServers.contextlens = {
        command: 'contextlens',
        args: ['mcp', 'run']
      };
      console.log(`[OK] Configured Claude Desktop at ${configPath}`);
    } else {
      if (config.mcpServers.contextlens) {
        delete config.mcpServers.contextlens;
        console.log(`[OK] Removed ContextLens from Claude Desktop at ${configPath}`);
      }
    }

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err: any) {
    console.error(`[ERROR] Failed to configure Claude Desktop: ${err.message}`);
    return false;
  }
}

/**
 * Configure Cursor.
 */
function configureCursor(install: boolean): boolean {
  const home = os.homedir();
  let cursorConfigPath = '';

  if (process.platform === 'win32') {
    cursorConfigPath = path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'Cursor', 'User', 'globalStorage', 'storage.json');
  } else if (process.platform === 'darwin') {
    cursorConfigPath = path.join(home, 'Library', 'Application Support', 'Cursor', 'User', 'globalStorage', 'storage.json');
  } else {
    cursorConfigPath = path.join(home, '.config', 'Cursor', 'User', 'globalStorage', 'storage.json');
  }

  if (!fs.existsSync(cursorConfigPath)) {
    return false;
  }

  try {
    const data = JSON.parse(fs.readFileSync(cursorConfigPath, 'utf8'));
    // Cursor stores MCP in "mcpProviders" or "mcpServers"
    if (install) {
      if (!data['mcpServerKeys']) data['mcpServerKeys'] = [];
      if (!data['mcpServers']) data['mcpServers'] = {};

      data['mcpServers']['contextlens'] = {
        name: 'contextlens',
        type: 'command',
        command: 'contextlens mcp run',
        enabled: true
      };
      console.log(`[OK] Configured Cursor at ${cursorConfigPath}`);
    } else {
      if (data['mcpServers'] && data['mcpServers']['contextlens']) {
        delete data['mcpServers']['contextlens'];
        console.log(`[OK] Removed ContextLens from Cursor at ${cursorConfigPath}`);
      }
    }

    fs.writeFileSync(cursorConfigPath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err: any) {
    console.error(`[ERROR] Failed to configure Cursor: ${err.message}`);
    return false;
  }
}

async function runDoctor() {
  console.log('Running ContextLens MCP Diagnostics...\n');

  // 1. Node.js check
  console.log(`Node.js Version: ${process.version} - OK`);

  // 2. VS Code Extension Check
  const extDir = findExtensionDir();
  if (extDir) {
    console.log(`[OK] Found ContextLens VS Code extension at: ${extDir}`);
  } else {
    console.warn(`[WARNING] ContextLens VS Code extension not found in ~/.vscode/extensions.`);
    console.warn(`Please make sure the extension is installed in VS Code.`);
  }

  // 3. Port Check
  const isPortActive = await new Promise<boolean>((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: MCP_PORT,
      path: '/mcp/health',
      method: 'GET',
      timeout: 1500
    }, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });

  if (isPortActive) {
    console.log(`[OK] ContextLens helper server is active and listening on port ${MCP_PORT}`);
    // Fetch detailed health report
    try {
      const report = await new Promise<any>((resolve, reject) => {
        http.get(`http://127.0.0.1:${MCP_PORT}/mcp/health`, (res) => {
          let body = '';
          res.on('data', chunk => body += chunk);
          res.on('end', () => resolve(JSON.parse(body)));
        }).on('error', reject);
      });
      console.log('Detailed health status:');
      for (const check of report.checks) {
        const mark = check.status === 'ok' ? '✓' : check.status === 'warning' ? '⚠' : '✗';
        console.log(`  ${mark} ${check.component}: ${check.message}`);
      }
    } catch {}
  } else {
    console.error(`[ERROR] ContextLens helper server is NOT running on port ${MCP_PORT}.`);
    console.error(`Please open VS Code and ensure ContextLens extension is active.`);
  }

  // 4. Token Check
  const secret = findSecret();
  if (secret) {
    console.log(`[OK] MCP Secret token found and loaded.`);
  } else {
    console.warn(`[WARNING] Active MCP Secret token not found. It will be generated when the extension starts.`);
  }
}

/**
 * Starts the stdio JSON-RPC bridge.
 * In a real release, this executes the bridge code directly.
 */
function runBridge() {
  const extDir = findExtensionDir();
  const bridgePath = extDir ? path.join(extDir, 'mcp-bridge.js') : null;

  if (bridgePath && fs.existsSync(bridgePath)) {
    // Dynamically load/require or spawn the bridge script
    require(bridgePath);
  } else {
    console.error('[ERROR] Could not find mcp-bridge.js inside VS Code extensions directory.');
    console.error('Please ensure the ContextLens VS Code extension is installed and built.');
    process.exit(1);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }

  const command = args[0];
  const subCommand = args[1];

  if (command === 'mcp') {
    if (subCommand === 'install') {
      const claudeOk = configureClaude(true);
      const cursorOk = configureCursor(true);
      if (!claudeOk && !cursorOk) {
        console.warn('\n[WARNING] No supported AI clients (Claude Desktop, Cursor) were found/configured.');
      } else {
        console.log('\n[SUCCESS] ContextLens MCP installation complete!');
      }
    } else if (subCommand === 'uninstall') {
      configureClaude(false);
      configureCursor(false);
      console.log('\n[SUCCESS] ContextLens MCP configuration uninstalled.');
    } else if (subCommand === 'doctor') {
      await runDoctor();
    } else if (subCommand === 'run') {
      runBridge();
    } else {
      printHelp();
    }
  } else {
    printHelp();
  }
}

main().catch(console.error);
