/**
 * MCP Plugin Manager
 *
 * Extensible plugin system for registering tools, prompts, resources, and events.
 * Third-party plugins can extend ContextLens MCP capabilities.
 */

import { ToolRegistry, McpToolDefinition } from '../registry/ToolRegistry';
import { registerResource } from '../resources/index';
import { registerPrompt, McpPrompt } from '../prompts/index';
import { McpResource } from '../resources/workspace';
import { NotificationManager, McpNotificationType } from '../notifications/notificationManager';

export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;
  /** Display name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description: string;
  /** Author */
  author?: string;
}

export interface PluginRegistration {
  manifest: PluginManifest;
  tools?: McpToolDefinition[];
  prompts?: McpPrompt[];
  resources?: McpResource[];
  onActivate?: () => Promise<void>;
  onDeactivate?: () => Promise<void>;
}

interface LoadedPlugin {
  manifest: PluginManifest;
  activatedAt: number;
  toolCount: number;
  promptCount: number;
  resourceCount: number;
}

export class PluginManager {
  private static instance: PluginManager;
  private plugins: Map<string, LoadedPlugin> = new Map();
  private deactivators: Map<string, () => Promise<void>> = new Map();

  private constructor() {}

  static getInstance(): PluginManager {
    if (!PluginManager.instance) {
      PluginManager.instance = new PluginManager();
    }
    return PluginManager.instance;
  }

  /**
   * Register and activate a plugin.
   */
  async registerPlugin(registration: PluginRegistration): Promise<void> {
    const { manifest } = registration;
    const registry = ToolRegistry.getInstance();

    // Register tools
    if (registration.tools) {
      for (const tool of registration.tools) {
        registry.register(tool);
      }
    }

    // Register prompts
    if (registration.prompts) {
      for (const prompt of registration.prompts) {
        registerPrompt(prompt);
      }
    }

    // Register resources
    if (registration.resources) {
      for (const resource of registration.resources) {
        registerResource(resource);
      }
    }

    // Run activation hook
    if (registration.onActivate) {
      await registration.onActivate();
    }

    // Store deactivator
    if (registration.onDeactivate) {
      this.deactivators.set(manifest.id, registration.onDeactivate);
    }

    this.plugins.set(manifest.id, {
      manifest,
      activatedAt: Date.now(),
      toolCount: registration.tools?.length || 0,
      promptCount: registration.prompts?.length || 0,
      resourceCount: registration.resources?.length || 0,
    });

    NotificationManager.getInstance().notify(
      McpNotificationType.WORKSPACE_CHANGED,
      { event: 'plugin_registered', pluginId: manifest.id }
    );
  }

  /**
   * Deactivate and unregister a plugin.
   */
  async unregisterPlugin(pluginId: string): Promise<boolean> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;

    const deactivator = this.deactivators.get(pluginId);
    if (deactivator) {
      await deactivator();
      this.deactivators.delete(pluginId);
    }

    this.plugins.delete(pluginId);
    return true;
  }

  /**
   * List registered plugins.
   */
  listPlugins(): LoadedPlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Check if a plugin is registered.
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get plugin count.
   */
  get size(): number {
    return this.plugins.size;
  }
}
