const { getToken, httpsRequest } = require('./auth');
const { getApiBase } = require('./utils/config');

/**
 * Make an authenticated API request to the ContextLens backend.
 * Attaches Bearer token, auto-refreshes on 401, retries once.
 *
 * @param {string} path - API path (e.g., '/projects/create')
 * @param {object} [body] - JSON body
 * @param {string} [method='POST'] - HTTP method
 * @returns {Promise<object>} Parsed JSON response
 */
async function request(path, body = undefined, method = 'POST') {
  const token = await getToken();
  const baseUrl = getApiBase();
  const url = `${baseUrl}${path}`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  const jsonBody = body ? JSON.stringify(body) : undefined;
  if (jsonBody) {
    headers['Content-Length'] = Buffer.byteLength(jsonBody).toString();
  }

  let res = await httpsRequest(url, { method, headers, body: jsonBody });

  // On 401, try refreshing token and retry once
  if (res.status === 401) {
    const newToken = await getToken(); // getToken auto-refreshes
    headers['Authorization'] = `Bearer ${newToken}`;
    res = await httpsRequest(url, { method, headers, body: jsonBody });
  }

  let parsed;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    if (res.status >= 400) {
      throw new Error(`API error (${res.status}): ${res.body}`);
    }
    // For non-JSON responses (e.g., markdown export)
    return { ok: true, raw: res.body, status: res.status };
  }

  if (res.status >= 400) {
    const msg = parsed.error?.message || parsed.message || JSON.stringify(parsed);
    throw new Error(`API error (${res.status}): ${msg}`);
  }

  return parsed;
}

/**
 * Make a GET request.
 */
async function get(path) {
  return request(path, undefined, 'GET');
}

module.exports = { request, get };
