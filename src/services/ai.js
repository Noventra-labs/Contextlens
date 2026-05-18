const { VertexAI } = require('@google-cloud/vertexai');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { randomUUID } = require('crypto');
const { redactText } = require('../lib/redaction');

const project = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.VERTEX_LOCATION || 'us-central1';
const useVertex = (process.env.USE_VERTEX || 'true').toLowerCase() === 'true';
const modelCache = new Map();

/**
 * Retrieves or initializes a Vertex AI generative model instance.
 * 
 * @param {string} [modelName] - The name of the model (e.g., 'gemini-1.5-pro').
 * @returns {import('@google-cloud/vertexai').GenerativeModel|null} The model instance or null if Vertex AI is disabled.
 * @throws {Error} If GCP_PROJECT is missing when Vertex AI is enabled.
 */
function getVertexModel(modelName) {
  if (!useVertex) return null;
  if (!project) throw new Error('GCP_PROJECT is required for Vertex AI');
  const resolvedModel = modelName || process.env.VERTEX_MODEL || 'gemini-1.5-pro';
  const cacheKey = `${project}:${location}:${resolvedModel}`;
  if (modelCache.has(cacheKey)) return modelCache.get(cacheKey);
  const vertex = new VertexAI({ project, location });
  const model = vertex.getGenerativeModel({ model: resolvedModel });
  modelCache.set(cacheKey, model);
  return model;
}

/**
 * Safely parses JSON from a string, with a fallback to regex if parsing fails.
 * 
 * @param {string} text - The text to parse.
 * @returns {Object|null} The parsed JSON or null if invalid.
 */
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try { return JSON.parse(match[0]); } catch { return null; }
  }
}

/**
 * Creates a promise that rejects after a specified timeout.
 * 
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Object} An object containing the promise and the timer ID.
 */
function createTimeoutPromise(timeoutMs) {
  let timer;
  const promise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('model_timeout')), timeoutMs);
  });
  return { promise, timer };
}

/**
 * Executes a Generative AI content generation with retries for transient errors.
 * Works with both Vertex AI and Google Generative AI models.
 * 
 * @param {Object} model - The model instance.
 * @param {Array} contents - The prompt contents.
 * @param {Object} generationConfig - Configuration for generation.
 * @returns {Promise<Object>} The model response.
 * @throws {Error} If all attempts fail.
 */
async function generateWithRetry(model, contents, generationConfig) {
  const maxAttempts = Number(process.env.VERTEX_RETRY_ATTEMPTS || 2);
  let lastError;
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await model.generateContent({
        contents,
        generationConfig,
      });
      return response;
    } catch (error) {
      lastError = error;
      const retriable = /timeout|429|503|unavailable|resource exhausted/i.test(error && error.message ? error.message : '');
      if (!retriable || attempt === maxAttempts) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

/**
 * Calls the AI model with a standardized interface.
 * Supports custom API keys and providers via options.customApiKey and options.provider.
 * 
 * @param {string} prompt - The user prompt.
 * @param {string} [modelName] - The model to use.
 * @param {Object} [options] - Generation options (temperature, customApiKey, provider, etc.).
 * @returns {Promise<Object>} The result object containing the generated text and metadata.
 */
async function callGemini(prompt, modelName, options = {}) {
  const sanitizedPrompt = redactText(prompt);
  const timeoutMs = Number(process.env.VERTEX_TIMEOUT_MS || 30000);
  const provider = options.provider || 'gemini';
  
  if (provider === 'openai') {
    const openai = new OpenAI({ apiKey: options.customApiKey });
    const { promise: timeoutPromise, timer } = createTimeoutPromise(timeoutMs);
    try {
      const response = await Promise.race([
        openai.chat.completions.create({
          model: modelName || 'gpt-4o',
          messages: [{ role: 'user', content: sanitizedPrompt }],
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxOutputTokens ?? 1024,
          response_format: options.responseMimeType === 'application/json' ? { type: "json_object" } : undefined,
        }),
        timeoutPromise,
      ]);
      const text = response.choices[0]?.message?.content || '';
      return {
        id: randomUUID(),
        model: response.model || modelName || 'gpt-4o',
        text,
        structured: safeJsonParse(text),
        tokens: {
          prompt: response.usage?.prompt_tokens,
          completion: response.usage?.completion_tokens,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: options.customApiKey });
    const { promise: timeoutPromise, timer } = createTimeoutPromise(timeoutMs);
    try {
      const response = await Promise.race([
        anthropic.messages.create({
          model: modelName || 'claude-3-5-sonnet-latest',
          max_tokens: options.maxOutputTokens ?? 1024,
          temperature: options.temperature ?? 0.2,
          messages: [{ role: 'user', content: sanitizedPrompt }],
        }),
        timeoutPromise,
      ]);
      const text = response.content.map(c => c.text).join('') || '';
      return {
        id: randomUUID(),
        model: response.model || modelName || 'claude-3-5-sonnet-latest',
        text,
        structured: safeJsonParse(text),
        tokens: {
          prompt: response.usage?.input_tokens,
          completion: response.usage?.output_tokens,
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // fallback to gemini
  let model;
  const resolvedModelName = modelName || 'gemini-1.5-pro';
  if (options.customApiKey) {
    const genAI = new GoogleGenerativeAI(options.customApiKey);
    model = genAI.getGenerativeModel({ model: resolvedModelName });
  } else {
    if (!useVertex) {
      return {
        id: randomUUID(),
        model: resolvedModelName,
        text: `MOCK_RESPONSE: ${sanitizedPrompt.slice(0, 400)}`,
        tokens: { prompt: 10, completion: 50 },
        structured: null,
      };
    }
    model = getVertexModel(resolvedModelName);
  }

  const generationConfig = {
    temperature: options.temperature ?? 0.2,
    maxOutputTokens: options.maxOutputTokens ?? 1024,
    responseMimeType: options.responseMimeType || 'application/json',
  };

  const { promise: timeoutPromise, timer } = createTimeoutPromise(timeoutMs);
  try {
    const response = await Promise.race([
      generateWithRetry(model, [{ role: 'user', parts: [{ text: sanitizedPrompt }] }], generationConfig),
      timeoutPromise,
    ]);

    let rawText = '';
    let usage = null;
    
    if (options.customApiKey) {
      rawText = response.response.text();
      usage = response.response.usageMetadata || null;
    } else {
      const candidate = response.response?.candidates?.[0];
      rawText = candidate?.content?.parts?.map((part) => part.text || '').join('') || '';
      usage = response.response?.usageMetadata || null;
    }
    
    const structured = safeJsonParse(rawText);

    return {
      id: randomUUID(),
      model: resolvedModelName,
      text: rawText,
      structured,
      tokens: usage,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { callGemini };
