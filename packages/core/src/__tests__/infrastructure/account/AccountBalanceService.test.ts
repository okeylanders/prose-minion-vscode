/**
 * AccountBalanceService Tests
 *
 * Validates the TTL cache, concurrent-fetch coalescing, per-call partial-failure
 * isolation (/credits fails while /key succeeds), the genuine-no-key result, and
 * the debounced post-AI-request refresh + listener fan-out.
 */

import { AccountBalanceService } from '@/infrastructure/account';
import type { OpenRouterAccountClient } from '@/infrastructure/account/OpenRouterAccountClient';

type ClientMock = {
  fetchKeyLimit: jest.Mock;
  fetchCredits: jest.Mock;
};

const okCredits = (remaining: number) => ({
  ok: true as const,
  data: { totalCredits: remaining, totalUsage: 0, remaining }
});
const okKey = () => ({
  ok: true as const,
  data: { limit: 100, limitRemaining: 40, resetWindow: 'weekly' as const }
});

const makeClient = (overrides?: Partial<ClientMock>): { client: OpenRouterAccountClient; mock: ClientMock } => {
  const mock: ClientMock = {
    fetchKeyLimit: jest.fn().mockResolvedValue(okKey()),
    fetchCredits: jest.fn().mockResolvedValue(okCredits(12.4)),
    ...overrides
  };
  return { client: mock as unknown as OpenRouterAccountClient, mock };
};

describe('AccountBalanceService', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('resolves a combined ok payload from both calls', async () => {
    const { client } = makeClient();
    const service = new AccountBalanceService(client);

    const payload = await service.getBalances();

    expect(payload.openrouter.status).toBe('ok');
    expect(payload.openrouter.credits?.remaining).toBe(12.4);
    expect(payload.openrouter.keyLimit?.limitRemaining).toBe(40);
    expect(payload.openrouter.creditsStatus).toBe('ok');
    expect(typeof payload.fetchedAt).toBe('number');
  });

  it('serves the TTL cache on a second non-forced call (no re-fetch)', async () => {
    const { client, mock } = makeClient();
    const service = new AccountBalanceService(client);

    await service.getBalances();
    await service.getBalances();

    expect(mock.fetchCredits).toHaveBeenCalledTimes(1);
    expect(mock.fetchKeyLimit).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent fetches into one in-flight promise', async () => {
    const { client, mock } = makeClient();
    const service = new AccountBalanceService(client);

    const [a, b] = await Promise.all([service.getBalances(), service.getBalances()]);

    expect(a).toBe(b);
    expect(mock.fetchCredits).toHaveBeenCalledTimes(1);
  });

  it('rate-limits a forced refresh issued immediately after a fetch', async () => {
    const { client, mock } = makeClient();
    const service = new AccountBalanceService(client);

    await service.getBalances();
    await service.getBalances(true); // within MIN_FORCED_INTERVAL_MS → cache

    expect(mock.fetchCredits).toHaveBeenCalledTimes(1);
  });

  it('keeps key-limit data when /credits fails (partial failure)', async () => {
    const { client } = makeClient({
      fetchCredits: jest.fn().mockResolvedValue({ ok: false, status: 'unavailable', reason: '403' })
    });
    const service = new AccountBalanceService(client);

    const payload = await service.getBalances();

    expect(payload.openrouter.status).toBe('ok'); // /key still succeeded
    expect(payload.openrouter.keyLimit?.limitRemaining).toBe(40);
    expect(payload.openrouter.credits).toBeUndefined();
    expect(payload.openrouter.creditsStatus).toBe('unavailable');
  });

  it('reports unavailable (not no_key) and logs once when both calls fail for non-key reasons', async () => {
    const appendLine = jest.fn();
    const { client } = makeClient({
      fetchKeyLimit: jest.fn().mockResolvedValue({ ok: false, status: 'unavailable', reason: 'Key info unavailable (500).' }),
      fetchCredits: jest.fn().mockResolvedValue({ ok: false, status: 'unavailable', reason: 'Account balance unavailable (500).' })
    });
    const service = new AccountBalanceService(client, { appendLine } as never);

    const payload = await service.getBalances();

    expect(payload.openrouter.status).toBe('unavailable');
    expect(payload.openrouter.credits).toBeUndefined();
    expect(payload.openrouter.keyLimit).toBeUndefined();
    expect(payload.openrouter.reason).toBe('Key info unavailable (500).');
    // A single service-level summary so a "balance shows —" report is diagnosable.
    expect(appendLine).toHaveBeenCalledTimes(1);
    expect(appendLine.mock.calls[0][0]).toContain('Both /key and /credits failed');
  });

  it('reports no_key only when BOTH calls report no_key', async () => {
    const { client } = makeClient({
      fetchKeyLimit: jest.fn().mockResolvedValue({ ok: false, status: 'no_key', reason: 'x' }),
      fetchCredits: jest.fn().mockResolvedValue({ ok: false, status: 'no_key', reason: 'x' })
    });
    const service = new AccountBalanceService(client);

    const payload = await service.getBalances();

    expect(payload.openrouter.status).toBe('no_key');
    expect(payload.openrouter.creditsStatus).toBe('no_key');
  });

  it('debounces scheduleRefresh and notifies listeners once with fresh data', async () => {
    jest.useFakeTimers();
    const { client, mock } = makeClient();
    const service = new AccountBalanceService(client);
    const listener = jest.fn();
    service.addRefreshListener(listener);

    service.scheduleRefresh();
    service.scheduleRefresh(); // coalesced
    expect(mock.fetchCredits).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(10_000);

    expect(mock.fetchCredits).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].openrouter.status).toBe('ok');
  });

  it('dispose cancels an armed refresh timer', async () => {
    jest.useFakeTimers();
    const { client, mock } = makeClient();
    const service = new AccountBalanceService(client);
    service.addRefreshListener(jest.fn());

    service.scheduleRefresh();
    service.dispose();
    await jest.advanceTimersByTimeAsync(10_000);

    expect(mock.fetchCredits).not.toHaveBeenCalled();
  });
});
