/**
 * The Recover… route (ADR 2026-11-19 D6e): ids in, host words out by
 * request id; a refusal names the step and logs only ids and the kind;
 * a malformed request runs nothing. *Alice*, made-up ids.
 */

import { MessageType } from '@messages';
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopNamedSessionRecoveryRoute } from '@handlers/domain/workshop/WorkshopNamedSessionRecoveryRoute';
import { WorkshopNamedSessionRecoveryFailedError } from '@/infrastructure/storage/WorkshopNamedSessionRecovery';
import { WorkshopNamedSessionBusyError, WORKSHOP_NAMED_SESSION_BUSY_WORDS } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import type { WorkshopStoredSessionSummary } from '@/infrastructure/storage/WorkshopSessionSearchIndexV1';

const request = (payload: Record<string, unknown>) => ({ type: MessageType.WORKSHOP_RECOVER_NAMED_SESSION, source: 'webview', payload, timestamp: 1 }) as never;
const copy = { sessionId: 'alice-recovered-1', title: 'Polish, unsaved (local recovery)', fileName: '20261119-120001-polish-unsaved-local-recovery.json' } as WorkshopStoredSessionSummary;

function harness(recoverNamed: jest.Mock) {
  const posted: Array<{ type: MessageType; payload: Record<string, unknown> }> = [];
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const route = new WorkshopNamedSessionRecoveryRoute({ recoverNamed }, async (message) => { posted.push(message as never); }, log);
  const router = new MessageRouter();
  route.register(router);
  return { route, router, posted, log };
}

describe('WorkshopNamedSessionRecoveryRoute', () => {
  it('registers its one route and answers a recovery by request id, in host words', async () => {
    const recoverNamed = jest.fn().mockResolvedValue({ nothingToRecover: false, restored: true, unfinishedDelete: false, copies: [copy], dropped: 0 });
    const { route, router, posted } = harness(recoverNamed);
    expect(router.hasHandler(MessageType.WORKSHOP_RECOVER_NAMED_SESSION)).toBe(true);
    await route.handle(request({ requestId: 'r-1', sessionId: 'alice-polish' }));
    expect(recoverNamed).toHaveBeenCalledWith('alice-polish');
    expect(posted).toEqual([expect.objectContaining({
      type: MessageType.WORKSHOP_NAMED_SESSION_RECOVERY_RESULT,
      payload: { requestId: 'r-1', sessionId: 'alice-polish', ok: true, message: 'Recovered the saved session. Another copy is kept as “Polish, unsaved (local recovery)” in Sessions.' }
    })]);
  });

  it('an unfinished delete says the session is back', async () => {
    const { route, posted } = harness(jest.fn().mockResolvedValue({ nothingToRecover: false, restored: true, unfinishedDelete: true, copies: [], dropped: 0 }));
    await route.handle(request({ requestId: 'r-2', sessionId: 'alice-polish' }));
    expect(posted[0].payload.message).toBe('A delete didn\'t finish, so the session is back. Delete it again if you meant to.');
  });

  it('a refusal names its step or busy, and logs ids and the kind only', async () => {
    const failed = harness(jest.fn().mockRejectedValue(new WorkshopNamedSessionRecoveryFailedError('copy')));
    await failed.route.handle(request({ requestId: 'r-3', sessionId: 'alice-polish' }));
    expect(failed.posted[0].payload).toMatchObject({ ok: false, message: expect.stringContaining('saving a recovery copy') });
    expect(failed.log.appendLine.mock.calls.flat().join('\n')).not.toMatch(/Polish/);
    const busy = harness(jest.fn().mockRejectedValue(new WorkshopNamedSessionBusyError()));
    await busy.route.handle(request({ requestId: 'r-4', sessionId: 'alice-polish' }));
    expect(busy.posted[0].payload).toMatchObject({ ok: false, message: WORKSHOP_NAMED_SESSION_BUSY_WORDS });
  });

  it('a malformed request runs nothing', async () => {
    const recoverNamed = jest.fn();
    const { route, posted } = harness(recoverNamed);
    await route.handle(request({ requestId: 'r-5' }));
    await route.handle(request({ sessionId: 'alice-polish' }));
    expect(recoverNamed).not.toHaveBeenCalled();
    expect(posted).toEqual([]);
  });
});
