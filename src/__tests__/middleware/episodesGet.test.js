// Tests for the POST /episodes/get validation chain.
// Validates the bug fix: handler used to reuse `explainRules` which lacked
// proper UUID enforcement. Now uses `getEpisodeBodyRules`.

const { getEpisodeBodyRules } = require('../../middleware/validate');

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
    if (res.headersSent) break; // handleValidation sent 400
  }
  return { rejected: res.statusCode === 400, statusCode: res.statusCode };
}

describe('getEpisodeBodyRules (POST /episodes/get)', () => {
  it('accepts a valid UUID projectId + episodeId', async () => {
    const result = await runRules(getEpisodeBodyRules, {
      projectId: '11111111-2222-4333-8444-555555555555',
      episodeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    expect(result.rejected).toBe(false);
  });

  it('rejects when projectId is missing', async () => {
    const result = await runRules(getEpisodeBodyRules, {
      episodeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    expect(result.rejected).toBe(true);
  });

  it('rejects when episodeId is not a UUID', async () => {
    const result = await runRules(getEpisodeBodyRules, {
      projectId: '11111111-2222-4333-8444-555555555555',
      episodeId: 'not-a-uuid',
    });
    expect(result.rejected).toBe(true);
  });

  it('rejects when projectId is empty string', async () => {
    const result = await runRules(getEpisodeBodyRules, {
      projectId: '',
      episodeId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
    });
    expect(result.rejected).toBe(true);
  });

  it('rejects when both fields are missing', async () => {
    const result = await runRules(getEpisodeBodyRules, {});
    expect(result.rejected).toBe(true);
  });
});
