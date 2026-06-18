/**
 * OpenRouterAccountClient Tests
 *
 * Validates the sanitized parsing of /key and /credits, the no-key short-circuit,
 * HTTP-failure handling, and the malformed-credits guard. fetch is mocked so no
 * network is touched and no key/raw body can escape the client.
 */

import { OpenRouterAccountClient, ApiKeyProvider } from '@/infrastructure/account';

const makeSecrets = (key: string | undefined): ApiKeyProvider => ({
  getApiKey: jest.fn().mockResolvedValue(key)
});

const okResponse = (body: unknown): Partial<Response> => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue(body)
});

const errResponse = (status: number): Partial<Response> => ({
  ok: false,
  status,
  json: jest.fn().mockResolvedValue({})
});

describe('OpenRouterAccountClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('no key configured', () => {
    it('short-circuits both calls to no_key without fetching', async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets(undefined));

      const credits = await client.fetchCredits();
      const key = await client.fetchKeyLimit();

      expect(credits).toEqual({ ok: false, status: 'no_key', reason: expect.any(String) });
      expect(key).toEqual({ ok: false, status: 'no_key', reason: expect.any(String) });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('fetchCredits', () => {
    it('computes remaining = total_credits - total_usage', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(okResponse({ data: { total_credits: 20, total_usage: 7.6 } })) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchCredits();

      expect(result).toEqual({ ok: true, data: { totalCredits: 20, totalUsage: 7.6, remaining: 12.4 } });
    });

    it('treats a missing total_credits as unavailable (no silent zero)', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(okResponse({ data: { total_usage: 5 } })) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchCredits();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe('unavailable');
    });

    it('maps a 403 to unavailable (non-management key)', async () => {
      global.fetch = jest.fn().mockResolvedValue(errResponse(403)) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchCredits();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe('unavailable');
    });

    it('maps a thrown fetch (timeout/network) to unavailable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('aborted')) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchCredits();

      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.status).toBe('unavailable');
    });
  });

  describe('fetchKeyLimit', () => {
    it('parses limit fields and derives the reset window', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          okResponse({ data: { limit: 100, limit_remaining: 40, limit_reset: 'weekly' } })
        ) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchKeyLimit();

      expect(result).toEqual({
        ok: true,
        data: { limit: 100, limitRemaining: 40, resetWindow: 'weekly' }
      });
    });

    it('keeps null limits (unlimited key) and falls back to unknown window', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(okResponse({ data: { limit: null, limit_remaining: null } })) as unknown as typeof fetch;
      const client = new OpenRouterAccountClient(makeSecrets('sk-test'));

      const result = await client.fetchKeyLimit();

      expect(result).toEqual({
        ok: true,
        data: { limit: null, limitRemaining: null, resetWindow: 'unknown' }
      });
    });
  });
});
