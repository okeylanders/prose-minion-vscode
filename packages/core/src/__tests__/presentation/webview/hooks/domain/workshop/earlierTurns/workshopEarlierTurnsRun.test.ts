/**
 * The earlier-turns run as plain data (ADR 2026-11-17 D5): entries keep the
 * host's parts beside each turn; a re-read ends where the run began, moves
 * the model seed over what it leaves out, and stops at its limit; the thread
 * parts leave out what the window already shows. Made-up turns.
 */

import type { WorkshopEarlierTurnsPage, WorkshopTurn } from '@messages';
import {
  WORKSHOP_NO_EARLIER_TURNS,
  workshopEarlierRereadStep,
  workshopEarlierRunCarrying,
  workshopEarlierRunRereadSoFar,
  workshopEarlierRunWithOlderPage,
  workshopEarlierTurnEntries,
  workshopEarlierTurnsShownAnnouncement,
  workshopEarlierTurnsThreadParts
} from '@hooks/domain/workshop/earlierTurns/workshopEarlierTurnsRun';

const turn = (n: number, change: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id: `t${n}`, role: 'assistant', participant: 'host', kind: 'message', content: `line ${n}`, timestamp: n, excerptVersion: 0, ...change
} as WorkshopTurn);
const turns = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => turn(from + index));
const page = (from: number, to: number, change: Partial<WorkshopEarlierTurnsPage> = {}): WorkshopEarlierTurnsPage => ({
  turns: turns(from, to), turnRewindability: {}, reactions: [], widgetConfigs: [], remainingBefore: from - 1, ...change
});
const ids = (entries: readonly { turn: WorkshopTurn }[]) => entries.map((entry) => entry.turn.id);
const stamped = (n: number, modelId: string) =>
  turn(n, { model: { scope: 'assistant', requestedModelId: modelId } } as Partial<WorkshopTurn>);

describe('workshopEarlierTurnEntries', () => {
  it('keeps each turn beside the host\'s verdict, reactions and widget summary for it', () => {
    const commit = turn(2, { widgetCommit: { widgetConfigId: 'wc-1' } } as Partial<WorkshopTurn>);
    const reaction = { turnId: 't1', reaction: 'heart', author: { kind: 'writer' }, label: 'You' } as never;
    const config = { id: 'wc-1', widgetId: 'gesture-playground' } as never;

    const entries = workshopEarlierTurnEntries({
      turns: [turn(1), commit, turn(3)],
      turnRewindability: { t1: { available: true }, t3: { available: false, reason: 'busy' } } as never,
      reactions: [reaction],
      widgetConfigs: [config, { id: 'wc-other' } as never]
    });

    expect(entries).toEqual([
      { turn: turn(1), reactions: [reaction], rewindability: { available: true } },
      { turn: commit, reactions: [], widgetConfig: config },
      { turn: turn(3), reactions: [], rewindability: { available: false, reason: 'busy' } }
    ]);
  });
});

describe('an older page', () => {
  it('leads the run, and its start is the run\'s', () => {
    const first = workshopEarlierRunWithOlderPage(WORKSHOP_NO_EARLIER_TURNS, page(11, 20));
    const second = workshopEarlierRunWithOlderPage(first, page(6, 12, { modelsBefore: { assistant: 'model/a' } }));

    expect(ids(second.entries)).toEqual(ids(workshopEarlierTurnEntries(page(6, 20))));
    expect(second.remainingBefore).toBe(5);
    expect(second.modelsBefore).toEqual({ assistant: 'model/a' });
  });
});

describe('carrying the turns that slid out of the window', () => {
  const run = workshopEarlierRunWithOlderPage(WORKSHOP_NO_EARLIER_TURNS, page(11, 20));
  const earlierWindow = { ...page(21, 30), turnRewindability: { t22: { available: true } } } as never;

  it('joins them to the end of the run, with the earlier snapshot\'s parts', () => {
    const carried = workshopEarlierRunCarrying(run, earlierWindow, 't23');

    expect(ids(carried.entries)).toEqual(ids(workshopEarlierTurnEntries(page(11, 22))));
    expect(carried.entries.at(-1)?.rewindability).toEqual({ available: true });
    expect(carried.remainingBefore).toBe(10);
  });

  it('carries nothing when the window did not move, or does not continue the earlier one', () => {
    expect(workshopEarlierRunCarrying(run, earlierWindow, 't21')).toBe(run);
    expect(workshopEarlierRunCarrying(run, earlierWindow, 't40')).toBe(run);
    expect(workshopEarlierRunCarrying(run, earlierWindow, undefined)).toBe(run);
  });
});

