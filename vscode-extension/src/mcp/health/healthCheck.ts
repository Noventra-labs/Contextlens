/**
 * MCP Health Check
 *
 * Verifies all components of the MCP pipeline are functional.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

export interface HealthCheckResult {
  component: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, any>;
}

export interface HealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  checks: HealthCheckResult[];
}

const MCP_PORT = 3012;

/**
 * Run all health checks and return a consolidated report.
 */
export async function runHealthCheck(): Promise<HealthReport> {
  const checks: HealthCheckResult[] = [];

  // 1. Node version check
  checks.push(checkNodeVersion());

  // 2. Server port check
  checks.push(await checkServerPort());

  // 3. Bridge file check
  checks.push(checkBridgeFile());

  // 4. Secret file check
  checks.push(checkSecretFile());

  // 5. Extension status check
  checks.push(await checkExtensionStatus());

  // Determine overall health
  const hasError = checks.some(c => c.status === 'error');
  const hasWarning = checks.some(c => c.status === 'warning');

  return {
    overall: hasError ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
    timestamp: Date.now(),
    checks,
  };
}

function checkNodeVersion(): HealthCheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);

  if (major >= 18) {
    return { component: 'Node.js', status: 'ok', message: `Node ${version}` };
  } else if (major >= 16) {
    return { component: 'Node.js', status: 'warning', message: `Node ${version} — recommend v18+` };
  }
  return { component: 'Node.js', status: 'error', message: `Node ${version} — require v16+` };
}

function checkServerPort(): Promise<HealthCheckResult> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: MCP_PORT,
      path: '/status',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      resolve({
        component: 'MCP Server',
        status: 'ok',
        message: `Server responding on port ${MCP_PORT}`,
        details: { port: MCP_PORT, statusCode: res.statusCode },
      });
    });

    req.on('error', () => {
      resolve({
        component: 'MCP Server',
        status: 'error',
        message: `Server not responding on port ${MCP_PORT}`,
        details: { port: MCP_PORT },
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        component: 'MCP Server',
        status: 'error',
        message: `Server timeout on port ${MCP_PORT}`,
      });
    });

    req.end();
  });
}

function checkBridgeFile(): HealthCheckResult {
  // Check common bridge locations
  const locations = [
    path.join(__dirname, '..', 'mcp-bridge.js'),
    path.join(__dirname, '..', '..', 'mcp-bridge.js'),
  ];

  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return {
        component: 'MCP Bridge',
        status: 'ok',
        message: `Bridge found at ${loc}`,
      };
    }
  }

  return {
    component: 'MCP Bridge',
    status: 'warning',
    message: 'Bridge file not found in expected locations',
  };
}

function checkSecretFile(): HealthCheckResult {
  const secretPath = path.join(__dirname, '..', '.mcp-secret.json');

  if (!fs.existsSync(secretPath)) {
    return {
      component: 'MCP Secret',
      status: 'warning',
      message: 'Secret file not found — server may not be running',
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
    if (data.secret && data.secret.length >= 32) {
      return {
        component: 'MCP Secret',
        status: 'ok',
        message: 'Secret file valid',
      };
    }
    return {
      component: 'MCP Secret',
      status: 'error',
      message: 'Secret file exists but contains invalid data',
    };
  } catch {
    return {
      component: 'MCP Secret',
      status: 'error',
      message: 'Secret file exists but is not valid JSON',
    };
  }
}

function checkExtensionStatus(): Promise<HealthCheckResult> {
  return new Promise((resolve) => {
    // Try to connect without auth — we just want to know if server is up
    const req = http.request({
      hostname: '127.0.0.1',
      port: MCP_PORT,
      path: '/status',
      method: 'GET',
      timeout: 2000,
    }, (res) => {
      // Even a 401 means the server is running
      if (res.statusCode === 401 || res.statusCode === 200) {
        resolve({
          component: 'Extension',
          status: 'ok',
          message: 'ContextLens extension is active',
        });
      } else {
        resolve({
          component: 'Extension',
          status: 'warning',
          message: `Extension responded with status ${res.statusCode}`,
        });
      }
    });

    req.on('error', () => {
      resolve({
        component: 'Extension',
        status: 'error',
        message: 'ContextLens extension is not running or not reachable',
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        component: 'Extension',
        status: 'error',
        message: 'Extension connection timed out',
      });
    });

    req.end();
  });
}
