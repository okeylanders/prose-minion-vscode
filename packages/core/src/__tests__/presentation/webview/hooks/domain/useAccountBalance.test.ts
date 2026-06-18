/**
 * @jest-environment jsdom
 */

/**
 * useAccountBalance Tests
 *
 * Validates the mount fetch, manual refresh (forced), data handling, and the
 * forced re-fetch when the API key transitions to configured.
 */

import { renderHook, act } from '@testing-library/react';
import { useAccountBalance } from '@hooks/domain/useAccountBalance';
import { MessageType } from '@shared/types';
import type { AccountBalanceDataMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const dataMessage = (): AccountBalanceDataMessage => ({
  type: MessageType.ACCOUNT_BALANCE_DATA,
  source: 'extension.account',
  payload: {
    openrouter: { status: 'ok', creditsStatus: 'ok', credits: { totalCredits: 20, totalUsage: 8, remaining: 12 } },
    fetchedAt: 999
  },
  timestamp: 0
});

describe('useAccountBalance', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => jest.clearAllMocks());

  const lastBalanceRequest = () =>
    mockVSCode.postMessage.mock.calls
      .map((c) => c[0])
      .filter((m) => m.type === MessageType.REQUEST_ACCOUNT_BALANCE)
      .pop();

  it('requests balances (non-forced) on mount', () => {
    renderHook(() => useAccountBalance({ apiKeyConfigured: true }));

    const req = lastBalanceRequest();
    expect(req).toBeDefined();
    expect(req.payload.forceRefresh).toBe(false);
    expect(req.source).toBe('webview.account');
  });

  it('starts in a loading state with no balance', () => {
    const { result } = renderHook(() => useAccountBalance({ apiKeyConfigured: true }));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.openrouter).toBeNull();
  });

  it('refresh() posts a forced request', () => {
    const { result } = renderHook(() => useAccountBalance({ apiKeyConfigured: true }));
    act(() => result.current.refresh());

    expect(lastBalanceRequest().payload.forceRefresh).toBe(true);
  });

  it('handleAccountBalanceData populates state and clears loading', () => {
    const { result } = renderHook(() => useAccountBalance({ apiKeyConfigured: true }));
    act(() => result.current.handleAccountBalanceData(dataMessage()));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.openrouter?.credits?.remaining).toBe(12);
    expect(result.current.fetchedAt).toBe(999);
  });

  it('forces a re-fetch when the key transitions to configured', () => {
    const { rerender } = renderHook(({ k }) => useAccountBalance({ apiKeyConfigured: k }), {
      initialProps: { k: false }
    });
    const before = mockVSCode.postMessage.mock.calls.length;

    rerender({ k: true });

    const req = lastBalanceRequest();
    expect(mockVSCode.postMessage.mock.calls.length).toBeGreaterThan(before);
    expect(req.payload.forceRefresh).toBe(true);
  });
});
