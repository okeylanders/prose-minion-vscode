/**
 * A long room's earlier turns, read from the real aggregate (ADR 2026-11-17
 * D1–D3, D6) over the scripted room:
 *
 * - a page's turn carries exactly what the snapshot gives the same turn;
 * - a page stops at its turn bound and at its byte bound, and always holds
 *   one turn;
 * - paging back reaches the room's first turn, every turn once, in order;
 * - a read changes nothing;
 * - Rewind and Branch act on a turn outside the window, from the page's
 *   verdict, through the real coordinator.
 *
 * *Alice*-style made-up lines.
 */

import type { WorkshopTurn } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopModelsBeforeWindow } from '@shared/workshop/workshopModelSlices';
import { WORKSHOP_SNAPSHOT_TURN_WINDOW } from '@/application/services/workshop/WorkshopSessionService';
import {
  workshopEarlierTurnsTake,
  workshopTurnBytes
} from '@/application/services/workshop/session/WorkshopThreadTurnParts';
import { WorkshopTurnLedger } from '@/application/services/workshop/session/WorkshopTurnLedger';
import { longScriptedRoom } from './longScriptedRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const ids = (turns: readonly Pick<WorkshopTurn, 'id'>[]) => turns.map((turn) => turn.id);

describe('one projection for the window and a page (D2)', () => {
  it('gives a page\'s turn exactly what the snapshot gives the same turn', () => {
    // 60 exchanges and a widget commit: everything is still inside the window, so both paths hold every turn.
    const { room, replies } = longScriptedRoom(30);
    const widgetTurn = room.hostWidgetCommit();
    replies.push(...Array.from({ length: 30 }, (_, index) => room.hostMessage(`Later question ${index + 1}.`)));
    const { session } = room;
    expect(session.setWriterReaction(replies[5].id, 'mind-blown', true)).toBe('added');
    expect(session.setWriterReaction(replies[40].id, 'heart', true)).toBe('added');

    const snapshot = session.getSnapshot();
    expect(snapshot.truncatedTurns).toBe(0);
    const head = snapshot.turns.at(-1)!;
    const page = session.readEarlierTurns(head.id)!;

    expect(page.turns.length).toBe(PROMPT_BUDGETS.workshopThread.pageTurns);
    const pageIds = new Set(ids(page.turns));
    expect(pageIds.has(widgetTurn.id) || snapshot.turns.some((turn) => turn.widgetCommit && pageIds.has(turn.id))).toBe(true);
    // The turns themselves.
    expect(page.turns).toEqual(snapshot.turns.filter((turn) => pageIds.has(turn.id)));
    // The host's Rewind verdicts.
    expect(page.turnRewindability).toEqual(Object.fromEntries(
      Object.entries(snapshot.turnRewindability).filter(([turnId]) => pageIds.has(turnId))
    ));
    expect(Object.keys(page.turnRewindability).length).toBeGreaterThan(0);
    // The reaction summaries.
    expect(page.reactions).toEqual(snapshot.reactions.filter((summary) => pageIds.has(summary.turnId)));
    expect(page.reactions.map((summary) => summary.turnId)).toContain(replies[40].id);
    // The widget-config summaries, for the page's own commits.
    const pageConfigIds = new Set(page.turns.flatMap((turn) => turn.widgetCommit ? [turn.widgetCommit.widgetConfigId] : []));
    expect(pageConfigIds.size).toBeGreaterThan(0);
    expect(page.widgetConfigs).toEqual(snapshot.widgetConfigs.filter((config) => pageConfigIds.has(config.id)));
  });

  it('seeds the page\'s model slices as the window\'s are seeded', () => {
    const { room } = longScriptedRoom(8);
    const { session } = room;
    const ledger = session.readRoomLedger();
    const page = session.readEarlierTurns(ledger.at(-1)!.id, { pageTurns: 4, pageBytes: Number.MAX_SAFE_INTEGER })!;

    expect(page.remainingBefore).toBe(ledger.length - 1 - 4);
    expect(page.modelsBefore).toEqual(workshopModelsBeforeWindow(ledger, page.remainingBefore));
  });
});

