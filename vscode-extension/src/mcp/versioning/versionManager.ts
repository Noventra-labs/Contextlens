/**
 * MCP Tool Versioning
 *
 * Version every tool. Support multiple versions simultaneously.
 * Never introduce breaking changes — old versions remain accessible.
 */

import { McpToolDefinition } from '../registry/ToolRegistry';

interface VersionedTool {
  versions: Map<number, McpToolDefinition>;
  latest: number;
  deprecated: Set<number>;
}

export class VersionManager {
  private static instance: VersionManager;
  private tools: Map<string, VersionedTool> = new Map();

  private constructor() {}

  static getInstance(): VersionManager {
    if (!VersionManager.instance) {
      VersionManager.instance = new VersionManager();
    }
    return VersionManager.instance;
  }

  /**
   * Register a versioned tool. Version extracted from tool.version (major only).
   */
  registerVersion(tool: McpToolDefinition): void {
    const majorVersion = this.parseMajor(tool.version);
    const baseName = tool.name.replace(/@\d+$/, '');

    let versioned = this.tools.get(baseName);
    if (!versioned) {
      versioned = { versions: new Map(), latest: 0, deprecated: new Set() };
      this.tools.set(baseName, versioned);
    }

    versioned.versions.set(majorVersion, tool);
    if (majorVersion > versioned.latest) {
      versioned.latest = majorVersion;
    }
  }

  /**
   * Get a specific version of a tool.
   * If no version specified, returns latest.
   */
  getVersion(toolName: string, version?: number): McpToolDefinition | undefined {
    const baseName = toolName.replace(/@\d+$/, '');
    const versioned = this.tools.get(baseName);
    if (!versioned) return undefined;

    const v = version ?? versioned.latest;
    return versioned.versions.get(v);
  }

  /**
   * Deprecate a tool version.
   */
  deprecate(toolName: string, version: number): boolean {
    const versioned = this.tools.get(toolName);
    if (!versioned || !versioned.versions.has(version)) return false;
    versioned.deprecated.add(version);
    return true;
  }

  /**
   * Check if a version is deprecated.
   */
  isDeprecated(toolName: string, version: number): boolean {
    const versioned = this.tools.get(toolName);
    if (!versioned) return false;
    return versioned.deprecated.has(version);
  }

  /**
   * List all versions of a tool.
   */
  listVersions(toolName: string): Array<{
    version: number;
    deprecated: boolean;
    isLatest: boolean;
  }> {
    const versioned = this.tools.get(toolName);
    if (!versioned) return [];

    return Array.from(versioned.versions.keys()).map(v => ({
      version: v,
      deprecated: versioned.deprecated.has(v),
      isLatest: v === versioned.latest,
    }));
  }

  /**
   * Parse major version from semver string.
   */
  private parseMajor(version: string): number {
    const parts = version.split('.');
    return parseInt(parts[0], 10) || 1;
  }

  /**
   * Get all versioned tool names.
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}
