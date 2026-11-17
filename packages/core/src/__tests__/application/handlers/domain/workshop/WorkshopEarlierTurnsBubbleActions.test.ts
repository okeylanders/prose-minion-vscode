/**
 * An earlier bubble is a full bubble (ADR 2026-11-17 D6): each bubble
 * action's existing route, through the real router, room handler and slice
 * composition, on a turn that has left the snapshot window. The page read
 * through `WORKSHOP_REQUEST_EARLIER_TURNS` shows the turn before the action
 * and what the action changed after it.
 *
 * The room is built by real sends: one reply with a file-edit card, one with
 * a memory card, then enough exchanges to push both outside the window.
 * *Alice*, made-up paths.
 */

import {
  MessageType,
  type WorkshopEarlierTurnsPage,
  type WorkshopSessionSnapshot,
  type WorkshopTurn
} from '@messages';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import {
  fakeFileEditApply,
  fakeFileEditStaging,
  fileEditFrame
} from '@/__tests__/application/services/workshop/fileEdits/fileEditFixtures';
import { memoryFrame } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { analysisResult, createWorkshopRouteTestHarness, message, type WorkshopRouteTestHarness } from './WorkshopRouteTestHarness';

describe('Workshop routes on a turn outside the snapshot window (D6)', () => {
  let harness: WorkshopRouteTestHarness;
  let apply: ReturnType<typeof fakeFileEditApply>;
  let editReply: WorkshopTurn;
  let memoryReply: WorkshopTurn;
  let plainReply: WorkshopTurn;
  let writerTurn: WorkshopTurn;
  let requests = 0;

  const route = (type: MessageType, payload: unknown) => harness.router.route(message(type, payload) as never);
  const settle = async () => {
    for (let round = 0; round < 8; round += 1) {
      await new Promise((resolve) => setImmediate(resolve));
    }
  };
  const ledger = () => harness.session.readRoomLedger();
  const stored = (turn: WorkshopTurn) => ledger().find((each) => each.id === turn.id)!;
  const snapshot = (): WorkshopSessionSnapshot => harness.posted(MessageType.WORKSHOP_SESSION_STATE).at(-1).payload.session;
  const revision = () => harness.session.readRoomRevision();
  /** Every turn before the window, read page by page through the route. */
  const earlierTurns = async (): Promise<WorkshopEarlierTurnsPage> => {
    const pages: WorkshopEarlierTurnsPage[] = [];
    let beforeTurnId = harness.session.getSnapshot().turns[0].id;
    for (;;) {
      requests += 1;
      await route(MessageType.WORKSHOP_REQUEST_EARLIER_TURNS, { requestId: `page-${requests}`, roomRevision: revision(), beforeTurnId });
      const answer = harness.posted(MessageType.WORKSHOP_EARLIER_TURNS).at(-1).payload;
      expect(answer.requestId).toBe(`page-${requests}`);
      pages.unshift(answer.page);
      if (answer.page.remainingBefore === 0) {
        break;
      }
      beforeTurnId = answer.page.turns[0].id;
    }
    return {
      turns: pages.flatMap((page) => page.turns),
      turnRewindability: Object.assign({}, ...pages.map((page) => page.turnRewindability)),
      reactions: pages.flatMap((page) => page.reactions),
      widgetConfigs: pages.flatMap((page) => page.widgetConfigs),
      remainingBefore: 0
    };
  };
  const inPage = (page: WorkshopEarlierTurnsPage, turn: WorkshopTurn) => page.turns.find((each) => each.id === turn.id)!;

  beforeAll(async () => {
    apply = fakeFileEditApply();
    harness = createWorkshopRouteTestHarness({ fileEditStaging: fakeFileEditStaging(), fileEditApply: apply });
    await harness.pin();
    harness.service.startWorkshopPersonaConversation.mockResolvedValueOnce(
      analysisResult(`She is ten now.\n\n${fileEditFrame()}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'Alice\'s age?' });
    await settle();
    harness.service.continueConversation.mockResolvedValueOnce(
      analysisResult(`Good.\n\n${memoryFrame()}`, { conversationId: 'host-conv' }) as never
    );
    await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: 'So the watch runs backward?' });
    await settle();
    for (let exchange = 0; exchange < WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 2; exchange += 1) {
      await route(MessageType.WORKSHOP_SEND_MESSAGE, { text: `Tea question ${exchange + 1}.` });
    }
    await settle();
    editReply = ledger().find((turn) => turn.fileEditProposals?.length)!;
    memoryReply = ledger().find((turn) => turn.memoryProposals?.length)!;
    const early = ledger().slice(0, 12);
    plainReply = early.find((turn) => turn.participant === 'host' && turn.content === 'continued reply')!;
    writerTurn = early.find((turn) => turn.participant === 'writer' && turn.content.startsWith('Tea question'))!;
  }, 120_000);

  it('built a room whose carded turns are outside the window', () => {
    const window = new Set(harness.session.getSnapshot().turns.map((turn) => turn.id));
    expect(harness.session.getSnapshot().truncatedTurns).toBeGreaterThan(0);
    for (const turn of [editReply, memoryReply, plainReply, writerTurn]) {
      expect(turn).toBeDefined();
      expect(window.has(turn.id)).toBe(false);
    }
    expect(stored(editReply).fileEditProposals?.[0].state).toBe('pending');
    expect(stored(memoryReply).memoryProposals?.[0].state).toBe('pending');
  });

  it('a page carries the earlier bubbles with their cards and the host\'s verdicts', async () => {
    const page = await earlierTurns();

    expect(page.turns.map((turn) => turn.id)).toEqual(
      ledger().slice(0, ledger().length - WORKSHOP_SNAPSHOT_TURN_WINDOW).map((turn) => turn.id)
    );
    expect(inPage(page, editReply).fileEditProposals?.[0].state).toBe('pending');
    expect(inPage(page, memoryReply).memoryProposals?.[0].state).toBe('pending');
    // The verdicts are the host's, for turns the snapshot's own map does not hold.
    expect(page.turnRewindability[plainReply.id]).toBeDefined();
    expect(page.turnRewindability[writerTurn.id]).toBeDefined();
    expect(harness.session.getSnapshot().turnRewindability[plainReply.id]).toBeUndefined();
  });

  it('Rewind maps the earlier bubble to its cut and asks the coordinator', async () => {
    harness.persistence.rewindTo.mockRejectedValue(new Error('stop here'));

    await route(MessageType.WORKSHOP_REWIND_SESSION, { turnId: plainReply.id });
    await route(MessageType.WORKSHOP_REWIND_SESSION, { turnId: writerTurn.id });

    expect(harness.persistence.rewindTo.mock.calls.map(([cut]) => cut)).toEqual([
      { kind: 'afterTurn', turnId: plainReply.id },
      { kind: 'beforeTurn', turnId: writerTurn.id }
    ]);
  });

  it('Branch maps the earlier bubble to its cut and asks the coordinator', async () => {
    harness.persistence.branchFrom.mockRejectedValue(new Error('stop here'));

    await route(MessageType.WORKSHOP_BRANCH_SESSION, { turnId: plainReply.id });

    expect(harness.persistence.branchFrom.mock.calls.at(-1)?.[0]).toEqual({ kind: 'afterTurn', turnId: plainReply.id });
  });

  it('a reaction lands on the earlier reply, and the next page carries its summary', async () => {
    await route(MessageType.WORKSHOP_SET_TURN_REACTION, { turnId: plainReply.id, reaction: 'heart', reacted: true });

    expect(snapshot().reactions.some((summary) => summary.turnId === plainReply.id)).toBe(false);
    const page = await earlierTurns();
    expect(page.reactions.filter((summary) => summary.turnId === plainReply.id)).toEqual([
      expect.objectContaining({ turnId: plainReply.id, reaction: 'heart', author: { kind: 'writer' } })
    ]);
  });

  it('a bookmark lands on the earlier reply, marked outside the window', async () => {
    await route(MessageType.WORKSHOP_SET_TURN_BOOKMARK, { turnId: plainReply.id, bookmarked: true });

    expect(snapshot().bookmarks).toEqual([expect.objectContaining({ turnId: plainReply.id, inWindow: false })]);
  });

  it('Apply settles the earlier reply\'s file-edit card, and the next page shows it applied', async () => {
    await route(MessageType.WORKSHOP_FILE_EDIT_ACTION, {
      requestId: 'apply-1', roomRevision: revision(), turnId: editReply.id, index: 0, action: 'apply'
    });
    await settle();

    expect(harness.posted(MessageType.WORKSHOP_FILE_EDIT_RESULT).at(-1).payload)
      .toMatchObject({ requestId: 'apply-1', answer: 'settled', state: 'applied' });
    expect(apply.applies).toHaveLength(1);
    const page = await earlierTurns();
    expect(inPage(page, editReply).fileEditProposals?.[0].state).toBe('applied');
    expect(JSON.stringify(page)).not.toContain('documentUri');
  });

  it('Save settles the earlier reply\'s memory card, and the next page shows it saved', async () => {
    await route(MessageType.WORKSHOP_MEMORY_PROPOSAL_ACTION, { requestId: 'save-1', turnId: memoryReply.id, index: 0, action: 'save' });
    await settle();

    const result = harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).at(-1).payload;
    expect(result).toMatchObject({ requestId: 'save-1', ok: true });
    const page = await earlierTurns();
    expect(inPage(page, memoryReply).memoryProposals?.[0]).toMatchObject({ state: 'saved', memoryId: result.memoryId });
  });

  it('Save to memory… takes the earlier reply as its source', async () => {
    await route(MessageType.WORKSHOP_SAVE_TURN_TO_MEMORY, {
      requestId: 'turn-1',
      turnId: plainReply.id,
      roomRevision: revision(),
      draft: {
        title: 'Tea is served at six',
        kind: 'decision',
        summary: 'The Hatter\'s table stays set for six o\'clock tea.',
        body: 'Every scene that visits the table keeps it.',
        supersedes: [],
        pinned: false
      }
    });
    await settle();

    const result = harness.posted(MessageType.WORKSHOP_MEMORY_WRITE_RESULT).at(-1).payload;
    expect(result).toMatchObject({ requestId: 'turn-1', ok: true });
    const saved = await harness.memory.store.read(result.memoryId);
    expect(saved.kind === 'memory' && saved.entry.memory.sourceTurns).toContain(plainReply.id);
  });
});
