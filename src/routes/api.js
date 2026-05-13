const express = require('express');
const router = express.Router();
const { db } = require('../firebase');
const { randomUUID } = require('crypto');
const { callGemini } = require('../services/ai');
const { explainDiffTemplate, branchSummaryTemplate } = require('../prompts');
const { typedError, mapError } = require('../lib/errors');
const { redactText, redactDeep } = require('../lib/redaction');

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
router.post('/projects/create', async (req, res) => {
  const { uid } = req.user;
  const { name, repoUrl, localWorkspaceName, defaultBranch, settings } = req.body;
  if (!name) return res.status(400).json(typedError('invalid', 'Missing project name'));
  try {
    const id = randomUUID();
    const ref = db.collection('users').doc(uid).collection('projects').doc(id);
    const now = new Date();
    await ref.set({ name, repoUrl: repoUrl || null, localWorkspaceName: localWorkspaceName || null, defaultBranch: defaultBranch || 'main', createdAt: now, updatedAt: now, settings: settings || {} });
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
router.post('/episodes/create', async (req, res) => {
  const { uid } = req.user;
  const { projectId, label, branchName } = req.body;
  if (!projectId || !branchName) return res.status(400).json(typedError('invalid', 'Missing projectId or branchName'));
  try {
    const episodeId = randomUUID();
    const now = new Date();
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await epRef.set({ label: label || null, branchName, status: 'open', startedAt: now, endedAt: null, callCount: 0, changedFiles: [], latestDiffHash: null, manualNotes: null });
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
router.post('/calls/log', async (req, res) => {
  const { uid } = req.user;
  const payload = req.body;
  const { projectId, episodeId, promptText, modelName } = payload;
  if (!projectId || !episodeId || !promptText) return res.status(400).json(typedError('invalid', 'Missing required fields'));
  const started = Date.now();
  try {
    const aiResp = await callGemini(promptText, modelName || 'gemini');
    const latencyMs = Date.now() - started;
    const callId = randomUUID();
    const callRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId).collection('calls').doc(callId);
    const callDoc = {
      createdAt: new Date(),
      source: payload.source || 'extension',
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
      latencyMs,
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

    return res.json({ callId, modelName: aiResp.model, modelResponse: aiResp.text, latencyMs, saved: true });
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
router.post('/episodes/explain', async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId, diffHash, changedFiles } = req.body;
  if (!projectId || !episodeId) return res.status(400).json(typedError('invalid', 'Missing projectId or episodeId'));
  if (!diffHash) return res.status(400).json(typedError('invalid', 'Missing diffHash'));
  try {
    const cacheRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId).collection('cache').doc(diffHash);
    const cached = await cacheRef.get();
    if (cached.exists) return res.json({ fromCache: true, ...cached.data().result });

    const changedFilesList = (changedFiles || []).join(', ');
    const prompt = explainDiffTemplate({ changedFilesList });
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 768 });
    const result = structuredOrFallback(aiResp, (text) => ({ summary: text, risks: [], checks: [] }));
    const normalized = {
      summary: result.summary || aiResp.text,
      risks: Array.isArray(result.risks) ? result.risks : [],
      checks: Array.isArray(result.checks) ? result.checks : [],
    };
    await cacheRef.set({ createdAt: new Date(), result: normalized });
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
router.post('/branches/summarize', async (req, res) => {
  const { uid } = req.user;
  const { projectId, branchName, episodes } = req.body;
  if (!projectId || !branchName) return res.status(400).json(typedError('invalid', 'Missing projectId or branchName'));
  try {
    const episodesSummaryList = (episodes || []).map((e) => e.episodeSummary || e.label || '').join('\n');
    const prompt = branchSummaryTemplate({ episodesSummaryList });
    const aiResp = await callGemini(prompt, 'gemini-1.5-pro', { responseMimeType: 'application/json', maxOutputTokens: 1024 });
    const result = structuredOrFallback(aiResp, (text) => ({ pr_summary: text, key_changes: [], review_risks: [] }));
    return res.json({
      pr_summary: result.pr_summary || aiResp.text,
      key_changes: Array.isArray(result.key_changes) ? result.key_changes : [],
      review_risks: Array.isArray(result.review_risks) ? result.review_risks : [],
    });
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
router.post('/search', async (req, res) => {
  const { uid } = req.user;
  const { projectId, q, filters } = req.body;
  if (!projectId) return res.status(400).json(typedError('invalid', 'Missing projectId'));
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
router.post('/episodes/close', async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;
  if (!projectId || !episodeId) return res.status(400).json(typedError('invalid', 'Missing projectId or episodeId'));
  try {
    const epRef = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes').doc(episodeId);
    await epRef.update({ status: 'closed', endedAt: new Date() });
    return res.json({ closed: true });
  } catch (err) {
    const mapped = mapError(err);
    return res.status(mapped.status).json(typedError('close_failed', mapped.message));
  }
});

module.exports = router;
