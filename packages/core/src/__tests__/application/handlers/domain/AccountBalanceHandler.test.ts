/**
 * AccountBalanceHandler Tests
 *
 * Validates route registration, the happy-path post of sanitized balances, and
 * the never-throw error path (a service failure still posts a usable payload).
 */

import { AccountBalanceHandler } from '@/application/handlers/domain/AccountBalanceHandler';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import { MessageType } from '@/shared/types/messages';
import type { AccountBalanceService } from '@/infrastructure/account';
import type { RequestAccountBalanceMessage, AccountBalancePayload } from '@messages';

const fakePayload: AccountBalancePayload = {
  openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } },
  fetchedAt: 123
};

const requestMessage = (forceRefresh?: boolean): RequestAccountBalanceMessage => ({
  type: MessageType.REQUEST_ACCOUNT_BALANCE,
  source: 'webview.account',
  payload: { forceRefresh },
  timestamp: 0
});

describe('AccountBalanceHandler', () => {
  let postMessage: jest.Mock;

  beforeEach(() => {
    postMessage = jest.fn();
  });

  it('registers the REQUEST_ACCOUNT_BALANCE route', () => {
    const service = { getBalances: jest.fn() } as unknown as AccountBalanceService;
    const handler = new AccountBalanceHandler(postMessage, service);
    const router = new MessageRouter();

    handler.registerRoutes(router);

    expect(router.hasHandler(MessageType.REQUEST_ACCOUNT_BALANCE)).toBe(true);
  });

  it('posts the sanitized balances from the service', async () => {
    const service = { getBalances: jest.fn().mockResolvedValue(fakePayload) } as unknown as AccountBalanceService;
    const handler = new AccountBalanceHandler(postMessage, service);

    await handler.handleRequest(requestMessage(true));

    expect(service.getBalances).toHaveBeenCalledWith(true);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const sent = postMessage.mock.calls[0][0];
    expect(sent.type).toBe(MessageType.ACCOUNT_BALANCE_DATA);
    expect(sent.source).toBe('extension.account');
    expect(sent.payload).toEqual(fakePayload);
  });

  it('defaults forceRefresh to false when omitted', async () => {
    const service = { getBalances: jest.fn().mockResolvedValue(fakePayload) } as unknown as AccountBalanceService;
    const handler = new AccountBalanceHandler(postMessage, service);

    await handler.handleRequest({ ...requestMessage(), payload: {} as any });

    expect(service.getBalances).toHaveBeenCalledWith(false);
  });

  it('posts an unavailable payload instead of throwing when the service fails', async () => {
    const service = {
      getBalances: jest.fn().mockRejectedValue(new Error('boom'))
    } as unknown as AccountBalanceService;
    const handler = new AccountBalanceHandler(postMessage, service);

    await expect(handler.handleRequest(requestMessage())).resolves.toBeUndefined();

    const sent = postMessage.mock.calls[0][0];
    expect(sent.type).toBe(MessageType.ACCOUNT_BALANCE_DATA);
    expect(sent.payload.openrouter.status).toBe('unavailable');
    expect(sent.payload.openrouter.creditsStatus).toBe('unavailable');
  });
});
