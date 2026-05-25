#!/usr/bin/env node

/**
 * cl - Command Line Interface for ContextLens
 * 
 * Provides terminal-based commands to interact with ContextLens features
 * without needing to use the VS Code extension or web dashboard.
 */

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

// Version
const VERSION = '1.2.0';

// Configuration constants
const DEFAULT_API_BASE_URL = 'https://us-central1-contextlens-backend-001.cloudfunctions.net/api';
const GLOBAL_CONFIG_PATH = path.join(process.env.HOME || process.env.USERPROFILE, '.contextlens', 'config.json');
const PROJECT_CONFIG_DIR = '.contextlens';
const PROJECT_CONFIG_FILE = 'config.json';

/**
 * Helper to ensure a directory exists
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Get the nearest project config directory by walking up from current directory
 */
function findProjectRoot(startDir = process.cwd()) {
  let curr = startDir;
  while (curr !== path.parse(curr).root) {
    if (fs.existsSync(path.join(curr, PROJECT_CONFIG_DIR))) {
      return curr;
    }
    curr = path.dirname(curr);
  }
  return null;
}

/**
 * Load configuration (merging global and local)
 */
function loadConfig() {
  let config = {
    token: process.env.CONTEXTLENS_TOKEN || null,
    projectId: process.env.CONTEXTLENS_PROJECT_ID || null,
    episodeId: process.env.CONTEXTLENS_EPISODE_ID || null,
    apiBaseUrl: process.env.CONTEXTLENS_API_URL || DEFAULT_API_BASE_URL
  };

  // Load global config
  if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
    try {
      const globalData = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      config = { ...config, ...globalData };
    } catch (e) {
      console.error('⚠️ Warning: Failed to parse global config.');
    }
  }

  // Load project config
  const projectRoot = findProjectRoot();
  if (projectRoot) {
    const projectPath = path.join(projectRoot, PROJECT_CONFIG_DIR, PROJECT_CONFIG_FILE);
    if (fs.existsSync(projectPath)) {
      try {
        const projectData = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
        config = { ...config, ...projectData };
      } catch (e) {
        console.error('⚠️ Warning: Failed to parse project config.');
      }
    }
  }

  return config;
}

/**
 * Save configuration
 */
function saveConfig(data, isGlobal = false) {
  if (isGlobal) {
    ensureDir(path.dirname(GLOBAL_CONFIG_PATH));
    let currentGlobal = {};
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
      try {
        currentGlobal = JSON.parse(fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf8'));
      } catch (e) {}
    }
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify({ ...currentGlobal, ...data }, null, 2));
  } else {
    const projectRoot = findProjectRoot() || process.cwd();
    const projectDir = path.join(projectRoot, PROJECT_CONFIG_DIR);
    ensureDir(projectDir);
    const projectPath = path.join(projectDir, PROJECT_CONFIG_FILE);
    let currentProject = {};
    if (fs.existsSync(projectPath)) {
      try {
        currentProject = JSON.parse(fs.readFileSync(projectPath, 'utf8'));
      } catch (e) {}
    }
    fs.writeFileSync(projectPath, JSON.stringify({ ...currentProject, ...data }, null, 2));
  }
}

/**
 * Helper to make API requests
 */
