const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { randomUUID } = require('crypto');
const { callGemini } = require('../services/ai');
const { explainDiffTemplate, branchSummaryTemplate } = require('../prompts');
const { typedError, mapError } = require('../lib/errors');
const { redactText, redactDeep } = require('../lib/redaction');
const { encrypt, decrypt } = require('../lib/crypto');
const { auditLog } = require('../middleware/auditLog');
const { aiLimiter } = require('../middleware/rateLimiter');
const {
  createProjectRules,
  createEpisodeRules,
  logCallRules,
  explainRules,
  summarizeRules,
  searchRules,
  closeEpisodeRules,
} = require('../middleware/validate');

/**
 * Helper to get provider and API key from UserSettings
 */
async function getProviderConfig(uid, defaultApiKey) {
  try {
    const settingsDoc = await db.collection('users').doc(uid).collection('settings').doc('global').get();
    if (settingsDoc.exists) {
      const settings = settingsDoc.data();
      const provider = settings.aiProvider || 'none';
      
      let customApiKey = defaultApiKey;
      if (provider === 'gemini' && settings.geminiApiKey) customApiKey = decrypt(settings.geminiApiKey);
      else if (provider === 'openai' && settings.openaiApiKey) customApiKey = decrypt(settings.openaiApiKey);
      else if (provider === 'anthropic' && settings.anthropicApiKey) customApiKey = decrypt(settings.anthropicApiKey);
      
      return { provider: provider === 'none' ? 'gemini' : provider, customApiKey };
    }
  } catch (err) {
    console.warn('Failed to fetch user settings:', err);
  }
  return { provider: 'gemini', customApiKey: defaultApiKey };
}

/**
 * Extracts structured data from an AI response or uses a fallback function if parsing fails.
 * 
 * @param {Object} response - The AI response object.
 * @param {Object} [response.structured] - Already parsed structured data if available.
 * @param {string} response.text - The raw text response from the model.
 * @param {Function} fallback - A function that takes the raw text and returns a default structure.
 * @returns {Object} The parsed or formatted response object.
 */
function structuredOrFallback(response, fallback) {
  if (response.structured && typeof response.structured === 'object') return response.structured;
  try {
    return JSON.parse(response.text);
  } catch {
    return fallback(response.text);
  }
}

/**
 * POST /projects/create
 * Creates a new project for the authenticated user.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.name - The project name.
 * @param {string} [req.body.repoUrl] - The repository URL.
 * @param {express.Response} res - The response object.
 */
router.post('/projects/create', createProjectRules, async (req, res) => {
  const { uid } = req.user;
  const { name, repoUrl, localWorkspaceName, defaultBranch, settings } = req.body;
  
  try {
    const id = randomUUID();
    const ref = db.collection('users').doc(uid).collection('projects').doc(id);
    const now = new Date();
    await ref.set({ name, repoUrl: repoUrl || null, localWorkspaceName: localWorkspaceName || null, defaultBranch: defaultBranch || 'main', createdAt: now, updatedAt: now, settings: settings || {} });
    
    auditLog('DATA_WRITE', { action: 'create_project', projectId: id }, req);
    return res.json({ projectId: id });
  } catch (err) {
    console.error("FULL ERROR:", err);
    return res.status(500).json(typedError('write_failure', err.stack || err.message));
  }
});

/**
 * POST /episodes/create
 * Creates a new coding episode within a project.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.branchName - The name of the current branch.
 * @param {express.Response} res - The response object.
 */
router.post('/episodes/create', createEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, label, branchName } = req.body;
  
  try {
    const episodeId = randomUUID();
    const now = new Date();
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await epRef.set({ label: label || null, branchName, status: 'open', startedAt: now, endedAt: null, callCount: 0, changedFiles: [], latestDiffHash: null, manualNotes: null });
    
    auditLog('DATA_WRITE', { action: 'create_episode', projectId, episodeId }, req);
    return res.json({ episodeId });
  } catch (err) {
    return res.status(500).json(typedError('write_failure', err.message));
  }
});

/**
 * POST /calls/log
 * Logs a specific AI call or context snapshot within an episode.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.episodeId - The episode ID.
 * @param {string} req.body.promptText - The prompt text sent to the model.
 * @param {express.Response} res - The response object.
 */