describe('a page\'s bounds (D3)', () => {
  it('stops at the turn bound, ending directly before the turn named', () => {
    const { room } = longScriptedRoom(8);
    const ledger = room.session.readRoomLedger();
    const from = ledger[10];

    const page = room.session.readEarlierTurns(from.id, { pageTurns: 3, pageBytes: Number.MAX_SAFE_INTEGER })!;

    expect(ids(page.turns)).toEqual(ids(ledger.slice(7, 10)));
    expect(page.remainingBefore).toBe(7);
  });

  it('stops at the byte bound, counting back from the newest turn', () => {
    const { room } = longScriptedRoom(8);
    const ledger = room.session.readRoomLedger();
    const from = ledger[10];
    const twoNewest = workshopTurnBytes(ledger[9]) + workshopTurnBytes(ledger[8]);

    const page = room.session.readEarlierTurns(from.id, { pageTurns: 100, pageBytes: twoNewest })!;

    expect(ids(page.turns)).toEqual(ids(ledger.slice(8, 10)));
    expect(page.remainingBefore).toBe(8);
  });

  it('sends a turn larger than the byte bound alone, so paging still makes progress', () => {
    const { room } = longScriptedRoom(4);
    const ledger = room.session.readRoomLedger();

    const page = room.session.readEarlierTurns(ledger[5].id, { pageTurns: 100, pageBytes: 1 })!;

    expect(ids(page.turns)).toEqual([ledger[4].id]);
    expect(page.remainingBefore).toBe(4);
  });

  it('measures bytes as the caller says the turns will be sent', () => {
    const take = workshopEarlierTurnsTake({ pageTurns: 100, pageBytes: 10, bytesOf: () => 4 });
    const turn = {} as WorkshopTurn;

    expect([take(turn, 0), take(turn, 1), take(turn, 2)]).toEqual([true, true, false]);
  });

  it('holds the documented defaults: 100 turns, 1 MiB, beside a 200-turn window', () => {
    expect(PROMPT_BUDGETS.workshopThread).toEqual({ pageTurns: 100, pageBytes: 1024 * 1024, jumpPages: 3 });
    expect(WORKSHOP_SNAPSHOT_TURN_WINDOW).toBe(200);
  });

  it('answers nothing for a turn the room does not hold, and an empty page at the first turn', () => {
    const { room } = longScriptedRoom(2);
    const ledger = room.session.readRoomLedger();

    expect(room.session.readEarlierTurns('turn-999-user-1')).toBeUndefined();
    expect(room.session.readEarlierTurns(ledger[0].id)).toEqual({
      turns: [], turnRewindability: {}, reactions: [], widgetConfigs: [], remainingBefore: 0
    });
  });
});

describe('the ledger\'s read before a turn', () => {
  const turn = (id: string): WorkshopTurn => ({
    id, role: 'user', participant: 'writer', kind: 'message', content: id, timestamp: 1, excerptVersion: 0
  } as WorkshopTurn);

  it('walks back while the caller keeps taking, and returns copies', () => {
    const ledger = new WorkshopTurnLedger(() => 1);
    ['a', 'b', 'c', 'd'].forEach((id) => ledger.append(turn(id)));
    const seen: Array<[string, number]> = [];

    const read = ledger.before('d', (candidate, taken) => {
      seen.push([candidate.id, taken]);
      return taken < 2;
    })!;

    expect(seen).toEqual([['c', 0], ['b', 1], ['a', 2]]);
    expect(ids(read.turns)).toEqual(['b', 'c']);
    expect(read.remainingBefore).toBe(1);
    read.turns[0].content = 'changed';
    expect(ledger.find('b')?.content).toBe('b');
    expect(ledger.before('nope', () => true)).toBeUndefined();
  });
});