async function apiRequest(endpoint, method, data, token, baseUrl = DEFAULT_API_BASE_URL) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${baseUrl}${endpoint}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          if (!body) {
            if (res.statusCode >= 400) {
              reject(new Error(`Request failed with status ${res.statusCode}`));
            } else {
              resolve({});
            }
            return;
          }
          const parsedBody = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(parsedBody.error?.message || `Request failed with status ${res.statusCode}`));
          } else {
            resolve(parsedBody);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Initialize commander
program
  .name('cl')
  .description('CLI for ContextLens (cl) - AI-powered coding session tracker')
  .version(VERSION);

// Command: auth
program
  .command('auth')
  .description('Authenticate with ContextLens')
  .argument('<token>', 'Firebase ID token')
  .action((token) => {
    try {
      saveConfig({ token }, true);
      console.log('✅ Authentication token saved globally.');
    } catch (err) {
      console.error(`❌ Error saving auth: ${err.message}`);
    }
  });

// Command: init
program
  .command('init')
  .description('Initialize ContextLens in the current directory')
  .argument('[project-id]', 'Your ContextLens Project ID')
  .option('--dry-run', 'Show what would be done without making changes')
  .action((projectId, options) => {
    try {
      const configDir = path.join(process.cwd(), PROJECT_CONFIG_DIR);
      
      if (options.dryRun) {
        console.log('🔍 Dry Run — no changes will be made:');
        console.log(`   Would create directory: ${PROJECT_CONFIG_DIR}/`);
        if (projectId) console.log(`   Would set Project ID: ${projectId}`);
        else console.log('   Would create empty config (no Project ID).');
        return;
      }

      ensureDir(configDir);
      
      const configData = {};
      if (projectId) configData.projectId = projectId;
      
      const configPath = path.join(configDir, PROJECT_CONFIG_FILE);
      fs.writeFileSync(configPath, JSON.stringify(configData, null, 2));
      
      console.log('🚀 ContextLens initialized successfully!');
      console.log(`   Project folder created: ${PROJECT_CONFIG_DIR}/`);
      if (projectId) console.log(`   Project ID set to: ${projectId}`);
      else console.log('   ⚠️  No Project ID provided. Run "cl config set projectId <id>" later.');
    } catch (err) {
      console.error(`❌ Initialization failed: ${err.message}`);
    }
  });

// Command: config
program
  .command('config')
  .description('Manage ContextLens configuration')
  .argument('[action]', 'Action to perform (get, set, list, delete)', 'list')
  .argument('[key]', 'Configuration key (for get/set actions)')
  .argument('[value]', 'Configuration value (for set action)')
  .option('--global', 'Use global configuration instead of project-specific')
  .action((action, key, value, options) => {
    const config = loadConfig();
    const isGlobal = options.global;

    switch (action) {
      case 'set':
        if (!key || value === undefined) {
          console.error('❌ Error: Key and value are required for "set" action.');
          return;
        }
        try {
          saveConfig({ [key]: value }, isGlobal);
          console.log(`✅ Config set: ${key} = ${value} (${isGlobal ? 'global' : 'local'})`);
        } catch (err) {
          console.error(`❌ Error saving config: ${err.message}`);
        }
        break;

      case 'get':
        if (!key) {
          console.error('❌ Error: Key is required for "get" action.');
          return;
        }
        console.log(`${key}: ${config[key] || '(not set)'}`);
        break;

      case 'delete':
        if (!key) {
          console.error('❌ Error: Key is required for "delete" action.');
          return;
        }
        try {
          saveConfig({ [key]: null }, isGlobal);
          console.log(`✅ Config deleted: ${key} (${isGlobal ? 'global' : 'local'})`);
        } catch (err) {
          console.error(`❌ Error deleting config: ${err.message}`);
        }
        break;

      case 'list':
      default:
        console.log('⚙️  Current ContextLens Configuration (Merged)');
        console.log('============================================');
        Object.keys(config).forEach(k => {
          const val = k === 'token' ? '********' + config[k].slice(-5) : config[k];
          console.log(`   • ${k}: ${val || '(not set)'}`);
        });
        console.log('\n📄 Environment Variables:');
        console.log('   • CONTEXTLENS_TOKEN:', process.env.CONTEXTLENS_TOKEN ? '✅ Present' : '❌ Missing');
        console.log('   • CONTEXTLENS_API_URL:', process.env.CONTEXTLENS_API_URL || '❌ Missing');
        console.log('   • CONTEXTLENS_PROJECT_ID:', process.env.CONTEXTLENS_PROJECT_ID || '❌ Missing');
        break;
    }
  });

// Command: status
program
  .command('status')
  .description('Show current ContextLens status and statistics')
  .option('--detailed', 'Show detailed information')
  .action(async (options) => {
    const config = loadConfig();
    
    console.log('📊 ContextLens Status');
    console.log('====================');
    
    console.log(`🔐 Authentication: ${config.token ? '✅ Authenticated' : '❌ Not authenticated'}`);
    console.log(`📁 Project: ${config.projectId || '❌ Not configured'}`);
    console.log(`🎬 Active Episode: ${config.episodeId || '❌ None'}`);
    
    if (config.token && config.projectId) {
      try {
        process.stdout.write('📡 Fetching project stats from backend... ');
        // We use search with empty query to get a count or status if possible
        const results = await apiRequest('/search', 'POST', { projectId: config.projectId, q: '' }, config.token, config.apiBaseUrl);
        process.stdout.write('Done.\n');
        console.log(`   📈 Total Episodes: ${results.episodes?.length || 0}`);
        console.log(`   💬 Total AI Calls: ${results.calls?.length || 0}`);
      } catch (err) {
        process.stdout.write('Failed.\n');
        console.log(`   ⚠️  Could not connect to backend: ${err.message}`);
      }
    }

    if (options.detailed) {
      console.log('\n📋 Environment:');
      console.log('   🔧 Node.js version:', process.version);
      console.log('   📂 Current directory:', process.cwd());
      console.log('   🌐 API Base:', config.apiBaseUrl);
      const projectRoot = findProjectRoot();
      console.log('   🏗️  Project Root:', projectRoot || 'N/A');
    }
  });

// Command: log-call
program
  .command('log-call')
  .description('Log an AI call or external event to ContextLens')
  .option('-p, --project-id <id>', 'Project ID')
  .option('-e, --episode-id <id>', 'Episode ID')
  .requiredOption('-t, --prompt <text>', 'Prompt text or event description')
  .option('-r, --response <text>', 'Model response or event data')
  .option('-s, --source <name>', 'Source of the call (e.g., manual_log, git_commit)', 'manual_log')
  .option('-m, --model <name>', 'Model name used (optional)')
  .option('-i, --intent <tag>', 'Intent tag for classification')
  .option('--token <token>', 'Firebase ID token')
  .action(async (options) => {
    const config = loadConfig();
    const token = options.token || config.token;
    const projectId = options.projectId || config.projectId;
    let episodeId = options.episodeId || config.episodeId;

    if (!token) {
      console.error('❌ Error: No authentication token found. Run "cl auth <token>" first.');
      process.exit(1);
    }
    if (!projectId) {
      console.error('❌ Error: Missing Project ID. Run "cl init <project-id>" or use --project-id.');
      process.exit(1);
    }

    // Phase 3: Auto-create an episode if none is configured
    if (!episodeId) {
      console.log('ℹ️  No active episode found. Auto-creating one...');
      const now = new Date();
      const label = `CLI Session ${now.toISOString().slice(0, 10)}`;
      try {
        // Determine branch name from git (best-effort)
        let branchName = 'main';
        try {
          branchName = require('child_process').execSync('git rev-parse --abbrev-ref HEAD', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim() || 'main';
        } catch { /* no git, use default */ }

        const created = await apiRequest('/episodes/create', 'POST', {
          projectId,
          label,
          branchName,
        }, token, config.apiBaseUrl);

        episodeId = created.episodeId;
        saveConfig({ episodeId }, false);
        console.log(`✅ Episode created: "${label}" (ID: ${episodeId})`);
      } catch (err) {
        console.error(`❌ Failed to auto-create episode: ${err.message}`);
        console.log('   Use --episode-id to specify an existing episode.');
        process.exit(1);
      }
    }

    try {
      console.log(`📡 Logging ${options.source} to episode ${episodeId}...`);
      const result = await apiRequest('/calls/log', 'POST', {
        projectId,
        episodeId,
        promptText: options.prompt,
        modelResponse: options.response || '',
        source: options.source,
        modelName: options.model,
        intentTag: options.intent
      }, token, config.apiBaseUrl);

      console.log('✅ Call logged successfully!');
      console.log(`   ID: ${result.callId}`);
    } catch (err) {
      console.error(`❌ Error logging call: ${err.message}`);
      process.exit(1);
    }
  });

// Command: logs
program
  .command('logs')
  .description('View ContextLens logs and recent activity')
  .option('--lines <number>', 'Number of lines to show (default: 10)', '10')
  .option('--project <id>', 'Specific project ID')
  .action(async (options) => {
    const config = loadConfig();
    const token = config.token;
    const projectId = options.project || config.projectId;

    if (!token || !projectId) {
      console.error('❌ Error: Authentication and Project ID required to view logs.');
      return;
    }

    console.log(`📜 Recent Activity for Project: ${projectId}`);
    console.log('=============================================');

    try {
      const results = await apiRequest('/search', 'POST', { projectId, q: '' }, token, config.apiBaseUrl);
      
      // Sort calls by creation date descending
      const calls = (results.calls || []).sort((a, b) => {
        return new Date(b.createdAt?._seconds * 1000 || b.createdAt) - new Date(a.createdAt?._seconds * 1000 || a.createdAt);
      });

      const limit = parseInt(options.lines);
      const recent = calls.slice(0, limit);

      if (recent.length === 0) {
        console.log('   No activity found for this project.');
      } else {
        recent.forEach((call, i) => {
          const date = new Date(call.createdAt?._seconds * 1000 || call.createdAt).toLocaleString();
          console.log(`[${date}] ${call.source.toUpperCase()}`);
          console.log(`   Prompt: ${call.promptText.substring(0, 80)}${call.promptText.length > 80 ? '...' : ''}`);
          if (call.modelName) console.log(`   Model:  ${call.modelName}`);
          console.log('');
        });
      }
    } catch (err) {
      console.error(`❌ Error fetching logs: ${err.message}`);
    }
  });

// Command: sync
program
  .command('sync')
  .description('Verify connectivity and sync project status')
  .option('--dry-run', 'Check connectivity without syncing')
  .action(async (options) => {
    const config = loadConfig();
    console.log('🔄 ContextLens Sync');
    console.log('==================');
    
    if (!config.token) {
      console.error('❌ Error: No authentication token found.');
      return;
    }

    // Validate token format before making requests
    if (config.token.length < 20) {
      console.error('❌ Error: Token appears malformed (too short). Run "cl auth <token>" to set a valid token.');
      return;
    }

    if (options.dryRun) {
      console.log('🔍 Dry Run — would sync with:');
      console.log(`   API: ${config.apiBaseUrl}`);
      console.log(`   Project: ${config.projectId || '(none)'}`);
      console.log(`   Token: ****${config.token.slice(-5)}`);
      return;
    }

    try {
      process.stdout.write('📡 Verifying connection to ContextLens API... ');
      // Simple status check via search
      await apiRequest('/search', 'POST', { projectId: 'test', q: 'test' }, config.token, config.apiBaseUrl).catch(e => {
        // We expect a 404 or something if project doesn't exist, but if it reaches here, connection is good
        if (e.message.includes('status 401') || e.message.includes('status 403')) throw e;
      });
      process.stdout.write('Connected.\n');
      
      if (config.projectId) {
        console.log(`✅ Project ${config.projectId} is linked.`);
      } else {
        console.log('⚠️  No Project ID configured. Run "cl init" to link a project.');
      }
      
      console.log('✅ Local configuration is up to date.');
    } catch (err) {
      process.stdout.write('Failed.\n');
      if (err.message.includes('401') || err.message.includes('403')) {
        console.error('❌ Authentication failed. Your token may be expired. Run "cl auth <new-token>".');
      } else if (err.message.includes('ECONNREFUSED') || err.message.includes('ENOTFOUND')) {
        console.error('❌ Network error. Check your internet connection.');
      } else {
        console.error(`❌ Sync failed: ${err.message}`);
      }
    }
  });

// Command: git-hook
program
  .command('git-hook')
  .description('Helper for git hooks (e.g., post-commit)')
  .argument('<hook>', 'Hook name (e.g., post-commit)')
  .option('--project-id <id>', 'Project ID')
  .option('--episode-id <id>', 'Episode ID')
  .option('--token <token>', 'Firebase ID token')
  .action(async (hook, options) => {
    if (hook !== 'post-commit') {
      console.log(`ℹ️  Hook "${hook}" not currently automated by ContextLens.`);
      return;
    }

    const config = loadConfig();
    const token = options.token || config.token;
    const projectId = options.projectId || config.projectId;
    const episodeId = options.episodeId || config.episodeId;

    if (!token || !projectId || !episodeId) {
      console.log('ℹ️  ContextLens git hook skipped: missing token, projectId, or episodeId.');
      return;
    }

    try {
      // Get the last commit message and diff
      const commitMsg = execSync('git log -1 --pretty=%B').toString().trim();
      const diff = execSync('git show --pretty=""').toString();
      
      console.log('📡 Auto-logging commit to ContextLens...');
      await apiRequest('/calls/log', 'POST', {
        projectId,
        episodeId,
        promptText: `Git Commit: ${commitMsg}`,
        modelResponse: diff,
        source: 'git_commit'
      }, token, config.apiBaseUrl);
      
      console.log('✅ Commit logged to ContextLens.');
    } catch (err) {
      console.error(`⚠️  ContextLens hook failed: ${err.message}`);
    }
  });

// Parse arguments
program.parse(process.argv);

// Show help if no arguments provided
if (program.args.length === 0) {
  program.outputHelp();
}