describe('a re-read walk', () => {
  const held = workshopEarlierRunWithOlderPage(WORKSHOP_NO_EARLIER_TURNS, page(11, 20));

  it('goes on while the oldest turn held is not yet read', () => {
    const step = workshopEarlierRereadStep([], page(16, 20), 't11', 110);

    expect(step.run).toBeUndefined();
    expect(ids(step.fresh)).toEqual(ids(workshopEarlierTurnEntries(page(16, 20))));
    // What is on screen meanwhile: the unread older turns, then what was read.
    expect(ids(workshopEarlierRunRereadSoFar(held, step.fresh).entries)).toEqual(ids(held.entries));
  });

  it('ends at the oldest turn held, leaving out the answer\'s older turns and counting them as remaining', () => {
    const first = workshopEarlierRereadStep([], page(16, 20), 't11', 110);
    const last = workshopEarlierRereadStep(first.fresh, page(6, 15), 't11', 110);

    expect(ids(last.run!.entries)).toEqual(ids(held.entries));
    expect(last.run!.remainingBefore).toBe(10);
  });

  it('moves the model seed over the turns it leaves out', () => {
    const answer = page(6, 15, { modelsBefore: { assistant: 'model/a', dictionary: 'model/d' } });
    answer.turns[2] = stamped(8, 'model/b');

    const step = workshopEarlierRereadStep([], answer, 't11', 110);

    // t8 is before the run's start: the seed for t11 is the model t8 was asked of.
    expect(step.run!.modelsBefore).toEqual({ assistant: 'model/b', dictionary: 'model/d' });
    // A stamp inside the run does not move the seed.
    const inside = page(6, 15);
    inside.turns[7] = stamped(13, 'model/c');
    expect(workshopEarlierRereadStep([], inside, 't11', 110).run!.modelsBefore).toBeUndefined();
  });

  it('ends at the room\'s first turn, and at its limit, when the oldest turn held is gone', () => {
    const atFirstTurn = workshopEarlierRereadStep([], page(1, 5), 't-gone', 110);
    expect(atFirstTurn.run).toEqual({ entries: workshopEarlierTurnEntries(page(1, 5)), remainingBefore: 0 });

    const atLimit = workshopEarlierRereadStep(workshopEarlierTurnEntries(page(16, 20)), page(11, 15), 't-gone', 10);
    expect(ids(atLimit.run!.entries)).toEqual(ids(workshopEarlierTurnEntries(page(11, 20))));
    expect(atLimit.run!.remainingBefore).toBe(10);

    const empty = workshopEarlierRereadStep([], page(1, 0, { remainingBefore: 4 }), 't-gone', 110);
    expect(empty.run).toEqual({ entries: [], remainingBefore: 4 });
  });

  it('while it runs, removes a held turn the answers covering its place did not return', () => {
    const fresh = workshopEarlierTurnEntries(page(17, 20)).filter((entry) => entry.turn.id !== 't19');

    expect(ids(workshopEarlierRunRereadSoFar(held, fresh).entries))
      .toEqual(['t11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't20']);
  });
});

describe('what the thread draws', () => {
  it('leaves out a held turn the window already shows, with its parts', () => {
    const run = workshopEarlierRunWithOlderPage(WORKSHOP_NO_EARLIER_TURNS, page(11, 14, {
      turnRewindability: { t12: { available: true }, t14: { available: true } },
      reactions: [{ turnId: 't14', reaction: 'heart', author: { kind: 'writer' }, label: 'You' } as never]
    }));

    const parts = workshopEarlierTurnsThreadParts(run, turns(14, 20));

    expect(parts.turns.map((each) => each.id)).toEqual(['t11', 't12', 't13']);
    expect(parts.turnRewindability).toEqual({ t12: { available: true } });
    expect(parts.reactionsByTurn.size).toBe(0);
  });
});

describe('the announcement', () => {
  it('counts the turns shown, in number', () => {
    expect(workshopEarlierTurnsShownAnnouncement(100)).toBe('100 earlier turns shown.');
    expect(workshopEarlierTurnsShownAnnouncement(1)).toBe('1 earlier turn shown.');
  });
});