describe('a room longer than the window', () => {
  // 106 exchanges and the start marker: 213 turns, 13 of them outside the window.
  const build = () => longScriptedRoom(106);

  it('pages back to the room\'s first turn: every turn once, in order', () => {
    const { room } = build();
    const { session } = room;
    const ledger = session.readRoomLedger();
    const snapshot = session.getSnapshot();
    expect(snapshot.truncatedTurns).toBe(ledger.length - WORKSHOP_SNAPSHOT_TURN_WINDOW);
    expect(snapshot.truncatedTurns).toBeGreaterThan(0);

    let thread = [...snapshot.turns];
    let remaining = snapshot.truncatedTurns;
    let pages = 0;
    while (remaining > 0) {
      const page = session.readEarlierTurns(thread[0].id, { pageTurns: 5, pageBytes: Number.MAX_SAFE_INTEGER })!;
      expect(page.turns.length).toBeGreaterThan(0);
      thread = [...page.turns, ...thread];
      remaining = page.remainingBefore;
      pages += 1;
    }

    expect(pages).toBe(Math.ceil(snapshot.truncatedTurns / 5));
    expect(ids(thread)).toEqual(ids(ledger));
  });

  it('reads without changing the room', () => {
    const { room } = build();
    const { session } = room;
    const before = JSON.stringify(session.exportCommittedState());
    const revision = session.readRoomRevision();

    const page = session.readEarlierTurns(session.getSnapshot().turns[0].id)!;
    page.turns[0].content = 'changed by the reader';

    expect(JSON.stringify(session.exportCommittedState())).toBe(before);
    expect(session.readRoomRevision()).toBe(revision);
  });

  async function opened() {
    const { room } = build();
    const harness = setupCoordinator();
    await harness.store.saveNamed(scriptedCheckpoint('long-room', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('long-room');
    const snapshot = harness.session.getSnapshot();
    const page = harness.session.readEarlierTurns(snapshot.turns[0].id)!;
    // A reply outside the window whose page verdict says it can be rewound to.
    const target = page.turns.find((turn) => turn.role === 'assistant' && page.turnRewindability[turn.id]?.available)!;
    expect(target).toBeDefined();
    expect(ids(snapshot.turns)).not.toContain(target.id);
    expect(snapshot.turnRewindability[target.id]).toBeUndefined();
    return { ...harness, target, page };
  }

  it('Rewind acts on a turn outside the window, from the page\'s verdict (D6)', async () => {
    const { coordinator, session, target } = await opened();
    const cut = session.rewindCutForBubble(target.id)!;
    expect(cut).toEqual({ kind: 'afterTurn', turnId: target.id });

    await coordinator.rewindTo(cut, { origin: 'writer' });

    const ledger = session.readRoomLedger();
    expect(ledger.at(-1)?.id).toBe(target.id);
    expect(session.getSnapshot().truncatedTurns).toBe(0);
  });

  it('Branch acts on a turn outside the window, and leaves the source room\'s file alone (D6)', async () => {
    const { coordinator, session, store, fs, target } = await opened();
    const sourcePath = await store.resolveRevealPath('long-room');
    const sourceBefore = new TextDecoder().decode(await fs.readFile(sourcePath));

    const sourceTurnIds = ids(session.readRoomLedger());
    const outcome = await coordinator.branchFrom(session.rewindCutForBubble(target.id)!);

    expect(outcome.branch.sessionId).not.toBe('long-room');
    expect((await store.readNamed(outcome.branch.sessionId))?.workshop.turns.at(-1)?.id).toBe(target.id);
    expect(ids(session.readRoomLedger())).toEqual(sourceTurnIds);
    expect(new TextDecoder().decode(await fs.readFile(sourcePath))).toBe(sourceBefore);
  });
});
