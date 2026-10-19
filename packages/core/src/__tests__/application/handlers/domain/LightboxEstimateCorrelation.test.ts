/**
 * The host's estimate is only ever the answer to a request (PR #149 F-03).
 *
 * The real LightboxReadingHandler, service, runner and shelf, with the prompt
 * files held where a test needs to order two requests. Each answer echoes
 * its request's id; an answer overtaken by a newer request while its prompt
 * files loaded is dropped rather than posted late; and nothing posts an
 * estimate unasked (a run finishing or stopping, a context change). No
 * provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import { LightboxReadingGroupId, MessageType } from '@/shared/types/messages';
import { ALL_LENSES_OFF, createLightboxReadingHost, groupOf, ok, settle } from './lightboxReadingHarness';

describe('the host answers estimate requests, and only the newest (PR #149 F-03)', () => {
  it('echoes the request id with its estimate', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    await tab.setLenses(['genre'], 'tab-1');
    const [answer] = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE);
    expect(answer.payload).toMatchObject({ requestId: 'tab-1', estimate: { boardId: host.board.boardId } });
    expect(answer.payload.estimate?.groups.map((call) => call.group)).toEqual(['A', 'B']);
  });

  it('drops an answer overtaken by a newer request for the same board while its prompt files loaded', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    host.holdPrompts();
    const allLenses = tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: [], requestId: 'tab-1' });
    await settle();
    // Every lens off needs no prompt file, so its answer lands first.
    await tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: ALL_LENSES_OFF, requestId: 'tab-2' });
    host.releasePrompts();
    await allLenses;
    await settle();

    expect(tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).map((message) => [message.payload.requestId, message.payload.estimate?.groups.length]))
      .toEqual([['tab-2', 0]]);
  });

  it('posts no estimate unasked: not when a run finishes or stops, nor when the context list changes', async () => {
    const calls = new Map<LightboxReadingGroupId, (result: ExecutionResult) => void>();
    const host = await createLightboxReadingHost({
      respond: (request) => new Promise<ExecutionResult>((resolve) => {
        calls.set(groupOf(request), resolve);
        request.options?.signal?.addEventListener('abort', () => resolve({ ...ok('A'), cancelled: true }));
      })
    });
    const tab = host.openTab();
    await tab.run({ mode: 'lens', lens: 'genre' });
    await settle();
    const asked = tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).length;

    calls.get('C')?.(ok('C'));
    await settle();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload.phase).toBe('finished');

    await tab.run({ mode: 'lens', lens: 'voice' }, { estimateKey: tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate?.key });
    await settle();
    const token = tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload.token;
    await tab.route(MessageType.LIGHTBOX_CANCEL_RUN, { boardId: host.board.boardId, token });
    await tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    await tab.route(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id: 'ctx-1' });
    await settle();

    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).at(-1)?.payload.phase).toBe('cancelled');
    expect(tab.ofType(MessageType.LIGHTBOX_CONTEXT_FILES).length).toBeGreaterThanOrEqual(2);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE)).toHaveLength(asked);
  });
});
