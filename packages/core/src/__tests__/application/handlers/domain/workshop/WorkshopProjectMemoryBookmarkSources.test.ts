/**
 * Bookmark Recall Slice 3 (ADR 2026-11-05 D9, D10) through the real router,
 * slice composition and library:
 *
 * - "Remember this" on a saved session's bookmark
 *   (`WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY`): the turn checked through recall,
 *   the session and turn written as the memory's source, through Project
 *   Memory's queue, and every refusal writing nothing;
 * - the live route's room check (`roomRevision`, PR #214 F-03);
 * - a persona's proposal that cites open-room turns: the host keeps those
 *   the room holds and drops the rest, by id.
 *
 * *Alice*, made-up ids.
 */

import { MessageType, type WorkshopMemoryDraft, type WorkshopTurn } from '@messages';
import type { WorkshopBookmarkBrowserPort } from '@handlers/domain/workshop/WorkshopBookmarkBrowserHandler';
import { WORKSHOP_SAVED_TURN_MEMORY_REFUSALS } from '@handlers/domain/workshop/WorkshopSavedTurnMemoryHandler';
import { WORKSHOP_MEMORY_ROOM_CHANGED } from '@handlers/domain/workshop/WorkshopProjectMemoryRefusals';
import type { WorkshopRecallSavedTurn } from '@/application/services/workshop/recall/WorkshopRecallSavedTurn';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { MEMORY } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

const SAVED_SESSION = 'saved-alice-0042';
const SAVED_TURN = 'turn-7-assistant-1762179725000';

const draft = (changes: Partial<WorkshopMemoryDraft> = {}): WorkshopMemoryDraft => ({
  title: 'The Duchess keeps a pig',
  kind: 'canon',
  summary: 'The baby Alice carries out of the Duchess\'s kitchen turns into a pig.',
  body: '',
  supersedes: [],
  pinned: false,
  ...changes
});

