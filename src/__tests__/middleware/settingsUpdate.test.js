// Tests for POST /settings/update + /settings/get validation chains.
// Validates that aiProvider is restricted to the allowlist and key lengths are capped.

const { settingsUpdateRules, settingsGetRules } = require('../../middleware/validate');

async function runRules(rules, body) {
  const req = { body };
  const res = {
    statusCode: 0,
    status(c) { this.statusCode = c; return this; },
    json() { this.headersSent = true; return this; },
    headersSent: false,
  };
  for (const fn of rules) {
    await new Promise((resolve) => {
      const ret = fn(req, res, () => resolve());
      if (ret && typeof ret.then === 'function') {
        ret.then(() => resolve(), () => resolve());
      } else {
        resolve();
      }
    });
    if (res.headersSent) break;
  }
  return { rejected: res.statusCode === 400, statusCode: res.statusCode };
}

describe('settingsGetRules (POST /settings/get)', () => {
  it('accepts an empty body', async () => {
    const result = await runRules(settingsGetRules, {});
    expect(result.rejected).toBe(false);
  });
});

describe('settingsUpdateRules (POST /settings/update)', () => {
  it('accepts an empty body (no fields)', async () => {
    const result = await runRules(settingsUpdateRules, {});
    expect(result.rejected).toBe(false);
  });

  it('accepts each provider in the allowlist', async () => {
    for (const provider of ['none', 'gemini', 'openai', 'anthropic']) {
      const result = await runRules(settingsUpdateRules, { aiProvider: provider });
      expect(result.rejected).toBe(false);
    }
  });

  it('rejects an unknown aiProvider', async () => {
    const result = await runRules(settingsUpdateRules, { aiProvider: 'gpt-99' });
    expect(result.rejected).toBe(true);
  });

  it('rejects aiProvider outside the allowlist', async () => {
    for (const bad of ['admin', 'ADMIN', 'Gemini', 'claude', 'openai-pro', '']) {
      const result = await runRules(settingsUpdateRules, { aiProvider: bad });
      expect(result.rejected).toBe(true);
    }
  });

  it('accepts keys up to 256 characters', async () => {
    const result = await runRules(settingsUpdateRules, {
      geminiApiKey: 'a'.repeat(256),
    });
    expect(result.rejected).toBe(false);
  });

  it('rejects keys longer than 256 characters', async () => {
    const result = await runRules(settingsUpdateRules, {
      openaiApiKey: 'a'.repeat(257),
    });
    expect(result.rejected).toBe(true);
  });

  it('accepts all four keys at once', async () => {
    const result = await runRules(settingsUpdateRules, {
      aiProvider: 'openai',
      geminiApiKey: 'g'.repeat(100),
      openaiApiKey: 'o'.repeat(100),
      anthropicApiKey: 'a'.repeat(100),
    });
    expect(result.rejected).toBe(false);
  });
});