router.post('/calls/log', aiLimiter, logCallRules, async (req, res) => {
  const { uid } = req.user;
  const payload = req.body;
  const { projectId, episodeId, promptText, modelName, source, modelResponse } = payload;
  
  const skipAI = (source === 'git_commit' || source === 'manual_log');
  const started = Date.now();
  
  try {
    let aiResp;
    if (skipAI) {
      // For git commits or manually logged external calls, we don't call Gemini
      aiResp = {
        text: modelResponse || '',
        model: modelName || (source === 'git_commit' ? 'git' : 'external'),
        tokens: null
      };
    } else {
      // Native AI chat call
      const { provider, customApiKey } = await getProviderConfig(uid, payload.customApiKey);
      if (provider !== 'gemini' && !customApiKey) {
        throw new Error(`missing_api_key_for_${provider}`);
      }
      aiResp = await callGemini(promptText, modelName || 'gemini-1.5-pro', { customApiKey, provider });
    }
    
    const latencyMs = Date.now() - started;
    const callId = randomUUID();
    const callRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId).collection('calls').doc(callId);
    
    const callDoc = {
      createdAt: new Date(),
      source: source || 'extension',
      intentTag: payload.intentTag || null,
      promptText: redactText(promptText),
      modelName: aiResp.model,
      modelResponse: redactText(aiResp.text),
      branchName: payload.branchName || null,
      activeFilePath: payload.activeFilePath || null,
      relatedFiles: redactDeep(payload.relatedFiles || []),
      diffSnapshot: redactDeep(payload.diffSnapshot || null),
      diffHash: payload.diffHash || null,
      todoMatches: redactDeep(payload.todoMatches || []),
      latencyMs: skipAI ? 0 : latencyMs,
      tokenUsage: aiResp.tokens || null,
      status: 'success'
    };
    
    await callRef.set(callDoc);

    // increment episode callCount (retry-safe transaction)
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await db.runTransaction(async (t) => {
      const snap = await t.get(epRef);
      if (!snap.exists) throw new Error('episode_not_found');
      const prev = snap.data().callCount || 0;
      t.update(epRef, { callCount: prev + 1 });
    });

    auditLog('DATA_WRITE', { action: 'log_call', projectId, episodeId, callId }, req);
    return res.json({ callId, modelName: aiResp.model, modelResponse: aiResp.text, latencyMs: skipAI ? 0 : latencyMs, saved: true });
  } catch (err) {
    const mapped = mapError(err);
    const code = err.message === 'episode_not_found' ? 'invalid_episode' : mapped.code;
    return res.status(mapped.status).json(typedError(code, mapped.message));
  }
});

/**
 * POST /episodes/explain
 * Generates an AI explanation of the diff accumulated in an episode.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.episodeId - The episode ID.
 * @param {string} req.body.diffHash - The hash of the diff to explain.
 * @param {express.Response} res - The response object.
 */
router.post('/episodes/explain', aiLimiter, explainRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId, diffHash, changedFiles, customApiKey } = req.body;
  
  try {
    const cacheRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId).collection('cache').doc(diffHash);
    const cached = await cacheRef.get();
    if (cached.exists) return res.json({ fromCache: true, ...cached.data().result });

    const changedFilesList = (changedFiles || []).join(', ');
    const prompt = explainDiffTemplate({ changedFilesList });
    const { provider, customApiKey: finalApiKey } = await getProviderConfig(uid, customApiKey);
    if (provider !== 'gemini' && !finalApiKey) {
      throw new Error(`missing_api_key_for_${provider}`);
    }
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 768, customApiKey: finalApiKey, provider });
    const result = structuredOrFallback(aiResp, (text) => ({ summary: text, risks: [], checks: [] }));
    const normalized = {
      summary: result.summary || aiResp.text,
      risks: Array.isArray(result.risks) ? result.risks : [],
      checks: Array.isArray(result.checks) ? result.checks : [],
    };
    await cacheRef.set({ createdAt: new Date(), result: normalized });
    
    auditLog('DATA_ACCESS', { action: 'explain_episode', projectId, episodeId, diffHash }, req);
    return res.json(normalized);
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json(typedError('explain_failed', mapped.message));
  }
});

/**
 * POST /branches/summarize
 * Summarizes the activity across multiple episodes on a branch.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.branchName - The name of the branch.
 * @param {Array} req.body.episodes - The list of episodes to summarize.
 * @param {express.Response} res - The response object.
 */
router.post('/branches/summarize', aiLimiter, summarizeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, branchName, episodes, customApiKey } = req.body;
  
  try {
    const episodesSummaryList = (episodes || []).map((e) => e.episodeSummary || e.label || '').join('\n');
    const prompt = branchSummaryTemplate({ episodesSummaryList });
    const { provider, customApiKey: finalApiKey } = await getProviderConfig(uid, customApiKey);
    if (provider !== 'gemini' && !finalApiKey) {
      throw new Error(`missing_api_key_for_${provider}`);
    }
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 1024, customApiKey: finalApiKey, provider });
    const result = structuredOrFallback(aiResp, (text) => ({ pr_summary: text, key_changes: [], review_risks: [] }));
    const responseData = {
      pr_summary: result.pr_summary || aiResp.text,
      key_changes: Array.isArray(result.key_changes) ? result.key_changes : [],
      review_risks: Array.isArray(result.review_risks) ? result.review_risks : [],
    };
    
    auditLog('DATA_ACCESS', { action: 'summarize_branch', projectId, branchName }, req);
    return res.json(responseData);
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json(typedError('summarize_failed', mapped.message));
  }
});

