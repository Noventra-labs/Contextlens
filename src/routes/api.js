const express = require('express');
const router = express.Router();
const { db, admin } = require('../firebase');
const { randomUUID } = require('crypto');
const { callGemini } = require('../services/ai');
const { explainDiffTemplate, branchSummaryTemplate } = require('../prompts');
const { ErrorCodes, typedError, mapError } = require('../lib/errors');
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
  getEpisodeRules,
  getEpisodeBodyRules,
  listEpisodesRules,
  settingsGetRules,
  settingsUpdateRules,
} = require('../middleware/validate');

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Verify that a project belongs to the authenticated user.
 * Returns the project document reference if valid, or sends a 404/403.
 */
async function verifyProjectOwnership(uid, projectId, req, res) {
  const projectRef = db.collection('users').doc(uid).collection('projects').doc(projectId);
  const projectDoc = await projectRef.get();
  if (!projectDoc.exists) {
    res.status(404).json(
      typedError(ErrorCodes.RESOURCE_NOT_FOUND, 'Project not found.', { requestId: req.id })
    );
    return null;
  }
  return projectRef;
}

/**
 * Verify that an episode belongs to the authenticated user's project.
 */
async function verifyEpisodeOwnership(uid, projectId, episodeId, req, res) {
  const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId)
    .collection('episodes').doc(episodeId);
  const epDoc = await epRef.get();
  if (!epDoc.exists) {
    res.status(404).json(
      typedError(ErrorCodes.RESOURCE_NOT_FOUND, 'Episode not found.', { requestId: req.id })
    );
    return null;
  }
  return epRef;
}

/**
 * Check idempotency key — skip if already processed.
 * Returns true if this request is a duplicate.
 */
async function checkIdempotency(uid, idempotencyKey, req, res) {
  if (!idempotencyKey) return false;

  const idemRef = db.collection('users').doc(uid).collection('idempotency').doc(idempotencyKey);
  const idemDoc = await idemRef.get();
  if (idemDoc.exists) {
    const cached = idemDoc.data();
    res.json(cached.response);
    return true;
  }
  return false;
}

/**
 * Store idempotency key with response for dedup.
 */
async function storeIdempotency(uid, idempotencyKey, response) {
  if (!idempotencyKey) return;
  try {
    const idemRef = db.collection('users').doc(uid).collection('idempotency').doc(idempotencyKey);
    await idemRef.set({
      response,
      createdAt: new Date(),
    });
  } catch {
    // Non-critical — don't fail the request
  }
}

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
      
      // Guard: if decrypt failed silently and returned raw ciphertext, treat as missing key
      if (customApiKey && typeof customApiKey === 'string' && customApiKey.startsWith('enc:v1:')) {
        console.error(JSON.stringify({
          severity: 'ERROR',
          event: 'api_key_decrypt_failed',
          uid,
          provider,
          message: 'Stored API key could not be decrypted. User must re-enter key.',
        }));
        customApiKey = null;
      }
      
      return { provider: provider === 'none' ? 'gemini' : provider, customApiKey };
    }
  } catch (err) {
    console.warn(JSON.stringify({
      severity: 'WARNING',
      event: 'settings_fetch_failed',
      uid,
      error: err.message,
    }));
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
 * Send a safe error response. Logs internal details, returns clean message.
 */
function sendError(res, req, err, fallbackCode) {
  const mapped = mapError(err, req.id);

  // Log full internal details privately
  console.error(JSON.stringify({
    severity: 'ERROR',
    event: 'api_error',
    requestId: req.id,
    uid: req.user?.uid,
    route: req.originalUrl,
    errorCode: mapped.code,
    errorMessage: err.message,
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  }));

  return res.status(mapped.status).json(
    typedError(fallbackCode || mapped.code, mapped.message, {
      requestId: req.id,
      retryable: mapped.retryable,
      action: mapped.action,
    })
  );
}

// ── Routes ─────────────────────────────────────────────────────────────────

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
    return res.json({ ok: true, projectId: id });
  } catch (err) {
    return sendError(res, req, err, ErrorCodes.STORAGE_WRITE_FAILED);
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
  const { projectId, label, branchName, episodeId: clientEpisodeId } = req.body;
  
  try {
    // Verify project ownership
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    // Fix 1: Accept client-generated UUID for offline queue consistency.
    // If client provides episodeId, use it. Otherwise generate server-side.
    const episodeId = clientEpisodeId || randomUUID();
    const now = new Date();
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await epRef.set({ label: label || null, branchName, status: 'open', startedAt: now, endedAt: null, callCount: 0, changedFiles: [], latestDiffHash: null, manualNotes: null });
    
    auditLog('DATA_WRITE', { action: 'create_episode', projectId, episodeId }, req);
    return res.json({ ok: true, episodeId });
  } catch (err) {
    return sendError(res, req, err, ErrorCodes.STORAGE_WRITE_FAILED);
  }
});

