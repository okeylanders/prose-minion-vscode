/** @jest-environment jsdom */

/**
 * useWorkshopEarlierTurns (ADR 2026-11-17 D4, D5, D7): a press asks for the
 * page before the oldest turn held, under a minted request id and the room
 * on screen; only the answer still waited for is taken; a room replacement
 * drops the run and what was waited for; a session state in the same room
 * re-reads the run, restarts a walk in flight and evicts what the host no
 * longer returns; a page is announced once; nothing persists. Made-up turns.
 */

import { act, renderHook } from '@testing-library/react';
import {
  MessageType,
  type WorkshopEarlierTurnsPage,
  type WorkshopEarlierTurnsPayload,
  type WorkshopRequestEarlierTurnsPayload,
  type WorkshopSessionSnapshot,
  type WorkshopTurn
} from '@messages';
import {
  useWorkshopEarlierTurns,
  type UseWorkshopEarlierTurnsOptions
} from '@hooks/domain/workshop/useWorkshopEarlierTurns';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

/** The room's ledger in these tests: t1 … tN, odd turns the writer's. */
const turn = (n: number, content = `line ${n}`): WorkshopTurn => ({
  id: `t${n}`,
  role: n % 2 === 1 ? 'user' : 'assistant',
  participant: n % 2 === 1 ? 'writer' : 'host',
  kind: 'message',
  content,
  timestamp: n,
  excerptVersion: 0
} as WorkshopTurn);
const turns = (from: number, to: number): WorkshopTurn[] =>
  Array.from({ length: to - from + 1 }, (_, index) => turn(from + index));
const idsOf = (list: readonly WorkshopTurn[]) => list.map((each) => each.id);

/** A snapshot whose window is turns `from`…`to` of a room that starts at t1. */
const sessionState = (from: number, to: number, roomRevision = 3, change: Partial<WorkshopSessionSnapshot> = {}) => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  payload: {
    session: {
      roomRevision,
      turns: turns(from, to),
      truncatedTurns: from - 1,
      totalTurns: to,
      turnRewindability: {},
      reactions: [],
      widgetConfigs: [],
      ...change
    }
  },
  timestamp: 1
}) as never;

/** The page of turns `from`…`to`, each rewindable, as the host would answer. */
const page = (from: number, to: number, change: Partial<WorkshopEarlierTurnsPage> = {}): WorkshopEarlierTurnsPage => ({
  turns: turns(from, to),
  turnRewindability: Object.fromEntries(turns(from, to).map((each) => [each.id, { available: true }])),
  reactions: [],
  widgetConfigs: [],
  remainingBefore: from - 1,
  ...change
});

