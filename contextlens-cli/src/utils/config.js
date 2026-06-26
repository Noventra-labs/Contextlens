const os = require('os');
const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.join(os.homedir(), '.contextlens');
const CREDENTIALS_FILE = path.join(CONFIG_DIR, 'credentials.json');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

// ── Credentials ─────────────────────────────────────────────────────────────

function saveCredentials(creds) {
  ensureConfigDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(creds, null, 2), 'utf-8');
}

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) return null;
  try {
    return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function clearCredentials() {
  if (fs.existsSync(CREDENTIALS_FILE)) {
    fs.unlinkSync(CREDENTIALS_FILE);
  }
}

// ── Config (default project, API base, etc.) ────────────────────────────────

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getApiBase() {
  const config = loadConfig();
  return config.apiBase || 'https://contextlens-backend-001.web.app/api';
}

function getDefaultProject() {
  const config = loadConfig();
  return config.defaultProject || null;
}

function setDefaultProject(projectId) {
  const config = loadConfig();
  config.defaultProject = projectId;
  saveConfig(config);
}

module.exports = {
  CONFIG_DIR,
  CREDENTIALS_FILE,
  CONFIG_FILE,
  saveCredentials,
  loadCredentials,
  clearCredentials,
  loadConfig,
  saveConfig,
  getApiBase,
  getDefaultProject,
  setDefaultProject,
};