/**
 * POST /search
 * Performs a search across episodes and AI calls for a given project.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.q - The search query.
 * @param {express.Response} res - The response object.
 */
router.post('/search', searchRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, q, filters } = req.body;
  
  try {
    // Naive search: look through episodes and calls for matching text in labels, prompts, responses.
    const episodesCol = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes');
    const episodesSnap = await episodesCol.get();
    const results = { episodes: [], calls: [] };
    for (const ep of episodesSnap.docs) {
      const data = ep.data();
      if (!q || JSON.stringify(data).toLowerCase().includes(q.toLowerCase())) results.episodes.push({ id: ep.id, ...data });
      const callsSnap = await ep.ref.collection('calls').get();
      for (const c of callsSnap.docs) {
        const cd = c.data();
        if (!q || JSON.stringify(cd).toLowerCase().includes(q.toLowerCase())) results.calls.push({ id: c.id, episodeId: ep.id, ...cd });
      }
    }
    
    auditLog('DATA_ACCESS', { action: 'search', projectId, queryLength: q ? q.length : 0 }, req);
    return res.json(results);
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json(typedError('search_failed', mapped.message));
  }
});

/**
 * POST /episodes/close
 * Marks a coding episode as closed.
 * 
 * @param {express.Request} req - The request object.
 * @param {string} req.body.projectId - The project ID.
 * @param {string} req.body.episodeId - The episode ID.
 * @param {express.Response} res - The response object.
 */
router.post('/episodes/close', closeEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;
  
  try {
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await epRef.update({ status: 'closed', endedAt: new Date() });
    
    auditLog('DATA_WRITE', { action: 'close_episode', projectId, episodeId }, req);
    return res.json({ closed: true });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json(typedError('close_failed', mapped.message));
  }
});

/**
 * POST /settings/get
 * Retrieves the user's global AI provider settings.
 * Returns provider, hasKey flags (never the raw keys), and provider metadata.
 */
router.post('/settings/get', async (req, res) => {
  const { uid } = req.user;
  try {
    const settingsDoc = await db.collection('users').doc(uid).collection('settings').doc('global').get();
    if (!settingsDoc.exists) {
      return res.json({
        aiProvider: 'none',
        hasGeminiKey: false,
        hasOpenaiKey: false,
        hasAnthropicKey: false,
      });
    }
    const data = settingsDoc.data();
    return res.json({
      aiProvider: data.aiProvider || 'none',
      hasGeminiKey: !!data.geminiApiKey,
      hasOpenaiKey: !!data.openaiApiKey,
      hasAnthropicKey: !!data.anthropicApiKey,
    });
  } catch (err) {
    return res.status(500).json(typedError('settings_read_failed', err.message));
  }
});

/**
 * POST /settings/update
 * Updates the user's global AI provider settings.
 * Accepts provider selection and optional API keys.
 */
router.post('/settings/update', async (req, res) => {
  const { uid } = req.user;
  const { aiProvider, geminiApiKey, openaiApiKey, anthropicApiKey } = req.body;

  const allowedProviders = ['none', 'gemini', 'openai', 'anthropic'];
  if (aiProvider && !allowedProviders.includes(aiProvider)) {
    return res.status(400).json(typedError('invalid_provider', `Provider must be one of: ${allowedProviders.join(', ')}`));
  }

  try {
    const update = {};
    if (aiProvider !== undefined) update.aiProvider = aiProvider;
    if (geminiApiKey !== undefined) update.geminiApiKey = encrypt(geminiApiKey);
    if (openaiApiKey !== undefined) update.openaiApiKey = encrypt(openaiApiKey);
    if (anthropicApiKey !== undefined) update.anthropicApiKey = encrypt(anthropicApiKey);

    await db.collection('users').doc(uid).collection('settings').doc('global').set(update, { merge: true });
    auditLog('SETTINGS_UPDATE', { action: 'update_ai_settings', provider: aiProvider || '(unchanged)' }, req);
    return res.json({ saved: true });
  } catch (err) {
    return res.status(500).json(typedError('settings_write_failed', err.message));
  }
});

module.exports = router;
