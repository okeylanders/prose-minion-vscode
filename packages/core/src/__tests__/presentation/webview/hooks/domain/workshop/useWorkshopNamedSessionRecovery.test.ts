/** @jest-environment jsdom */

/**
 * useWorkshopNamedSessionRecovery (ADR 2026-11-19 D6e): a refused save or
 * open that names `recoverSessionId` leaves a notice offering Recover…;
 * Recover… opens a confirm and posts nothing until it is accepted; the post
 * carries a webview-minted request id and the session id only; only the
 * answer still waited for is taken, and the list is asked for again after
 * it; nothing persists. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopSessionActionResultMessage } from '@messages';
import { useWorkshopNamedSessionRecovery, type UseWorkshopNamedSessionRecoveryOptions } from '@hooks/domain/workshop/useWorkshopNamedSessionRecovery';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const answer = (requestId: string, ok = true, message = 'Recovered the saved session.') => ({
  type: MessageType.WORKSHOP_NAMED_SESSION_RECOVERY_RESULT,
  source: 'extension.workshop.sessionRecovery',
  payload: { requestId, sessionId: 'alice-polish', ok, message },
  timestamp: 2
}) as never;

const refusedSave: WorkshopSessionActionResultMessage['payload'] = {
  action: 'save', ok: false, message: 'This saved session was left mid-save.', recoverSessionId: 'alice-polish'
};

describe('useWorkshopNamedSessionRecovery', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posts = () => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_RECOVER_NAMED_SESSION);
  const mount = (initial: UseWorkshopNamedSessionRecoveryOptions) =>
    renderHook((props: UseWorkshopNamedSessionRecoveryOptions) => useWorkshopNamedSessionRecovery(props), { initialProps: initial });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('a refused save that names the session offers Recover…; a refusal that does not offers nothing', () => {
    const onSettled = jest.fn();
    const { result, rerender } = mount({ onSettled, sessionActionResult: { action: 'save', ok: false, message: 'Busy.' } });
    expect(result.current.offer).toBeUndefined();
    rerender({ onSettled, sessionActionResult: refusedSave });
    expect(result.current.offer).toEqual({ sessionId: 'alice-polish' });
  });

  it('Recover… confirms first, then posts a minted id and the session id only', () => {
    const { result } = mount({ onSettled: jest.fn() });
    act(() => result.current.ask('alice-polish', 'Polish 6.11'));
    expect(result.current.confirming).toEqual({ sessionId: 'alice-polish', title: 'Polish 6.11' });
    expect(posts()).toHaveLength(0);
    act(() => result.current.confirm());
    expect(posts()).toHaveLength(1);
    expect(posts()[0].payload).toEqual({ requestId: expect.stringMatching(/^ws-session-recover-/), sessionId: 'alice-polish' });
    expect(result.current.recovering).toBe(true);
    expect(result.current.confirming).toBeUndefined();
  });

  it('cancel posts nothing', () => {
    const { result } = mount({ onSettled: jest.fn() });
    act(() => result.current.ask('alice-polish'));
    act(() => result.current.cancel());
    expect(result.current.confirming).toBeUndefined();
    expect(posts()).toHaveLength(0);
  });

  it('takes only the answer it waits for, then clears the offer and asks for the list again', () => {
    const onSettled = jest.fn();
    const { result } = mount({ onSettled, sessionActionResult: refusedSave });
    act(() => result.current.ask('alice-polish'));
    act(() => result.current.confirm());
    const requestId = posts()[0].payload.requestId as string;
    act(() => result.current.handleResult(answer('someone-else')));
    expect(result.current.recovering).toBe(true);
    expect(onSettled).not.toHaveBeenCalled();
    act(() => result.current.handleResult(answer(requestId)));
    expect(result.current.recovering).toBe(false);
    expect(result.current.outcome).toEqual({ ok: true, message: 'Recovered the saved session.' });
    expect(result.current.offer).toBeUndefined();
    expect(onSettled).toHaveBeenCalledTimes(1);
    act(() => result.current.handleResult(answer(requestId)));
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('a failed recovery keeps the offer and shows the host\'s words; nothing persists', () => {
    const { result } = mount({ onSettled: jest.fn(), sessionActionResult: refusedSave });
    act(() => result.current.ask('alice-polish'));
    act(() => result.current.confirm());
    const requestId = posts()[0].payload.requestId as string;
    act(() => result.current.handleResult(answer(requestId, false, 'Recovery stopped while saving a recovery copy.')));
    expect(result.current.outcome?.ok).toBe(false);
    expect(result.current.offer).toEqual({ sessionId: 'alice-polish' });
    expect(result.current.persistedState).toEqual({});
  });
});