/**
 * POST /calls/log
 * Logs a specific AI call or context snapshot within an episode.
 * Supports idempotency via X-Idempotency-Key header.
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
  const idempotencyKey = req.headers['x-idempotency-key'] || null;
  
  // Check idempotency — skip if already processed
  if (await checkIdempotency(uid, idempotencyKey, req, res)) return;

  const skipAI = (source === 'git_commit' || source === 'manual_log');
  const started = Date.now();
  
  try {
    // Verify ownership
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

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
        return res.status(400).json(
          typedError(ErrorCodes.CONFIG_ERROR, `No API key configured for ${provider}. Please configure your provider in settings.`, {
            requestId: req.id,
            action: 'none',
          })
        );
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
    
    const batch = db.batch();
    batch.set(callRef, callDoc);
    batch.update(epRef, { callCount: admin.firestore.FieldValue.increment(1) });
    await batch.commit();

    const responseData = { ok: true, callId, modelName: aiResp.model, modelResponse: aiResp.text, latencyMs: skipAI ? 0 : latencyMs, saved: true };

    // Store idempotency record
    await storeIdempotency(uid, idempotencyKey, responseData);

    auditLog('DATA_WRITE', { action: 'log_call', projectId, episodeId, callId }, req);
    return res.json(responseData);
  } catch (err) {
    return sendError(res, req, err);
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
  const { projectId, episodeId, diffHash, changedFiles, customApiKey, diffText } = req.body;
  
  try {
    // Verify ownership
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    // Fetch episode doc to get latest diff information if not provided
    const epDoc = await epRef.get();
    const epData = epDoc.data();
    
    const finalDiffHash = diffHash || epData.latestDiffHash;
    if (!finalDiffHash) {
      return res.status(400).json(
        typedError(ErrorCodes.VALIDATION_ERROR, 'No diff hash provided or found on the episode.', { requestId: req.id })
      );
    }

    const cacheRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId).collection('cache').doc(finalDiffHash);
    const cached = await cacheRef.get();
    if (cached.exists) return res.json({ ok: true, fromCache: true, ...cached.data().result });

    const finalChangedFiles = changedFiles || epData.changedFiles || [];
    const changedFilesList = finalChangedFiles.join(', ');

    // Fix 6: Include actual diff text if provided (already redacted by extension).
    // If not provided, try to fetch latest diff from most recent call.
    let finalDiffText = diffText || '';
    if (!finalDiffText) {
      try {
        const latestCall = await epRef.collection('calls')
          .orderBy('createdAt', 'desc')
          .limit(1)
          .get();
        if (!latestCall.empty) {
          const callData = latestCall.docs[0].data();
          finalDiffText = callData.diffSnapshot || '';
        }
      } catch { /* no diff available, proceed with filenames only */ }
    }
    // Truncate diff to prevent huge prompts (max 8000 chars)
    if (finalDiffText && finalDiffText.length > 8000) {
      finalDiffText = finalDiffText.slice(0, 8000) + '\n... [TRUNCATED]';
    }

    const prompt = explainDiffTemplate({ changedFilesList, diffText: redactText(finalDiffText) });
    const { provider, customApiKey: finalApiKey } = await getProviderConfig(uid, customApiKey);
    if (provider !== 'gemini' && !finalApiKey) {
      return res.status(400).json(
        typedError(ErrorCodes.CONFIG_ERROR, `No API key configured for ${provider}.`, { requestId: req.id })
      );
    }
    // Fix 6: Increased maxOutputTokens from 768 to 2048 to prevent truncated JSON
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 2048, customApiKey: finalApiKey, provider });
    const result = structuredOrFallback(aiResp, (text) => ({ summary: text, risks: [], checks: [] }));
    const normalized = {
      summary: result.summary || aiResp.text,
      risks: Array.isArray(result.risks) ? result.risks : [],
      checks: Array.isArray(result.checks) ? result.checks : [],
    };
    await cacheRef.set({ createdAt: new Date(), result: normalized });
    
    auditLog('DATA_ACCESS', { action: 'explain_episode', projectId, episodeId, diffHash: finalDiffHash }, req);
    return res.json({ ok: true, ...normalized });
  } catch (err) {
    return sendError(res, req, err, ErrorCodes.AI_SERVICE_UNAVAILABLE);
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
    // Verify ownership
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    const episodesSummaryList = (episodes || []).map((e) => e.episodeSummary || e.label || '').join('\n');
    const prompt = branchSummaryTemplate({ episodesSummaryList });
    const { provider, customApiKey: finalApiKey } = await getProviderConfig(uid, customApiKey);
    if (provider !== 'gemini' && !finalApiKey) {
      return res.status(400).json(
        typedError(ErrorCodes.CONFIG_ERROR, `No API key configured for ${provider}.`, { requestId: req.id })
      );
    }
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 1024, customApiKey: finalApiKey, provider });
    const result = structuredOrFallback(aiResp, (text) => ({ pr_summary: text, key_changes: [], review_risks: [] }));
    const responseData = {
      ok: true,
      pr_summary: result.pr_summary || aiResp.text,
      key_changes: Array.isArray(result.key_changes) ? result.key_changes : [],
      review_risks: Array.isArray(result.review_risks) ? result.review_risks : [],
    };
    
    auditLog('DATA_ACCESS', { action: 'summarize_branch', projectId, branchName }, req);
    return res.json(responseData);
  } catch (err) {
    return sendError(res, req, err, ErrorCodes.AI_SERVICE_UNAVAILABLE);
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
    // Verify ownership
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    // Fix 8: Bounded search — limit reads instead of full collection scan.
    // Phase 1: Search episodes (max 50, ordered by most recent)
    const MAX_EPISODES = 50;
    const MAX_CALLS_PER_EP = 10;
    const MAX_TOTAL_RESULTS = 100;

    const episodesCol = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes');
    const episodesSnap = await episodesCol.orderBy('startedAt', 'desc').limit(MAX_EPISODES).get();
    const results = { episodes: [], calls: [] };

    for (const ep of episodesSnap.docs) {
      const data = ep.data();
      const epStr = JSON.stringify(data).toLowerCase();
      const matchesEpisode = !q || epStr.includes(q.toLowerCase());

      if (matchesEpisode) {
        results.episodes.push({ id: ep.id, ...data });
      }

      // Only fetch calls from episodes that match (or if no query)
      if (matchesEpisode && results.calls.length < MAX_TOTAL_RESULTS) {
        const callsSnap = await ep.ref.collection('calls')
          .orderBy('createdAt', 'desc')
          .limit(MAX_CALLS_PER_EP)
          .get();

        for (const c of callsSnap.docs) {
          if (results.calls.length >= MAX_TOTAL_RESULTS) break;
          const cd = c.data();
          if (!q || JSON.stringify(cd).toLowerCase().includes(q.toLowerCase())) {
            results.calls.push({ id: c.id, episodeId: ep.id, ...cd });
          }
        }
      }
    }
    
    auditLog('DATA_ACCESS', { action: 'search', projectId, queryLength: q ? q.length : 0, episodesSearched: episodesSnap.size }, req);
    return res.json({ ok: true, ...results });
  } catch (err) {
    return sendError(res, req, err);
  }
});

