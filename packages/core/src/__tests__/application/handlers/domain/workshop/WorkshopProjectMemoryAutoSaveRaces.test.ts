/**
 * Save and tell me's races (PR #201 F-01–F-03), through the real router,
 * room handler, completion, library and store, with the store's create
 * held so the race is deterministic:
 *
 * - **F-01:** Save and tell me turned to Ask first or Off while the save
 *   waits behind another write, or while its own commit is delayed: nothing
 *   is written, and the card waits for the writer. A writer's save while
 *   memory is Off still works.
 * - **F-02:** an edited Save sent while the automatic save is in flight is
 *   never acknowledged with its edits ignored.
 * - **F-03:** the save is its run's tail. A later send doesn't wait on it,
 *   and preempts it; a room replaced, or the room handler disposed, while it
 *   is held withdraws it. No request crosses into another room or recipient.
 *
 * *Alice*, made-up ids.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { MEMORY } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop routes — Save and tell me races', () => {
  let harness: WorkshopRouteTestHarness;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const memoryFiles = () => [...harness.memory.fileSystem.files.keys()].filter((file) => file.startsWith(MEMORY) && file.endsWith('.md'));
  const ledger = () => harness.session.readRoomLedger();
  const receipts = () => ledger().filter((turn) => turn.projectMemoryReceipt);
  const card = () => ledger().find((turn) => turn.memoryProposals);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).map((entry) => entry.payload);
  const tick = async (rounds = 8) => {
    for (let round = 0; round < rounds; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const until = async (condition: () => boolean) => {
    for (let round = 0; round < 50 && !condition(); round += 1) {
      await tick(1);
    }
    expect(condition()).toBe(true);
  };

  /** Hold the store's next create before it reaches its commit; returns its release. */
  function holdNextCreate(): { release: () => void; reached: () => boolean } {
    const store = harness.memory.store;
    const real = store.create.bind(store);
    let release!: () => void;
    let reached = false;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    jest.spyOn(store, 'create').mockImplementationOnce(async (draft, options) => {
      reached = true;
      await gate;
      return real(draft, options);
    });
    return { release, reached: () => reached };
  }

  /** Send a message whose reply carries a card; resolves when the card is on the turn (the send itself is returned). */
  async function sendCarded(title = 'The Rabbit\'s watch runs backward'): Promise<{ sending: Promise<void>; turn: WorkshopTurn }> {
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`Good.\n\n${memoryFrame({ title })}`, { conversationId: 'host-conv' }) as never
    );
    const sending = route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'So the watch runs backward?' });
    await until(() => card() !== undefined);
    return { sending, turn: card()! };
  }

  let sends = 0;
  /** Like sendCarded, for any send in the room: the host's first reply starts its conversation, later ones continue it. */
  async function sendCardedAgain(title: string): Promise<{ sending: Promise<void>; turn: WorkshopTurn }> {
    sends += 1;
    const call = harness.session.getHostConversationId() ? harness.service.continueConversation : harness.service.startWorkshopPersonaConversation;
    call.mockResolvedValueOnce(analysisResult(`Good.\n\n${memoryFrame({ title })}`, { conversationId: 'host-conv' }) as never);
    const before = ledger().filter((candidate) => candidate.memoryProposals).length;
    const sending = route(MessageType.WORKSHOP_SEND_MESSAGE, { text: `What did we settle? (${sends})` });
    await until(() => ledger().filter((candidate) => candidate.memoryProposals).length > before);
    return { sending, turn: ledger().filter((candidate) => candidate.memoryProposals).at(-1)! };
  }

  beforeEach(async () => {
    sends = 0;
    harness = createWorkshopRouteTestHarness();
    harness.memory.state.mode = 'auto';
    await harness.pin();
  });

  describe('F-01: permission withdrawn before the commit', () => {
    it.each(['ask', 'off'] as const)('turned to %s while the save waits behind another write: nothing is written, and the card waits', async (mode) => {
      const held = holdNextCreate();
      const writerSave = route(MessageType.WORKSHOP_MEMORY_CREATE, {
        requestId: 'w1',
        draft: { title: 'Tea is served at six', kind: 'decision', summary: 'Six o\'clock, always.', body: '', supersedes: [], pinned: false }
      });
      await until(held.reached);
      const { sending, turn } = await sendCarded();

      harness.memory.state.mode = mode;
      held.release();
      await Promise.all([writerSave, sending]);

      expect(results().find((result) => result.requestId === 'w1')).toMatchObject({ ok: true });
      expect(memoryFiles()).toHaveLength(1);
      expect(receipts().map((receipt) => receipt.projectMemoryReceipt?.by)).toEqual(['writer']);
      expect(ledger().find((candidate) => candidate.id === turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending' });
      expect(harness.memory.lines.join('\n')).toContain('save refused reason=withdrawn');
    });

    it.each(['ask', 'off'] as const)('turned to %s while the save\'s own commit is delayed: nothing is written, and the card waits', async (mode) => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);

      harness.memory.state.mode = mode;
      held.release();
      await sending;

      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
      expect(ledger().find((candidate) => candidate.id === turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending' });
    });

    it('a writer\'s Save of the card still works with memory Off afterwards', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);
      harness.memory.state.mode = 'off';
      held.release();
      await sending;

      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'm1', turnId: turn.id, index: 0, action: 'save' });
      expect(results().at(-1)).toMatchObject({ requestId: 'm1', ok: true });
      expect(memoryFiles()).toHaveLength(1);
      expect(receipts().map((receipt) => receipt.projectMemoryReceipt?.by)).toEqual(['writer']);
    });
  });

  describe('F-02: an edited Save during the automatic save', () => {
    it('is never acknowledged with its edits ignored: refused in words while the reply settles, the draft kept', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);

      const edited = { title: 'Corrected by writer', kind: 'canon', summary: 'The watch runs backward from chapter 3.', body: '', supersedes: [], pinned: false };
      const editing = route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'e1', turnId: turn.id, index: 0, action: 'save', edited });
      held.release();
      await Promise.all([sending, editing]);

      // The reply's run is still settling its save, so the edit is refused in words, and the sheet keeps its draft.
      expect(results().find((result) => result.requestId === 'e1'))
        .toEqual({ requestId: 'e1', ok: false, error: 'Wait for the reply to finish, then save to memory.' });
      const memoryId = ledger().find((candidate) => candidate.id === turn.id)!.memoryProposals![0].memoryId!;
      const saved = await harness.memory.store.read(memoryId);
      expect(saved.kind === 'memory' && saved.entry.memory.title).toBe('The Rabbit\'s watch runs backward');
      expect(receipts().map((receipt) => receipt.projectMemoryReceipt?.action)).toEqual(['saved']);
      expect(memoryFiles()).toHaveLength(1);
    });

    it('sent again once the reply has settled, the edit applies to the saved memory with an updated receipt', async () => {
      const { sending, turn } = await sendCarded();
      await sending;
      const edited = { title: 'Corrected by writer', kind: 'canon', summary: 'The watch runs backward from chapter 3.', body: '', supersedes: [], pinned: false };
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'e2', turnId: turn.id, index: 0, action: 'save', edited });

      const memoryId = ledger().find((candidate) => candidate.id === turn.id)!.memoryProposals![0].memoryId!;
      expect(results().at(-1)).toEqual({ requestId: 'e2', ok: true, memoryId });
      const saved = await harness.memory.store.read(memoryId);
      expect(saved.kind === 'memory' && saved.entry.memory.title).toBe('Corrected by writer');
      expect(receipts().map((receipt) => receipt.projectMemoryReceipt?.action)).toEqual(['saved', 'updated']);
      expect(memoryFiles()).toHaveLength(1);
    });

    it('an unedited Save, or an edit equal to the card, still joins: one file, one receipt', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);
      const same = { title: 'The Rabbit\'s watch runs backward', kind: 'canon', summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
        body: 'We settled this while working the tea-party scene.', supersedes: [], pinned: false };
      const saves = [
        route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'u1', turnId: turn.id, index: 0, action: 'save' }),
        route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'u2', turnId: turn.id, index: 0, action: 'save', edited: same })
      ];
      held.release();
      await Promise.all([sending, ...saves]);

      const memoryId = ledger().find((candidate) => candidate.id === turn.id)!.memoryProposals![0].memoryId;
      expect(results()).toEqual([{ requestId: 'u1', ok: true, memoryId }, { requestId: 'u2', ok: true, memoryId }]);
      expect(memoryFiles()).toHaveLength(1);
      expect(receipts()).toHaveLength(1);
    });
  });

  describe('F-04: the room\'s cap counts saves under way', () => {
    it('a reply admitted while the fifth save is committed but its receipt unrecorded is held at the cap', async () => {
      for (let n = 1; n <= 4; n += 1) {
        const { sending } = await sendCardedAgain(`Tea is served at six, take ${n}`);
        await sending;
      }
      expect(receipts()).toHaveLength(4);

      // The fifth file commits; the listing that reads its receipt's version is held.
      const store = harness.memory.store;
      const realCreate = store.create.bind(store);
      const realList = store.list.bind(store);
      let releaseList!: () => void;
      const listGate = new Promise<void>((resolve) => { releaseList = resolve; });
      let committed = false;
      jest.spyOn(store, 'create').mockImplementationOnce(async (draft, options) => {
        const created = await realCreate(draft, options);
        committed = true;
        jest.spyOn(store, 'list').mockImplementationOnce(async () => {
          await listGate;
          return realList();
        });
        return created;
      });
      const fifth = await sendCardedAgain('Tea is served at six, take 5');
      await until(() => committed);
      expect(memoryFiles()).toHaveLength(5);

      const sixth = await sendCardedAgain('Tea is served at six, take 6');
      await sixth.sending;
      expect(sixth.turn.memoryProposals?.[0]).toBeDefined();
      expect(ledger().find((candidate) => candidate.id === sixth.turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending', held: 'room-cap' });

      releaseList();
      await fifth.sending;
      expect(memoryFiles()).toHaveLength(5);
      expect(receipts().map((receipt) => receipt.projectMemoryReceipt?.by)).toEqual(['auto', 'auto', 'auto', 'auto', 'auto']);
      expect(ledger().find((candidate) => candidate.id === fifth.turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'saved' });
    });

    it('the cap is checked again at the commit: a room at the cap by then holds the card with room-cap, and writes nothing', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);
      for (let n = 1; n <= 5; n += 1) {
        harness.session.appendMemoryReceipt({
          action: 'saved', memoryId: `mem-00000${n}`, title: 'Elsewhere', version: '0123456789ab', by: 'auto', proposedBy: 'jill'
        });
      }
      held.release();
      await sending;

      expect(memoryFiles()).toEqual([]);
      expect(ledger().find((candidate) => candidate.id === turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending', held: 'room-cap' });
      expect(harness.memory.lines.join('\n') + (harness.log.appendLine as jest.Mock).mock.calls.join('\n')).toContain('reason=withdrawn:room-cap');
    });

    it('a withdrawn or refused save gives its place back', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);
      harness.memory.state.mode = 'ask';
      held.release();
      await sending;
      expect(ledger().find((candidate) => candidate.id === turn.id)?.memoryProposals?.[0]?.held).toBeUndefined();

      harness.memory.state.mode = 'auto';
      jest.spyOn(harness.memory.library, 'save').mockResolvedValueOnce({ kind: 'refused', reason: 'busy' });
      await (await sendCardedAgain('Tea is served at six, refused')).sending;
      for (let n = 1; n <= 5; n += 1) {
        const next = await sendCardedAgain(`Tea is served at six, take ${n}`);
        await next.sending;
        expect(ledger().find((candidate) => candidate.id === next.turn.id)?.memoryProposals?.[0]?.state).toBe('saved');
      }
      const over = await sendCardedAgain('Tea is served at six, over');
      await over.sending;
      expect(ledger().find((candidate) => candidate.id === over.turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending', held: 'room-cap' });
      expect(memoryFiles()).toHaveLength(5);
    });
  });

  describe('F-03: the save is its run\'s tail', () => {
    it('a later send doesn\'t wait on it, goes to the recipient chosen for it, and preempts the save', async () => {
      const held = holdNextCreate();
      const { sending, turn } = await sendCarded();
      await until(held.reached);

      await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'NEW_MESSAGE_71bb' });
      // The second send completed while the save is still held: nothing waited on it.
      expect(ledger().some((candidate) => candidate.content === 'NEW_MESSAGE_71bb')).toBe(true);
      expect(harness.service.continueConversation).toHaveBeenLastCalledWith('host-conv', expect.stringContaining('NEW_MESSAGE_71bb'), expect.anything());

      held.release();
      await sending;
      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
      expect(ledger().find((candidate) => candidate.id === turn.id)?.memoryProposals?.[0]).toMatchObject({ state: 'pending' });
      expect(harness.memory.lines.join('\n') + (harness.log.appendLine as jest.Mock).mock.calls.join('\n')).toContain('reason=withdrawn:run-stopped');
    });

    it('a room replaced while it is held withdraws it: nothing is written into, or recorded in, the new room', async () => {
      const held = holdNextCreate();
      const { sending } = await sendCarded();
      await until(held.reached);

      harness.session.reset();
      held.release();
      await sending;

      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
    });

    it('disposing the room handler while it is held withdraws it, and starts nothing after', async () => {
      const held = holdNextCreate();
      const { sending } = await sendCarded();
      await until(held.reached);
      const calls = harness.service.continueConversation.mock.calls.length + harness.service.startWorkshopPersonaConversation.mock.calls.length;

      harness.handler.dispose();
      held.release();
      await sending;
      await tick();

      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
      expect(harness.service.continueConversation.mock.calls.length + harness.service.startWorkshopPersonaConversation.mock.calls.length).toBe(calls);
    });
  });
});
