/**
 * Several suggestions on one reply (epic Slice 6b; ADR 2026-11-04 addendum
 * of 2026-11-05), through the real router, room handler, completion, slice
 * composition and library:
 *
 * - Ask first: each card is its own, acted on by its index in any order,
 *   with its own receipt; one in flight never blocks another.
 * - Save and tell me: a reply's cards save one after another, in order,
 *   each with its own receipt; a batch fills the room's cap and the rest
 *   are held; web research holds every card; a supersession is never saved
 *   automatically, and writes nothing.
 *
 * *Alice*, made-up ids.
 */

import { MessageType, type WorkshopTurn } from '@messages';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { MEMORY } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const BODY_SENTINEL = 'MULTI-BODY-ONLY-IN-THE-FILE';
const CAP = PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom;

describe('Workshop routes — several memory suggestions on one reply', () => {
  let harness: WorkshopRouteTestHarness;
  let sent = 0;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).map((entry) => entry.payload);
  const memoryFiles = () => [...harness.memory.fileSystem.files.keys()].filter((file) => file.startsWith(MEMORY) && file.endsWith('.md'));
  const ledger = () => harness.session.readRoomLedger();
  const receipts = () => ledger().filter((turn) => turn.projectMemoryReceipt);
  const cards = (turnId: string) => ledger().find((turn) => turn.id === turnId)?.memoryProposals ?? [];
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  /** Trailers by title; `supersedes[i]` names what the i-th one replaces. */
  const frames = (titles: string[], supersedes: Array<string[] | undefined> = []) => titles
    .map((title, index) => memoryFrame({ title, body: BODY_SENTINEL, supersedes: supersedes[index] }))
    .join('\n');

  /** The host replies with prose and `trailers`; returns the reply once its saves (if any) settle. */
  async function reply(trailers: string, extra: Record<string, unknown> = {}): Promise<WorkshopTurn> {
    sent += 1;
    const call = sent === 1 ? harness.service.startWorkshopPersonaConversation : harness.service.continueConversation;
    call.mockResolvedValueOnce(analysisResult(`Good.\n\n${trailers}`, { conversationId: 'host-conv', ...extra }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: `What did we settle? (${sent})` });
    await settle();
    return [...ledger()].reverse().find((turn) => turn.memoryProposals)!;
  }

  beforeEach(async () => {
    sent = 0;
    harness = createWorkshopRouteTestHarness();
    await harness.pin();
  });

  describe('Ask first', () => {
    it('shows each suggestion as its own pending card, in order, and the bubble only the prose', async () => {
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last', 'The Queen might be bluffing']));
      expect(turn.content).toBe('Good.');
      expect(cards(turn.id).map((card) => [card.proposes, card.title, card.state])).toEqual([
        ['new', 'Tea is at six', 'pending'],
        ['new', 'The Cat grins last', 'pending'],
        ['new', 'The Queen might be bluffing', 'pending']
      ]);
      expect(memoryFiles()).toEqual([]);
    });

    it('acts on each card by its index, in any order: Save the last, Dismiss the first, the middle untouched', async () => {
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last', 'The Queen might be bluffing']));

      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r2', turnId: turn.id, index: 2, action: 'save' });
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'r0', turnId: turn.id, index: 0, action: 'dismiss' });

      expect(cards(turn.id).map((card) => card.state)).toEqual(['dismissed', 'pending', 'saved']);
      expect(memoryFiles()).toHaveLength(1);
      expect(receipts().map((entry) => entry.projectMemoryReceipt?.title)).toEqual(['The Queen might be bluffing']);
      expect(results()).toEqual([
        { requestId: 'r2', ok: true, memoryId: cards(turn.id)[2].memoryId },
        { requestId: 'r0', ok: true }
      ]);
    });

    it('two cards saved at once each write one file and leave one receipt, one per saved memory', async () => {
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last']));

      await Promise.all([
        route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'a', turnId: turn.id, index: 0, action: 'save' }),
        route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'b', turnId: turn.id, index: 1, action: 'save' })
      ]);

      expect(cards(turn.id).map((card) => card.state)).toEqual(['saved', 'saved']);
      expect(memoryFiles()).toHaveLength(2);
      expect(receipts().map((entry) => entry.projectMemoryReceipt?.memoryId).sort())
        .toEqual(cards(turn.id).map((card) => card.memoryId).sort());
      expect(JSON.stringify(receipts())).not.toContain(BODY_SENTINEL);
    });

    it('refuses an index the reply does not hold, and one that is not an index', async () => {
      const turn = await reply(frames(['Tea is at six']));
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'out', turnId: turn.id, index: 1, action: 'save' });
      expect(results()).toEqual([{ requestId: 'out', ok: false, error: 'That message no longer holds a memory suggestion.' }]);
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'bad', turnId: turn.id, index: '0', action: 'save' });
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'neg', turnId: turn.id, index: -1, action: 'save' });
      expect(results()).toHaveLength(1);
      expect(memoryFiles()).toEqual([]);
    });
  });

  describe('Save and tell me', () => {
    beforeEach(() => {
      harness.memory.state.mode = 'auto';
    });

    it('saves each card in order, each with its own receipt by auto after the reply', async () => {
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last', 'The Queen might be bluffing']));

      expect(cards(turn.id).map((card) => card.state)).toEqual(['saved', 'saved', 'saved']);
      expect(memoryFiles()).toHaveLength(3);
      expect(receipts().map((entry) => [entry.projectMemoryReceipt?.title, entry.projectMemoryReceipt?.by])).toEqual([
        ['Tea is at six', 'auto'],
        ['The Cat grins last', 'auto'],
        ['The Queen might be bluffing', 'auto']
      ]);
      expect(receipts().map((entry) => entry.projectMemoryReceipt?.memoryId)).toEqual(cards(turn.id).map((card) => card.memoryId));
    });

    it('a batch fills the room\'s cap, and the rest are held room-cap', async () => {
      const titles = Array.from({ length: CAP + 2 }, (_, index) => `Fact ${index + 1}`);
      const turn = await reply(frames(titles));

      expect(cards(turn.id).map((card) => card.held ?? card.state)).toEqual([
        ...Array<string>(CAP).fill('saved'),
        'room-cap',
        'room-cap'
      ]);
      expect(memoryFiles()).toHaveLength(CAP);
      expect(receipts()).toHaveLength(CAP);
    });

    it('a batch after earlier saves only takes the room\'s places left', async () => {
      await reply(frames(['Fact 1', 'Fact 2', 'Fact 3']));
      const turn = await reply(frames(['Fact 4', 'Fact 5', 'Fact 6']));
      // Three saved already, so two places are left under a cap of five.
      expect(CAP).toBe(5);
      expect(cards(turn.id).map((card) => card.held ?? card.state)).toEqual(['saved', 'saved', 'room-cap']);
      expect(memoryFiles()).toHaveLength(CAP);
    });

    it('web research attached holds every card, and writes nothing', async () => {
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last']), { webResearchAttached: true });
      expect(cards(turn.id).map((card) => card.held)).toEqual(['web-research', 'web-research']);
      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
    });

    it('a supersession always waits for the writer: held, pending, and nothing written', async () => {
      await route(MessageType.WORKSHOP_MEMORY_CREATE, {
        requestId: 'c1',
        draft: { title: 'The watch stops at six', kind: 'canon', summary: 'It stops.', body: '', supersedes: [], pinned: false }
      });
      const old = results()[0].memoryId!;
      const filesBefore = memoryFiles();
      const receiptsBefore = receipts().length;

      const turn = await reply(frames(['The watch runs backward'], [[old]]));

      expect(cards(turn.id)).toEqual([expect.objectContaining({
        state: 'pending',
        held: 'supersedes',
        supersedes: [{ id: old, title: 'The watch stops at six' }]
      })]);
      expect(memoryFiles()).toEqual(filesBefore);
      expect(receipts()).toHaveLength(receiptsBefore);
      const read = await harness.memory.store.read(old);
      expect(read.kind === 'memory' && read.entry.memory.status).toBe('active');
    });

    it('a supersession beside other cards: those save, it waits, and it uses no place under the cap', async () => {
      const turn = await reply(frames(['Tea is at six', 'The watch runs backward', 'The Cat grins last'], [undefined, ['mem-1a9e04']]));
      expect(cards(turn.id).map((card) => card.held ?? card.state)).toEqual(['saved', 'supersedes', 'saved']);
      expect(memoryFiles()).toHaveLength(2);
    });

    it('the writer saves a held supersession by its index', async () => {
      const turn = await reply(frames(['Tea is at six', 'The watch runs backward'], [undefined, ['mem-1a9e04']]));
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'w', turnId: turn.id, index: 1, action: 'save' });
      expect(cards(turn.id).map((card) => card.state)).toEqual(['saved', 'saved']);
      expect(receipts().map((entry) => entry.projectMemoryReceipt?.by)).toEqual(['auto', 'writer']);
    });

    it('a writer\'s Save of a later card while the batch is saving joins its save: one file, one receipt', async () => {
      harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
        analysisResult(`Good.\n\n${frames(['Tea is at six', 'The Cat grins last'])}`, { conversationId: 'host-conv' }) as never
      );
      sent = 1;
      await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Two things?' });
      const turn = ledger().find((candidate) => candidate.memoryProposals)!;
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'j', turnId: turn.id, index: 1, action: 'save' });
      await settle();

      expect(memoryFiles()).toHaveLength(2);
      expect(receipts().map((entry) => entry.projectMemoryReceipt?.by)).toEqual(['auto', 'auto']);
      expect(results()).toEqual([{ requestId: 'j', ok: true, memoryId: cards(turn.id)[1].memoryId }]);
    });

    it('the saves are the tail of their run: the send settles with every card\'s receipt in place (PR #201 F-03)', async () => {
      harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
        analysisResult(`Good.\n\n${frames(['Tea is at six', 'The Cat grins last', 'The Queen might be bluffing'])}`, { conversationId: 'host-conv' }) as never
      );
      sent = 1;
      await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Three things?' });
      // No settling: the send's own promise waited for every save.
      expect(receipts()).toHaveLength(3);
      expect(memoryFiles()).toHaveLength(3);
    });

    it('each card asks its own permit: Save and tell me turned off mid-batch leaves the rest waiting, unwritten (PR #201 F-01)', async () => {
      const append = harness.session.appendMemoryReceipt.bind(harness.session);
      jest.spyOn(harness.session, 'appendMemoryReceipt').mockImplementation((receipt) => {
        const turn = append(receipt);
        harness.memory.state.mode = 'ask';
        return turn;
      });
      const turn = await reply(frames(['Tea is at six', 'The Cat grins last', 'The Queen might be bluffing']));
      expect(cards(turn.id).map((card) => card.state)).toEqual(['saved', 'pending', 'pending']);
      expect(cards(turn.id).map((card) => card.held)).toEqual([undefined, undefined, undefined]);
      expect(memoryFiles()).toHaveLength(1);
      const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');
      expect(lines).toMatch(/auto save turnId=\S+ index=1 card waits reason=withdrawn:mode/);
      expect(lines).toMatch(/auto save turnId=\S+ index=2 card waits reason=withdrawn:mode/);
    });

    it('logs each card by its index, never its text', async () => {
      await reply(frames(['Tea is at six', 'The Cat grins last']));
      const lines = (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line)).join('\n');
      expect(lines).toMatch(/auto save turnId=\S+ index=0 saved memoryId=mem-[0-9a-f]{6} receipt/);
      expect(lines).toMatch(/auto save turnId=\S+ index=1 saved memoryId=mem-[0-9a-f]{6} receipt/);
      expect(lines).not.toContain(BODY_SENTINEL);
      expect(lines).not.toContain('Tea is at six');
    });
  });
});