/**
 * POST /episodes/get
 * Retrieves detailed information about a specific episode including its calls.
 */
router.post('/episodes/get', getEpisodeBodyRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;

  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    const epDoc = await epRef.get();
    const epData = epDoc.data();

    // Fetch associated calls
    const callsCol = epRef.collection('calls');
    const callsSnap = await callsCol.get();
    const calls = callsSnap.docs.map(c => ({ id: c.id, ...c.data() }));

    auditLog('DATA_ACCESS', { action: 'get_episode', projectId, episodeId }, req);
    return res.json({
      ok: true,
      episode: {
        id: epDoc.id,
        ...epData
      },
      calls
    });
  } catch (err) {
    return sendError(res, req, err);
  }
});

/**
 * POST /episodes/export
 * Exports an episode's data as a formatted Markdown file.
 */
router.post('/episodes/export', getEpisodeBodyRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;

  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    const epDoc = await epRef.get();
    const episode = epDoc.data();

    // Fetch associated calls
    const callsCol = epRef.collection('calls');
    const callsSnap = await callsCol.orderBy('createdAt', 'asc').get();
    const calls = callsSnap.docs.map(c => ({ id: c.id, ...c.data() }));

    const lines = [
      `# Episode: ${episode.label || 'Untitled Episode'}`,
      '',
      `**Branch:** ${episode.branchName || 'main'}`,
      `**Status:** ${episode.status || 'closed'}`,
      `**Started:** ${episode.startedAt ? episode.startedAt.toDate().toISOString() : ''}`,
      episode.endedAt ? `**Ended:** ${episode.endedAt.toDate().toISOString()}` : '**Ended:** Still active',
      `**AI Calls:** ${episode.callCount || 0}`,
      '',
    ];

    if (episode.changedFiles && episode.changedFiles.length > 0) {
      lines.push('## Changed Files', '', ...episode.changedFiles.map(f => `- \`${f}\``), '');
    }

    if (episode.manualNotes) {
      lines.push('## Notes', '', episode.manualNotes, '');
    }

    if (calls.length > 0) {
      lines.push('## AI Calls', '');
      for (const call of calls) {
        lines.push(`### ${call.intentTag || call.source || 'Call'} — ${call.createdAt ? call.createdAt.toDate().toISOString() : ''}`);
        lines.push('');
        if (call.promptText) lines.push('**Prompt:**', '```', call.promptText, '```', '');
        if (call.modelResponse) lines.push('**Response:**', '```', call.modelResponse, '```', '');
        if (call.diffSnapshot) lines.push('**Diff:**', '```diff', call.diffSnapshot, '```', '');
        lines.push(`*Model: ${call.modelName || 'unknown'} · ${call.latencyMs || 0}ms · ${call.tokenUsage?.input || 0} in / ${call.tokenUsage?.output || 0} out*`, '');
        lines.push('---', '');
      }
    }

    auditLog('DATA_ACCESS', { action: 'export_episode', projectId, episodeId }, req);
    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="episode-${episode.label?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || episodeId}.md"`);
    return res.send(lines.join('\n'));
  } catch (err) {
    return sendError(res, req, err);
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
    // Verify ownership
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    await epRef.update({ status: 'closed', endedAt: new Date() });
    
    auditLog('DATA_WRITE', { action: 'close_episode', projectId, episodeId }, req);
    return res.json({ ok: true, closed: true });
  } catch (err) {
    return sendError(res, req, err);
  }
});

/**
 * POST /settings/get
 * Retrieves the user's global AI provider settings.
 * Returns provider, hasKey flags (never the raw keys), and provider metadata.
 */
router.post('/settings/get', settingsGetRules, async (req, res) => {
  const { uid } = req.user;
  try {
    const settingsDoc = await db.collection('users').doc(uid).collection('settings').doc('global').get();
    auditLog('DATA_ACCESS', { action: 'get_settings' }, req);
    if (!settingsDoc.exists) {
      return res.json({
        ok: true,
        aiProvider: 'none',
        hasGeminiKey: false,
        hasOpenaiKey: false,
        hasAnthropicKey: false,
      });
    }
    const data = settingsDoc.data();
    return res.json({
      ok: true,
      aiProvider: data.aiProvider || 'none',
      hasGeminiKey: !!data.geminiApiKey,
      hasOpenaiKey: !!data.openaiApiKey,
      hasAnthropicKey: !!data.anthropicApiKey,
    });
  } catch (err) {
    return sendError(res, req, err);
  }
});

/**
 * POST /settings/update
 * Updates the user's global AI provider settings.
 * Accepts provider selection and optional API keys.
 */
router.post('/settings/update', settingsUpdateRules, async (req, res) => {
  const { uid } = req.user;
  const { aiProvider, geminiApiKey, openaiApiKey, anthropicApiKey } = req.body;

  try {
    const update = {};
    if (aiProvider !== undefined) update.aiProvider = aiProvider;
    if (geminiApiKey !== undefined) update.geminiApiKey = encrypt(geminiApiKey);
    if (openaiApiKey !== undefined) update.openaiApiKey = encrypt(openaiApiKey);
    if (anthropicApiKey !== undefined) update.anthropicApiKey = encrypt(anthropicApiKey);

    await db.collection('users').doc(uid).collection('settings').doc('global').set(update, { merge: true });
    auditLog('SETTINGS_UPDATE', { action: 'update_ai_settings', provider: aiProvider || '(unchanged)' }, req);
    return res.json({ ok: true, saved: true });
  } catch (err) {
    return sendError(res, req, err);
  }
});

// GET /episodes/:episodeId - Get episode details
router.get('/episodes/:episodeId', getEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { episodeId } = req.params;
  const { projectId } = req.query;

  try {
    // Verify project ownership
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    // Verify episode ownership
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    // Get episode data
    const epDoc = await epRef.get();
    const epData = epDoc.data();

    // Get call count and basic stats
    const callsCol = epRef.collection('calls');
    const callsSnap = await callsCol.get();
    const callCount = callsSnap.size;

    // Get recent calls (last 5)
    const recentCalls = [];
    callsSnap.docs.slice(0, 5).forEach(callDoc => {
      const callData = callDoc.data();
      recentCalls.push({
        id: callDoc.id,
        ...callData
      });
    });

    auditLog('DATA_ACCESS', { action: 'get_episode', projectId, episodeId }, req);
    return res.json({
      ok: true,
      episode: {
        id: epDoc.id,
        ...epData,
        callCount,
        recentCalls
      }
    });
  } catch (err) {
    return sendError(res, req, err);
  }
});

// GET /episodes/list - List episodes for a project
router.post('/episodes/list', listEpisodesRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, limit = 10, includeClosed = false } = req.body;

  try {
    // Verify project ownership
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    // Get episodes collection
    const episodesCol = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes');

    // Build query
    let query = episodesCol.orderBy('startedAt', 'desc');
    if (!includeClosed) {
      query = query.where('status', '==', 'open');
    }
    if (limit) {
      query = query.limit(limit);
    }

    // Execute query
    const episodesSnap = await query.get();
    const episodes = [];

    episodesSnap.docs.forEach(epDoc => {
      const epData = epDoc.data();
      episodes.push({
        id: epDoc.id,
        ...epData
      });
    });

    auditLog('DATA_ACCESS', { action: 'list_episodes', projectId, count: episodes.length }, req);
    return res.json({
      ok: true,
      episodes
    });
  } catch (err) {
    return sendError(res, req, err);
  }
});

module.exports = router;
