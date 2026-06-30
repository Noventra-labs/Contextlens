/**
 * Unit tests for MCP ToolRegistry
 */

import { ToolRegistry, McpToolDefinition, ToolContext } from '../../src/mcp/registry/ToolRegistry';
import { McpPermission, validatePermissions } from '../../src/mcp/permissions';
import { McpFeatureFlag, isFeatureEnabled, setFeatureFlag, resetFeatureFlags } from '../../src/mcp/featureFlags';

// Note: These tests are designed to run with mocha.
// In a real test run, the vscode module must be mocked since ToolRegistry
// imports tool modules that depend on vscode APIs.

describe('validatePermissions', () => {
  it('should allow when all permissions granted', () => {
    const result = validatePermissions(
      [McpPermission.READ],
      [McpPermission.READ, McpPermission.WRITE]
    );
    if (!result.allowed) throw new Error('Expected allowed');
    if (result.missing.length !== 0) throw new Error('Expected no missing');
  });

  it('should deny when permission missing', () => {
    const result = validatePermissions(
      [McpPermission.ADMIN],
      [McpPermission.READ]
    );
    if (result.allowed) throw new Error('Expected denied');
    if (result.missing[0] !== McpPermission.ADMIN) throw new Error('Expected ADMIN missing');
  });
});

describe('McpFeatureFlag', () => {
  afterEach(() => resetFeatureFlags());

  it('MCP_ENABLED should be true by default', () => {
    if (!isFeatureEnabled(McpFeatureFlag.MCP_ENABLED)) {
      throw new Error('Expected MCP_ENABLED to be true');
    }
  });

  it('MCP_EXPERIMENTAL should be false by default', () => {
    if (isFeatureEnabled(McpFeatureFlag.MCP_EXPERIMENTAL)) {
      throw new Error('Expected MCP_EXPERIMENTAL to be false');
    }
  });

  it('should support runtime override', () => {
    setFeatureFlag(McpFeatureFlag.MCP_EXPERIMENTAL, true);
    if (!isFeatureEnabled(McpFeatureFlag.MCP_EXPERIMENTAL)) {
      throw new Error('Expected MCP_EXPERIMENTAL to be true after override');
    }
  });

  it('should reset overrides', () => {
    setFeatureFlag(McpFeatureFlag.MCP_EXPERIMENTAL, true);
    resetFeatureFlags();
    if (isFeatureEnabled(McpFeatureFlag.MCP_EXPERIMENTAL)) {
      throw new Error('Expected MCP_EXPERIMENTAL to be false after reset');
    }
  });
});