describe('useWorkshopEarlierTurns', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const asked = (): WorkshopRequestEarlierTurnsPayload[] => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: WorkshopRequestEarlierTurnsPayload }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_REQUEST_EARLIER_TURNS)
    .map((message) => message.payload);
  const answer = (request: WorkshopRequestEarlierTurnsPayload, body: Partial<WorkshopEarlierTurnsPayload>) => ({
    type: MessageType.WORKSHOP_EARLIER_TURNS,
    source: 'extension.workshop',
    payload: { ...request, ...body },
    timestamp: 2
  }) as never;

  /** A hook over a 30-turn room whose window is t21…t30, as the room hook would hold it. */
  const mount = (from = 21, to = 30) => {
    const rendered = renderHook(
      (props: UseWorkshopEarlierTurnsOptions) => useWorkshopEarlierTurns(props),
      { initialProps: { windowTurns: turns(from, to), hiddenTurns: from - 1 } }
    );
    act(() => rendered.result.current.handleSessionState(sessionState(from, to)));
    /** A new snapshot: the message, then the room hook's props. */
    const state = (nextFrom: number, nextTo: number, roomRevision = 3, change: Partial<WorkshopSessionSnapshot> = {}) => {
      act(() => rendered.result.current.handleSessionState(sessionState(nextFrom, nextTo, roomRevision, change)));
      rendered.rerender({ windowTurns: turns(nextFrom, nextTo), hiddenTurns: nextFrom - 1 });
    };
    const land = (request: WorkshopRequestEarlierTurnsPayload, body: Partial<WorkshopEarlierTurnsPayload>) =>
      act(() => rendered.result.current.handleEarlierTurns(answer(request, body)));
    /** Press, and answer with t`from`…t(oldest held − 1). */
    const showPage = (pageFrom: number, pageTo: number) => {
      act(() => rendered.result.current.showEarlier());
      land(asked().at(-1)!, { page: page(pageFrom, pageTo) });
    };
    return { ...rendered, hook: rendered.result, state, land, showPage };
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  describe('a press', () => {
    it('posts a minted id, the room on screen and the window\'s first turn, and nothing else', () => {
      const { hook } = mount();
      expect(hook.current.thread).toMatchObject({ remaining: 20, pending: false });
      expect(hook.current.threadTurns).toHaveLength(10);

      act(() => hook.current.showEarlier());

      expect(asked()).toEqual([{ requestId: expect.stringMatching(/^ws-earlier-/), roomRevision: 3, beforeTurnId: 't21' }]);
      expect(hook.current.thread.pending).toBe(true);
    });

    it('posts once while its answer is out, and nothing before the first snapshot', () => {
      const idle = renderHook(() => useWorkshopEarlierTurns({ windowTurns: [], hiddenTurns: 0 }));
      act(() => idle.result.current.showEarlier());
      expect(asked()).toEqual([]);
      expect(idle.result.current.thread.pending).toBe(false);

      const { hook } = mount();
      act(() => {
        hook.current.showEarlier();
        hook.current.showEarlier();
      });
      expect(asked()).toHaveLength(1);
    });

    it('takes its answer: the page leads the thread with the host\'s parts, and is announced once', () => {
      const { hook, land } = mount();
      act(() => hook.current.showEarlier());
      const reaction = { turnId: 't12', reaction: 'heart', author: { kind: 'writer' }, label: 'You' };

      land(asked()[0], { page: page(11, 20, { reactions: [reaction as never], modelsBefore: { assistant: 'model/a' } }) });

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      expect(hook.current.thread).toMatchObject({
        remaining: 10,
        pending: false,
        landSerial: 1,
        modelsBefore: { assistant: 'model/a' },
        announcement: '10 earlier turns shown.',
        announcementSerial: 1
      });
      // Copied, never derived: exactly the verdicts and summaries the page carried.
      expect(hook.current.thread.turnRewindability).toEqual(page(11, 20).turnRewindability);
      expect(hook.current.thread.reactionsByTurn.get('t12')).toEqual([reaction]);
      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(11, 20)));
    });

    it('pressed again, asks before the oldest turn held, until the room\'s first turn', () => {
      const { hook, showPage } = mount();
      showPage(11, 20);

      act(() => hook.current.showEarlier());
      expect(asked().at(-1)).toMatchObject({ beforeTurnId: 't11' });
      const { land } = { land: (body: WorkshopEarlierTurnsPage) => act(() => hook.current.handleEarlierTurns(answer(asked().at(-1)!, { page: body }))) };
      land(page(1, 10));

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(1, 30)));
      expect(hook.current.thread).toMatchObject({ remaining: 0, announcement: '10 earlier turns shown.', announcementSerial: 2 });
      expect(new Set(idsOf(hook.current.threadTurns)).size).toBe(30);
    });

    it('announces one turn in the singular', () => {
      const { hook, land } = mount(2, 30);
      act(() => hook.current.showEarlier());
      land(asked()[0], { page: page(1, 1) });
      expect(hook.current.thread.announcement).toBe('1 earlier turn shown.');
    });

    it('a refusal shows the host\'s words, announces them, and keeps what was held', () => {
      const { hook, showPage, land } = mount();
      showPage(11, 20);
      act(() => hook.current.showEarlier());

      land(asked().at(-1)!, { error: 'This room no longer holds the turn the earlier ones were asked from.' });

      expect(hook.current.thread).toMatchObject({
        pending: false,
        error: 'This room no longer holds the turn the earlier ones were asked from.',
        announcement: 'This room no longer holds the turn the earlier ones were asked from.'
      });
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      // The next press clears the words.
      act(() => hook.current.showEarlier());
      expect(hook.current.thread.error).toBeUndefined();
    });
  });

  describe('correlation', () => {
    it('ignores an answer it does not wait for: another id, a duplicate, a late one', () => {
      const { hook, land } = mount();
      land({ requestId: 'someone-else', roomRevision: 3, beforeTurnId: 't21' }, { page: page(11, 20) });
      expect(hook.current.threadTurns).toHaveLength(10);

      act(() => hook.current.showEarlier());
      const [request] = asked();
      land({ ...request, requestId: 'not-mine' }, { page: page(11, 20) });
      expect(hook.current.thread.pending).toBe(true);
      land(request, { page: page(11, 20) });
      land(request, { page: page(1, 20) });

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      expect(hook.current.thread.announcementSerial).toBe(1);
    });

    it('ignores an answer that names another room', () => {
      const { hook, land } = mount();
      act(() => hook.current.showEarlier());

      land({ ...asked()[0], roomRevision: 2 }, { page: page(11, 20) });

      expect(hook.current.threadTurns).toHaveLength(10);
    });

    it.each([
      ['New', 4],
      ['Open', 5],
      ['Rewind', 6],
      ['Branch', 7]
    ])('%s lands before a held answer: the answer is dropped and the run is empty', (_operation, nextRevision) => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      act(() => hook.current.showEarlier());
      const held = asked().at(-1)!;

      // The room is replaced: another revision, whatever its turns.
      state(21, 30, nextRevision);

      expect(hook.current.thread).toMatchObject({ pending: false, remaining: 20 });
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(21, 30)));
      land(held, { page: page(1, 10) });
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(21, 30)));
      expect(hook.current.thread.turns).toEqual([]);
      // Nothing new was asked on the old room's behalf.
      expect(asked().filter((request) => request.roomRevision !== 3)).toEqual([]);
    });

    it('a first page still waited for is asked again when the window slides', () => {
      const { hook, state, land } = mount();
      act(() => hook.current.showEarlier());
      const first = asked()[0];

      state(23, 32);

      expect(asked()).toHaveLength(2);
      expect(asked()[1]).toMatchObject({ roomRevision: 3, beforeTurnId: 't23' });
      land(first, { page: page(11, 20) });
      expect(hook.current.threadTurns).toHaveLength(10);
      land(asked()[1], { page: page(13, 22) });
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(13, 32)));
    });
  });

  describe('a session state in the same room', () => {
    it('asks nothing while no earlier turn is held', () => {
      const { state } = mount();
      state(23, 32);
      expect(asked()).toEqual([]);
    });

    it('re-reads the run from the window\'s first turn back to the oldest turn held, one request at a time', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      const before = asked().length;

      state(21, 30);

      expect(asked().slice(before)).toEqual([expect.objectContaining({ roomRevision: 3, beforeTurnId: 't21' })]);
      // The run stays on screen meanwhile.
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      // The host's pages are cut its own way: the first answer covers t16…t20.
      land(asked().at(-1)!, {
        page: page(16, 20, { reactions: [{ turnId: 't18', reaction: 'heart', author: { kind: 'writer' }, label: 'You' } as never] })
      });
      expect(asked().slice(before)).toHaveLength(2);
      expect(asked().at(-1)).toMatchObject({ beforeTurnId: 't16' });
      // Each answer replaces the turns it covers at once.
      expect(hook.current.thread.reactionsByTurn.has('t18')).toBe(true);
      // The second answer reaches past the oldest turn held: the run still starts where it did.
      land(asked().at(-1)!, { page: page(6, 15, { modelsBefore: { assistant: 'model/a' } }) });

      expect(asked().slice(before)).toHaveLength(2);
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      expect(hook.current.thread).toMatchObject({ remaining: 10, pending: false, landSerial: 1, announcementSerial: 1 });
    });

    it('shows what changed on a held turn: its card state and its verdict', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      state(21, 30);

      const reread = page(11, 20);
      reread.turns[1] = turn(12, 'line 12, its card applied');
      reread.turnRewindability = { t12: { available: false, reason: 'busy' } } as never;
      land(asked().at(-1)!, { page: reread });

      expect(hook.current.threadTurns.find((each) => each.id === 't12')?.content).toBe('line 12, its card applied');
      expect(hook.current.thread.turnRewindability).toEqual({ t12: { available: false, reason: 'busy' } });
    });

    it('a turn that slid out of the window appears in the run at once, then as the host reads it', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);

      // Two turns arrived: t21 and t22 left the window for the hidden range.
      state(23, 32);

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 32)));
      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(11, 22)));
      expect(asked().at(-1)).toMatchObject({ beforeTurnId: 't23' });
      const slid = page(11, 22);
      slid.turns[11] = turn(22, 'line 22, as the host holds it now');
      land(asked().at(-1)!, { page: slid });

      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(11, 22)));
      expect(hook.current.threadTurns.find((each) => each.id === 't22')?.content).toBe('line 22, as the host holds it now');
      expect(hook.current.thread.remaining).toBe(10);
    });

    it('a rolled-back turn leaves the run: a held turn the answer covering its place does not return is removed', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      state(21, 30);

      // The host no longer holds t19: its page before t21 runs t11…t18, t20.
      const withoutT19 = page(11, 20);
      withoutT19.turns = withoutT19.turns.filter((each) => each.id !== 't19');
      land(asked().at(-1)!, { page: withoutT19 });

      expect(idsOf(hook.current.thread.turns)).toEqual(['t11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't20']);
    });

    it('evicts a stale turn inside a range re-read across two answers, before the walk ends', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      state(21, 30);

      const newest = page(17, 20);
      newest.turns = newest.turns.filter((each) => each.id !== 't19');
      land(asked().at(-1)!, { page: newest });

      // Mid-walk: t11…t16 wait for their answer; t19, inside the range read, is already gone.
      expect(idsOf(hook.current.thread.turns)).toEqual(['t11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't20']);
      land(asked().at(-1)!, { page: page(11, 16) });
      expect(idsOf(hook.current.thread.turns)).toEqual(['t11', 't12', 't13', 't14', 't15', 't16', 't17', 't18', 't20']);
    });

    it('ends at the room\'s first turn when the oldest turn held is gone', () => {
      const { hook, showPage, state, land } = mount(11, 20);
      showPage(1, 10);
      state(11, 20);

      // The room now starts at t2.
      land(asked().at(-1)!, { page: page(2, 10, { remainingBefore: 0 }) });

      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(2, 10)));
      expect(hook.current.thread.remaining).toBe(0);
    });

    it('a second session state restarts the walk: the first walk\'s held answer is dropped, and the run ends as the second walk read it', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      state(21, 30);
      const firstWalk = asked().at(-1)!;

      state(21, 30);
      const secondWalk = asked().at(-1)!;
      expect(secondWalk.requestId).not.toBe(firstWalk.requestId);

      // The first walk's answer arrives late, saying something older.
      const stale = page(11, 20);
      stale.turns[0] = turn(11, 'line 11, as the first walk read it');
      land(firstWalk, { page: stale });
      expect(hook.current.threadTurns.find((each) => each.id === 't11')?.content).toBe('line 11');

      const current = page(11, 20);
      current.turns[0] = turn(11, 'line 11, as the second walk read it');
      land(secondWalk, { page: current });
      land(firstWalk, { page: stale });

      expect(hook.current.threadTurns.find((each) => each.id === 't11')?.content).toBe('line 11, as the second walk read it');
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
    });

    it('a press during a re-read waits its turn: one request in flight, then the older page', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      state(21, 30);
      const walk = asked().at(-1)!;

      act(() => hook.current.showEarlier());
      expect(asked().at(-1)).toBe(walk);
      expect(hook.current.thread.pending).toBe(true);

      land(walk, { page: page(11, 20) });
      expect(asked().at(-1)).toMatchObject({ beforeTurnId: 't11' });
      land(asked().at(-1)!, { page: page(1, 10) });

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(1, 30)));
      expect(hook.current.thread).toMatchObject({ pending: false, remaining: 0 });
    });

    it('a press still waited for when a session state lands is asked again after the re-read', () => {
      const { hook, showPage, state, land } = mount();
      showPage(11, 20);
      act(() => hook.current.showEarlier());
      const press = asked().at(-1)!;

      state(21, 30);
      land(press, { page: page(1, 10) });
      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(11, 20)));
      expect(hook.current.thread.pending).toBe(true);

      land(asked().at(-1)!, { page: page(11, 20) });
      land(asked().at(-1)!, { page: page(1, 10) });

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(1, 30)));
    });

    it('drops the run when the window reaches the room\'s first turn', () => {
      const { hook, showPage, state } = mount();
      showPage(11, 20);

      state(1, 30);

      expect(hook.current.thread.turns).toEqual([]);
      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(1, 30)));
    });

    it('never draws a turn twice when the window grows back over the run', () => {
      const { hook, showPage, rerender } = mount();
      showPage(11, 20);

      // The room hook's window now starts at t19; the snapshot message follows.
      rerender({ windowTurns: turns(19, 30), hiddenTurns: 18 });

      expect(idsOf(hook.current.threadTurns)).toEqual(idsOf(turns(11, 30)));
      expect(idsOf(hook.current.thread.turns)).toEqual(idsOf(turns(11, 18)));
    });
  });

  it('persists nothing, whatever is loaded', () => {
    const { hook, showPage } = mount();
    expect(hook.current.persistedState).toEqual({});

    showPage(11, 20);

    expect(hook.current.persistedState).toEqual({});
    expect(JSON.stringify(hook.current.persistedState)).not.toContain('line');
  });
});
