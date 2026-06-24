const { db } = require('../firebase');
const { ErrorCodes, typedError, mapError } = require('./errors');
const { decrypt } = require('./crypto');
const { auditLog } = require('../middleware/auditLog');

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

module.exports = {
  verifyProjectOwnership,
  verifyEpisodeOwnership,
  checkIdempotency,
  storeIdempotency,
  getProviderConfig,
  structuredOrFallback,
  sendError,
};
