const { createBaseApp, registerErrorHandler } = require('../lib/baseApp');
const { db } = require('../firebase');
const { randomUUID } = require('crypto');
const { ErrorCodes, typedError } = require('../lib/errors');
const { encrypt } = require('../lib/crypto');
const { auditLog } = require('../middleware/auditLog');
const { requireAuth } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimiter');
const {
  createProjectRules,
  createEpisodeRules,
  searchRules,
  closeEpisodeRules,
  getEpisodeRules,
  getEpisodeBodyRules,
  listEpisodesRules,
  settingsGetRules,
  settingsUpdateRules,
} = require('../middleware/validate');
const {
  verifyProjectOwnership,
  verifyEpisodeOwnership,
  sendError,
} = require('../lib/apiHelpers');

const app = createBaseApp();

// Core routes require authentication
app.use(requireAuth);
app.use(apiLimiter);

/**
 * POST /projects/create
 * Creates a new project for the authenticated user.
 */
app.post('/projects/create', createProjectRules, async (req, res) => {
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
 */
app.post('/episodes/create', createEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, label, branchName, episodeId: clientEpisodeId } = req.body;
  
  try {
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

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
 * POST /search
 * Performs a search across episodes and AI calls for a given project.
 */
app.post('/search', searchRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, q, filters } = req.body;
  
  try {
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

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
app.post('/episodes/get', getEpisodeBodyRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;

  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    const epDoc = await epRef.get();
    const epData = epDoc.data();

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
app.post('/episodes/export', getEpisodeBodyRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;

  try {
    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    const epDoc = await epRef.get();
    const episode = epDoc.data();

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
 */
app.post('/episodes/close', closeEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, episodeId } = req.body;
  
  try {
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
 */
app.post('/settings/get', settingsGetRules, async (req, res) => {
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
 */
app.post('/settings/update', settingsUpdateRules, async (req, res) => {
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
app.get('/episodes/:episodeId', getEpisodeRules, async (req, res) => {
  const { uid } = req.user;
  const { episodeId } = req.params;
  const { projectId } = req.query;

  try {
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    const epRef = await verifyEpisodeOwnership(uid, projectId, episodeId, req, res);
    if (!epRef) return;

    const epDoc = await epRef.get();
    const epData = epDoc.data();

    const callsCol = epRef.collection('calls');
    const callsSnap = await callsCol.get();
    const callCount = callsSnap.size;

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

// POST /episodes/list - List episodes for a project
app.post('/episodes/list', listEpisodesRules, async (req, res) => {
  const { uid } = req.user;
  const { projectId, limit = 10, includeClosed = false } = req.body;

  try {
    const projectRef = await verifyProjectOwnership(uid, projectId, req, res);
    if (!projectRef) return;

    const episodesCol = db.collection('users').doc(uid).collection('projects').doc(projectId).collection('episodes');

    let query = episodesCol.orderBy('startedAt', 'desc');
    if (!includeClosed) {
      query = query.where('status', '==', 'open');
    }
    if (limit) {
      query = query.limit(limit);
    }

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

registerErrorHandler(app);

module.exports = app;