describe('Workshop routes — memories from bookmarks (Bookmark Recall Slice 3)', () => {
  let harness: WorkshopRouteTestHarness;
  let savedTurn: jest.Mock;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const results = () => harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).map((entry) => entry.payload);
  const memoryFiles = () => [...harness.memory.fileSystem.files.keys()].filter((file) => file.startsWith(MEMORY) && file.endsWith('.md'));
  const ledger = () => harness.session.readRoomLedger();
  const receipts = () => ledger().filter((turn) => turn.projectMemoryReceipt);
  const logLines = () => (harness.log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
  const savedMemory = async (memoryId: string) => {
    const read = await harness.memory.store.read(memoryId);
    if (read.kind !== 'memory') {
      throw new Error(`memory ${memoryId} was not saved`);
    }
    return read.entry.memory;
  };

  const turnFound = (overrides: Partial<Extract<WorkshopRecallSavedTurn, { kind: 'turn' }>> = {}): WorkshopRecallSavedTurn => ({
    kind: 'turn',
    sessionId: SAVED_SESSION,
    title: 'The Duchess\'s kitchen',
    turnId: SAVED_TURN,
    position: 7,
    entry: { kind: 'reply', turnId: SAVED_TURN, timestamp: 1, speaker: 'Jill', content: 'The baby sneezes, then it is a pig.' } as never,
    bookmarkable: true,
    ...overrides
  });

  let sent = 0;
  /** The writer sends `text`; the host answers `answer` (the first exchange starts its conversation). */
  async function send(text: string, answer: string): Promise<WorkshopTurn> {
    sent += 1;
    const call = sent === 1 ? harness.service.startWorkshopPersonaConversation : harness.service.continueConversation;
    call.mockResolvedValueOnce(analysisResult(answer, { conversationId: 'host-conv' }) as never);
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text });
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
    return ledger().filter((turn) => turn.role === 'assistant').at(-1)!;
  }

  beforeEach(async () => {
    sent = 0;
    savedTurn = jest.fn(async () => turnFound());
    harness = createWorkshopRouteTestHarness({
      bookmarkBrowser: () => ({
        bookmarkPage: jest.fn(),
        liveRoomBookmarks: jest.fn(),
        savedTurn
      }) as unknown as WorkshopBookmarkBrowserPort
    });
    await harness.pin();
  });

  describe('a saved session\'s bookmark (D9)', () => {
    it('checks the turn through recall and writes the session and turn as the memory\'s source, with a receipt', async () => {
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 's1', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });

      expect(savedTurn).toHaveBeenCalledWith(SAVED_SESSION, SAVED_TURN);
      const [result] = results();
      expect(result).toMatchObject({ requestId: 's1', ok: true, memoryId: expect.stringMatching(/^mem-[0-9a-f]{6}$/) });
      expect(memoryFiles()).toHaveLength(1);
      expect(await savedMemory(result.memoryId!)).toMatchObject({
        origin: 'writer',
        sourceSession: SAVED_SESSION,
        sourceTurns: [SAVED_TURN],
        title: 'The Duchess keeps a pig'
      });
      expect(receipts()).toHaveLength(1);
      expect(receipts()[0].projectMemoryReceipt).toMatchObject({ action: 'saved', memoryId: result.memoryId, by: 'writer' });
      expect(logLines().join('\n')).not.toContain('pig');
    });

    it('after saving, the memory manager names its source by the saved session\'s title', async () => {
      harness.memory.positionsOf.mockImplementation(async (sessionId: string) => sessionId === SAVED_SESSION
        ? { kind: 'positions', sessionId, title: 'The Duchess\'s kitchen', positions: [] }
        : { kind: 'unknown-session' });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 's1', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });
      const [result] = results();

      const listing = await harness.memory.library.managerListing('');
      expect(listing.memories.find((entry) => entry.id === result.memoryId)?.source).toEqual({ kind: 'session', title: 'The Duchess\'s kitchen' });
      const read = await harness.memory.library.read([result.memoryId!]);
      expect(read.kind === 'read' && read.items[0]).toMatchObject({ provenance: { kind: 'recallable', title: 'The Duchess\'s kitchen' } });
      expect(harness.memory.positionsOf).toHaveBeenCalledWith(SAVED_SESSION, [SAVED_TURN], undefined);
    });

    it.each([
      ['unknown-session', WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unknownSession],
      ['unknown-turn', WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unknownTurn],
      ['unreadable', WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unreadable],
      ['ambiguous-session', WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.ambiguousSession],
      ['live-session', WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.liveSession]
    ] as const)('refuses %s with nothing written', async (kind, error) => {
      savedTurn.mockResolvedValueOnce({ kind });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 's2', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });

      expect(results()).toEqual([{ requestId: 's2', ok: false, error }]);
      expect(memoryFiles()).toEqual([]);
      expect(receipts()).toEqual([]);
      expect(logLines()).toContain(`[WorkshopSavedTurnMemoryHandler] saved turn sessionId=${SAVED_SESSION} turnId=${SAVED_TURN} refused reason=${kind}`);
    });

    it('refuses a turn no bookmark may mark, an id the memory format can\'t hold, and recall being unavailable, with nothing written', async () => {
      savedTurn.mockResolvedValueOnce(turnFound({ entry: { kind: 'event', turnId: SAVED_TURN, timestamp: 1, text: 'Session renamed' } as never, bookmarkable: false }));
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e1', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e2', sessionId: SAVED_SESSION, turnId: 'current@x/bookmark-1', draft: draft() });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e3', sessionId: '../escape', turnId: SAVED_TURN, draft: draft() });
      savedTurn.mockResolvedValueOnce({ available: false, reason: 'multi-root' });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e4', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });
      savedTurn.mockRejectedValueOnce(new Error('disk'));
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e5', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() });
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'e6', sessionId: SAVED_SESSION, draft: draft() });

      expect(results().map(({ requestId, ok, error }) => [requestId, ok, error])).toEqual([
        ['e1', false, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.notEligible],
        ['e2', false, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.notEligible],
        ['e3', false, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.notEligible],
        ['e4', false, 'Saved sessions need a single-folder workspace.'],
        ['e5', false, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.unreadable],
        ['e6', false, WORKSHOP_SAVED_TURN_MEMORY_REFUSALS.malformed]
      ]);
      // Neither malformed id reached recall.
      expect(savedTurn).toHaveBeenCalledTimes(3);
      expect(memoryFiles()).toEqual([]);
    });

    it('saves through the library\'s write path: the draft check, and a refusal while a reply runs', async () => {
      await route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, {
        requestId: 'q1', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft({ title: '' })
      });
      expect(results()[0]).toMatchObject({ requestId: 'q1', ok: false });
      expect(memoryFiles()).toEqual([]);

      // Two at once go one after another through the single writer: two files, two receipts.
      await Promise.all([
        route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'q2', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft() }),
        route(MessageType.WORKSHOP_SAVE_SAVED_TURN_TO_MEMORY, { requestId: 'q3', sessionId: SAVED_SESSION, turnId: SAVED_TURN, draft: draft({ title: 'The pig wanders off' }) })
      ]);
      expect(memoryFiles()).toHaveLength(2);
      expect(receipts()).toHaveLength(2);
      expect(new Set(results().slice(1).map((result) => result.memoryId)).size).toBe(2);
    });
  });

  describe('a live bookmark outside the window (D9, PR #214 F-03)', () => {
    it('saves the turn from the full ledger for the room it names, and refuses another room', async () => {
      const turn = await send('Does the Cat stay?', 'Only the grin stays.');
      const roomRevision = harness.session.readRoomRevision();

      await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId: 'l1', turnId: turn.id, roomRevision: roomRevision + 1, draft: draft() });
      expect(results()).toEqual([{ requestId: 'l1', ok: false, error: WORKSHOP_MEMORY_ROOM_CHANGED }]);
      expect(memoryFiles()).toEqual([]);

      await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, { requestId: 'l2', turnId: turn.id, roomRevision, draft: draft() });
      const saved = results()[1];
      expect(saved).toMatchObject({ requestId: 'l2', ok: true });
      expect(await savedMemory(saved.memoryId!)).toMatchObject({ origin: 'writer', sourceSession: 'live-room-0001', sourceTurns: [turn.id] });
    });
  });

  describe('a proposal that cites open-room turns (D10)', () => {
    const cites = (...ids: string[]) => ids.map((id) => `<cites-turn>${id}</cites-turn>`).join('\n');

    it('saves the cited turns the room holds as sources, after the writer\'s message and the reply, and drops the rest by id', async () => {
      const earlier = await send('The Duchess sneezes?', 'Pepper everywhere.');
      const earlierWriter = ledger().find((turn) => turn.participant === 'writer')!;
      const carded = await send('Remember the pig?', `Yes.\n\n${memoryFrame({ extra: cites(
        earlier.id,
        earlierWriter.id,
        'turn-999-user-1',
        `current@live-room-0001/bookmark-1-1`,
        `${SAVED_SESSION}/bookmark-2-2`,
        earlier.id
      ) })}`);
      expect(carded.memoryProposals?.[0]).toMatchObject({ proposes: 'new', cites: expect.arrayContaining([earlier.id]) });

      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'p1', turnId: carded.id, index: 0, action: 'save' });
      const [result] = results();
      expect(result.ok).toBe(true);
      const prompted = ledger().filter((turn) => turn.participant === 'writer').at(-1)!;
      const memory = await savedMemory(result.memoryId!);
      expect(memory.sourceSession).toBe('live-room-0001');
      expect(memory.sourceTurns).toEqual([prompted.id, carded.id, earlier.id, earlierWriter.id]);
      const dropped = logLines().find((line) => line.includes('cited turns dropped'));
      expect(dropped).toBe(`[WorkshopProjectMemoryHandler] cited turns dropped turnId=${carded.id} ` +
        `turn-999-user-1:not-in-room,current@live-room-0001/bookmark-1-1:not-a-turn,${SAVED_SESSION}/bookmark-2-2:not-a-turn`);
    });

    it('the reopened memory asks recall for every source, the cited turns included', async () => {
      const earlier = await send('The Duchess sneezes?', 'Pepper everywhere.');
      const carded = await send('Remember the pig?', `Yes.\n\n${memoryFrame({ extra: cites(earlier.id) })}`);
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'p1', turnId: carded.id, index: 0, action: 'save' });
      const [result] = results();
      const prompted = ledger().filter((turn) => turn.participant === 'writer').at(-1)!;

      // Another room is open now: the source is a saved session, read through recall.
      harness.memory.state.scope = { available: true, liveSessionId: 'another-room-0002' } as never;
      harness.memory.positionsOf.mockClear();
      const read = await harness.memory.library.read([result.memoryId!]);
      expect(read.kind).toBe('read');
      expect(harness.memory.positionsOf).toHaveBeenCalledWith('live-room-0001', [prompted.id, carded.id, earlier.id], undefined);
    });

    it('a proposal that cites nothing saves exactly as before', async () => {
      const carded = await send('Remember the pig?', `Yes.\n\n${memoryFrame()}`);
      expect(carded.memoryProposals?.[0]).not.toHaveProperty('cites');
      await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'p1', turnId: carded.id, index: 0, action: 'save' });
      const memory = await savedMemory(results()[0].memoryId!);
      const prompted = ledger().filter((turn) => turn.participant === 'writer').at(-1)!;
      expect(memory.sourceTurns).toEqual([prompted.id, carded.id]);
      expect(logLines().some((line) => line.includes('cited turns dropped'))).toBe(false);
    });
  });
});
