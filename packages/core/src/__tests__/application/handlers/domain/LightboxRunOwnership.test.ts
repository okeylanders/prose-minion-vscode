/**
 * A press owns its run from before its prompt files load (PR #149 F-02).
 *
 * The real LightboxReadingHandler, LightboxService, LightboxReadingRunner and
 * context shelf; only the prompt files are held open, so a close, a reopen or
 * an input change can land while a press is being prepared. A press reserves
 * its board under a minted token before anything is awaited, starts only if
 * its tab is open, its reservation holds and every input it was priced on is
 * unchanged, and its tab posts nothing once closed. No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import { MessageType } from '@/shared/types/messages';
import { ALL_LENSES_OFF, createLightboxReadingHost, settle } from './lightboxReadingHarness';

const ESTIMATE_CHANGED = /^The estimate changed since it was shown/;

describe('a press owns its run from before its prompt files load (PR #149 F-02)', () => {
  it('closing the tab while the prompt files load sends nothing, posts nothing and frees the board', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    const key = await tab.setLenses([]);
    host.holdPrompts();
    const press = tab.run({ mode: 'all' }, { estimateKey: key });
    await settle();
    const before = tab.posted.length;

    tab.handler.dispose();
    host.releasePrompts();
    await press;
    await settle();

    expect(host.runInitial).not.toHaveBeenCalled();
    expect(tab.posted).toHaveLength(before);
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    expect(host.service.currentBoard()?.readings.map((group) => group.status)).toEqual(['not-run', 'not-run', 'not-run', 'not-run']);
    expect(tab.logged()).toContain('Press run-1-token released before it started');

    // The board was given back: the next tab's press reads it.
    const next = host.openTab();
    await next.run();
    await settle();
    expect(host.runInitial).toHaveBeenCalledTimes(4);
  });

  it('close and reopen: the reopened tab\'s press runs, the closed tab\'s never starts', async () => {
    const host = await createLightboxReadingHost();
    const closing = host.openTab();
    const key = await closing.setLenses([]);
    host.holdPrompts();
    const stale = closing.run({ mode: 'all' }, { estimateKey: key });
    await settle();
    closing.handler.dispose();
    const afterClose = closing.posted.length;

    // Same board, lenses, context and model: the reopened tab's estimate has the same key.
    const reopened = host.openTab();
    const fresh = reopened.run({ mode: 'all' }, { estimateKey: key });
    await settle();
    host.releasePrompts();
    await Promise.all([stale, fresh]);
    await settle();

    expect(host.runInitial).toHaveBeenCalledTimes(4);
    expect(closing.posted).toHaveLength(afterClose);
    const progress = reopened.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload);
    expect(progress[0]).toMatchObject({ phase: 'started', token: 'run-2-token' });
    expect(progress.at(-1)).toMatchObject({ phase: 'finished', token: 'run-2-token', groupsBack: 4 });
    expect(host.service.currentBoard()?.readings.every((group) => group.tiles.every((tile) => tile.id.startsWith('lbt-run-2-to')))).toBe(true);
  });

  it('holds the board while its prompt files load, and starts once they have', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    const key = await tab.setLenses([]);
    host.holdPrompts();
    const press = tab.run({ mode: 'all' }, { estimateKey: key });
    await settle();

    // Nothing has started, so there is nothing to stop yet, but the board is taken.
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS)).toEqual([]);
    await tab.run({ mode: 'all' }, { estimateKey: key });
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload)).toEqual([
      expect.objectContaining({ phase: 'refused', message: 'This board is already being read. Stop that run first.' })
    ]);

    host.releasePrompts();
    await press;
    await settle();
    expect(host.runInitial).toHaveBeenCalledTimes(4);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((message) => message.payload.phase))
      .toEqual(['refused', 'started', 'streaming', 'streaming', 'streaming', 'streaming', 'finished']);
  });

  it.each([
    ['a context file removed', ESTIMATE_CHANGED, async (host: Host, tab: Tab) => {
      void tab.route(MessageType.LIGHTBOX_REMOVE_CONTEXT_FILE, { id: 'ctx-1' });
    }],
    ['a context file added', ESTIMATE_CHANGED, async (host: Host, tab: Tab) => {
      host.pickFile.mockResolvedValueOnce({ fsPath: '/workspace/Notes/places.md', uri: 'file:///workspace/Notes/places.md' });
      void tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    }],
    ['every lens turned off', ESTIMATE_CHANGED, async (_host: Host, tab: Tab) => {
      void tab.route(MessageType.LIGHTBOX_SET_LENSES, { lensesOff: ALL_LENSES_OFF });
    }],
    ['the assistant model switched', ESTIMATE_CHANGED, async (host: Host) => {
      host.setModel('provider/model-v2');
    }],
    ['the model\'s price changed', ESTIMATE_CHANGED, async (host: Host) => {
      host.setPricing({ promptUsdPerToken: 0.00003, completionUsdPerToken: 0.00015 });
    }],
    ['another board adopted', /^The board changed\. Read the board on screen\.$/, async (host: Host) => {
      await host.service.buildBoard({ kind: 'file', text: 'Another chapter.\n\nWith two paragraphs.', displayPath: 'Drafts/two.md' });
    }]
  ])('refuses, with nothing sent, when its inputs change while it is prepared: %s', async (_label, message, change) => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    await tab.route(MessageType.LIGHTBOX_ADD_CONTEXT_FILES);
    const key = await tab.setLenses([]);
    host.holdPrompts();
    const press = tab.run({ mode: 'all' }, { estimateKey: key });
    await settle();

    await change(host, tab);
    host.releasePrompts();
    await press;
    await settle();

    expect(host.runInitial).not.toHaveBeenCalled();
    expect(host.runner.activeRun(host.board.boardId)).toBeUndefined();
    const refusal = tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).map((entry) => entry.payload).find((entry) => entry.phase === 'refused');
    expect(refusal).toMatchObject({ boardId: host.board.boardId, reestimate: true, groups: ['A', 'B', 'C', 'D'] });
    expect(refusal?.message).toMatch(message);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS).some((entry) => entry.payload.phase === 'started')).toBe(false);
  });

  it('refuses a press that names a model other than the one in use (PR #149 F-03 re-review)', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    const key = await tab.setLenses([]);
    const reads = host.loadPrompts.mock.calls.length;

    // The writer picked another model and it is not saved yet: the host's estimate is still the old model's.
    await tab.run({ mode: 'all' }, { estimateKey: key, model: 'provider/model-v2' });

    expect(host.loadPrompts.mock.calls.length).toBe(reads);
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS)[0].payload).toMatchObject({
      phase: 'refused',
      reestimate: true,
      message: expect.stringMatching(/^The model this press names is not the assistant model in use yet/)
    });
  });

  it('refuses at once a press priced on another model, before a prompt file is read for it', async () => {
    const host = await createLightboxReadingHost();
    const tab = host.openTab();
    const key = await tab.setLenses([]);
    host.setModel('provider/model-v2');
    const reads = host.loadPrompts.mock.calls.length;

    await tab.run({ mode: 'all' }, { estimateKey: key });

    expect(host.loadPrompts.mock.calls.length).toBe(reads);
    expect(host.runInitial).not.toHaveBeenCalled();
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_PROGRESS)[0].payload).toMatchObject({ phase: 'refused', reestimate: true });
    // The fresh estimate names the new model, and its key is a different key.
    const fresh = await tab.setLenses([]);
    expect(fresh).not.toBe(key);
    expect(tab.ofType(MessageType.LIGHTBOX_RUN_ESTIMATE).at(-1)?.payload.estimate?.model).toBe('provider/model-v2');
    await tab.run({ mode: 'all' }, { estimateKey: fresh });
    await settle();
    expect(host.runInitial).toHaveBeenCalledTimes(4);
  });
});

type Host = Awaited<ReturnType<typeof createLightboxReadingHost>>;
type Tab = ReturnType<Host['openTab']>;
