import {
  WorkshopRetainedHistoryLedger
} from '@/application/services/workshop/session/WorkshopRetainedHistoryLedger';
import type {
  WorkshopRetainedHistoryMarkV1
} from '@/application/services/workshop/WorkshopSessionStateV1';

const TURNS = ['t0', 't1', 't2', 't3', 't4', 't5'];

const mark = (
  turnId: string,
  overrides: Partial<WorkshopRetainedHistoryMarkV1> = {}
): WorkshopRetainedHistoryMarkV1 => ({
  turnId,
  conversationKey: 'host',
  messageCount: 2,
  contextSourceCount: 0,
  writerSourceCount: 1,
  lastSeenRoomTurnId: 't0',
  origin: 'commit',
  ...overrides
});

describe('WorkshopRetainedHistoryLedger', () => {
  let ledger: WorkshopRetainedHistoryLedger;

  beforeEach(() => {
    ledger = new WorkshopRetainedHistoryLedger((turnId) => {
      const index = TURNS.indexOf(turnId);
      return index < 0 ? undefined : index;
    });
  });

  it('appends marks per key in ledger order and answers the latest', () => {
    expect(ledger.record(mark('t1'))).toEqual({ recorded: true, mark: mark('t1'), prunedMarks: 0 });
    ledger.record(mark('t2', { conversationKey: 'tool:prose', lastSeenRoomTurnId: undefined }));
    ledger.record(mark('t3', { messageCount: 4, lastSeenRoomTurnId: 't2' }));

    expect(ledger.latestFor('host')).toEqual(mark('t3', { messageCount: 4, lastSeenRoomTurnId: 't2' }));
    expect(ledger.latestFor('guest:margot')).toBeUndefined();
    expect(ledger.all().map(({ turnId }) => turnId)).toEqual(['t1', 't2', 't3']);
  });

  it.each([
    ['an odd message count', mark('t2', { messageCount: 3 }), 'invalid-counts'],
    ['a negative context count', mark('t2', { contextSourceCount: -1 }), 'invalid-counts'],
    ['a fractional writer count', mark('t2', { writerSourceCount: 1.5 }), 'invalid-counts'],
    ['an unknown turn', mark('t9'), 'unknown-turn'],
    ['an unknown offset', mark('t2', { lastSeenRoomTurnId: 't9' }), 'invalid-offset'],
    ['an offset after its own turn', mark('t2', { lastSeenRoomTurnId: 't4' }), 'invalid-offset']
  ])('refuses %s and prunes the key rather than keep a hole', (_label, invalid, reason) => {
    ledger.record(mark('t1'));
    ledger.record(mark('t1', { conversationKey: 'guest:margot' }));

    expect(ledger.record(invalid)).toEqual({ recorded: false, reason, prunedMarks: 1 });
    expect(ledger.latestFor('host')).toBeUndefined();
    expect(ledger.latestFor('guest:margot')).toBeDefined();
  });

  it.each([
    ['an earlier turn', mark('t2', { messageCount: 6 })],
    ['a shrinking history', mark('t4', { messageCount: 2 })],
    ['fewer writer rows', mark('t4', { messageCount: 6, writerSourceCount: 0 })],
    ['a regressing offset', mark('t4', { messageCount: 6, lastSeenRoomTurnId: 't0' })]
  ])('restarts the key sequence at a valid mark that breaks order: %s', (_label, next) => {
    ledger.record(mark('t1'));
    ledger.record(mark('t3', { messageCount: 4, lastSeenRoomTurnId: 't2' }));

    expect(ledger.record(next)).toEqual({ recorded: true, mark: next, prunedMarks: 2 });
    expect(ledger.all()).toEqual([next]);
  });

  it('prunes one key, or every key', () => {
    ledger.record(mark('t1'));
    ledger.record(mark('t2', { conversationKey: 'guest:margot' }));
    ledger.record(mark('t3', { messageCount: 4, lastSeenRoomTurnId: 't2' }));

    expect(ledger.pruneKey('host')).toBe(2);
    expect(ledger.all().map(({ conversationKey }) => conversationKey)).toEqual(['guest:margot']);
    expect(ledger.pruneAll()).toBe(1);
    expect(ledger.all()).toEqual([]);
  });

  it('answers the last mark per key at or before a turn', () => {
    ledger.record(mark('t1'));
    ledger.record(mark('t2', { conversationKey: 'guest:margot' }));
    ledger.record(mark('t4', { messageCount: 4, lastSeenRoomTurnId: 't3' }));

    expect([...ledger.marksAtOrBefore('t3').entries()]).toEqual([
      ['host', mark('t1')],
      ['guest:margot', mark('t2', { conversationKey: 'guest:margot' })]
    ]);
    expect(ledger.marksAtOrBefore('t0').size).toBe(0);
    expect(ledger.marksAtOrBefore('t9').size).toBe(0);
  });

  it('exports and installs defensive copies, and a reset forgets every mark', () => {
    ledger.record(mark('t1'));
    const exported = ledger.exportState();
    exported.marks[0].messageCount = 99;
    expect(ledger.latestFor('host')?.messageCount).toBe(2);

    const prepared = ledger.prepareState({ marks: [mark('t2')] });
    ledger.installPreparedState(prepared);
    expect(ledger.all()).toEqual([mark('t2')]);

    ledger.reset();
    expect(ledger.all()).toEqual([]);
  });
});
