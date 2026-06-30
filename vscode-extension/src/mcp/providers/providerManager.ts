/**
 * MCP AI Provider Abstraction
 *
 * Unified interface for multiple AI providers.
 * Supports Gemini, GPT, Claude, Ollama, DeepSeek, OpenRouter.
 */

export interface AiProviderConfig {
  /** Provider identifier */
  id: string;
  /** Display name */
  name: string;
  /** API base URL */
  baseUrl: string;
  /** API key (optional — some providers use other auth) */
  apiKey?: string;
  /** Default model to use */
  defaultModel: string;
  /** Available models */
  models: string[];
  /** Whether provider is enabled */
  enabled: boolean;
}

export interface AiCompletionRequest {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AiCompletionResponse {
  text: string;
  model: string;
  provider: string;
  tokensUsed?: number;
  latencyMs: number;
}

/**
 * Known provider configurations (templates).
 */
const PROVIDER_TEMPLATES: Record<string, Omit<AiProviderConfig, 'apiKey' | 'enabled'>> = {
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-pro',
    models: ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  openai: {
    id: 'openai',
    name: 'OpenAI GPT',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1', 'o1-mini'],
  },
  claude: {
    id: 'claude',
    name: 'Anthropic Claude',
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-haiku-20240307'],
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434/api',
    defaultModel: 'llama3',
    models: ['llama3', 'codellama', 'mistral', 'phi3'],
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-coder',
    models: ['deepseek-coder', 'deepseek-chat'],
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'auto',
    models: ['auto'],
  },
};

export class ProviderManager {
  private static instance: ProviderManager;
  private providers: Map<string, AiProviderConfig> = new Map();
  private activeProvider: string | null = null;

  private constructor() {}

  static getInstance(): ProviderManager {
    if (!ProviderManager.instance) {
      ProviderManager.instance = new ProviderManager();
    }
    return ProviderManager.instance;
  }

  /**
   * Register a provider from template + API key.
   */
  registerProvider(providerId: string, apiKey?: string, enabled: boolean = true): AiProviderConfig | null {
    const template = PROVIDER_TEMPLATES[providerId];
    if (!template) return null;

    const config: AiProviderConfig = {
      ...template,
      apiKey,
      enabled,
    };

    this.providers.set(providerId, config);

    if (!this.activeProvider && enabled) {
      this.activeProvider = providerId;
    }

    return config;
  }

  /**
   * Register a custom provider.
   */
  registerCustomProvider(config: AiProviderConfig): void {
    this.providers.set(config.id, config);
  }

  /**
   * Set the active provider.
   */
  setActiveProvider(providerId: string): boolean {
    const provider = this.providers.get(providerId);
    if (!provider || !provider.enabled) return false;
    this.activeProvider = providerId;
    return true;
  }

  /**
   * Get active provider config.
   */
  getActiveProvider(): AiProviderConfig | null {
    if (!this.activeProvider) return null;
    return this.providers.get(this.activeProvider) || null;
  }

  /**
   * List all registered providers.
   */
  listProviders(): AiProviderConfig[] {
    return Array.from(this.providers.values()).map(p => ({
      ...p,
      apiKey: p.apiKey ? '***' : undefined, // Never expose keys
    }));
  }

  /**
   * Get available provider template IDs.
   */
  getAvailableTemplates(): string[] {
    return Object.keys(PROVIDER_TEMPLATES);
  }

  /**
   * Get provider count.
   */
  get size(): number {
    return this.providers.size;
  }
}
