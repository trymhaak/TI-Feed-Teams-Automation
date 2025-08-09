import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('Teams backoff and Retry-After', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it('retries on 429 and respects Retry-After, then succeeds', async () => {
    const calls = [];
    const makeResp = (ok, status, retryAfter) => ({
      ok,
      status,
      statusText: 'Too Many Requests',
      text: async () => 'rate limited',
      headers: { get: (h) => (h.toLowerCase() === 'retry-after' ? retryAfter : null) }
    });

    const fetchMock = jest.fn()
      .mockResolvedValueOnce(makeResp(false, 429, '0'))
      .mockResolvedValueOnce(makeResp(false, 429, '0'))
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: 'OK', text: async () => '' });

    // ESM mock
    jest.unstable_mockModule('node-fetch', () => ({ default: fetchMock }));
    const { postToTeams } = await import('../post-to-teams.js');

    process.env.TEAMS_WEBHOOK_URL = 'https://example.com/webhook/secret';
    process.env.POST_TIMEOUT_MS = '2000';
    process.env.TEAMS_MAX_RETRIES = '5';

    const ok = await postToTeams('source', 'title', 'https://link', 'desc', new Date().toISOString(), {});
    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    delete process.env.TEAMS_WEBHOOK_URL;
    delete process.env.POST_TIMEOUT_MS;
    delete process.env.TEAMS_MAX_RETRIES;
  });
});


