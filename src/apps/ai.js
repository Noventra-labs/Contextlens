const { createBaseApp, registerErrorHandler } = require('../lib/baseApp');
const { db, admin } = require('../firebase');
const { randomUUID } = require('crypto');
const { callGemini } = require('../services/ai');
const { explainDiffTemplate, branchSummaryTemplate } = require('../prompts');
const { ErrorCodes, typedError } = require('../lib/errors');
const { redactText, redactDeep } = require('../lib/redaction');
const { auditLog } = require('../middleware/auditLog');
const { aiLimiter } = require('../middleware/rateLimiter');
const { requireAuth } = require('../middleware/auth');
const {
  logCallRules,
  explainRules,
  summarizeRules,
} = require('../middleware/validate');
const {
  verifyProjectOwnership,
  verifyEpisodeOwnership,
  checkIdempotency,
  storeIdempotency,
  getProviderConfig,
  structuredOrFallback,
  sendError,
} = require('../lib/apiHelpers');

const app = createBaseApp();

// AI routes require authentication
app.use(requireAuth);
app.use(aiLimiter);

/**
 * POST /calls/log
 * Logs a specific AI call or context snapshot within an episode.
 * Supports idempotency via X-Idempotency-Key header.
 */
app.post('/calls/log', logCallRules, async (req, res) => {
  const { uid } = req.user;
  const payload = req.body; 
  const { projectId, episodeId, promptText, modelName, source, modelResponse } = payload;
  const idempotencyKey = req.headers['x-idempotency-key'] || null;
  
  if (await checkIdempotency(uid, idempotencyKey, req, res)) return;

  const skipAI = (source === 'git_commit' || source === 'manual_log');
  const started = Date.now();
  
  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    let aiResp;
    if (skipAI) {
      aiResp = {
        text: modelResponse || '',
        model: modelName || (source === 'git_commit' ? 'git' : 'external'),
        tokens: null
      };
    } else {
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
 */
app.post('/episodes/explain', explainRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId, diffHash, changedFiles, customApiKey, diffText } = req.body;
  
  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

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
 */
app.post('/branches/summarize', summarizeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, branchName, episodes, customApiKey } = req.body;
  
  try {
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

registerErrorHandler(app);

module.exports = app;
