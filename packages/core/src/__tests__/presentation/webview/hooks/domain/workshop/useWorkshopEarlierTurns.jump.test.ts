/** @jest-environment jsdom */

/**
 * useWorkshopEarlierTurns' jump (ADR 2026-11-17 D6, amended 2026-11-18): a
 * bookmark outside the window loads the earlier turns back to it, page after
 * page, each request naming the target; it settles once, landed or refused;
 * only the answer still waited for is taken; a new room abandons it; it
 * stops after `jumpPages` pages. Made-up turns.
 */

import { act, renderHook } from '@testing-library/react';
import {
  MessageType,
  type WorkshopEarlierTurnsPage,
  type WorkshopEarlierTurnsPayload,
  type WorkshopRequestEarlierTurnsPayload,
  type WorkshopTurn
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_EARLIER_JUMP_TOO_FAR,
  useWorkshopEarlierTurns,
  type UseWorkshopEarlierTurnsOptions
} from '@hooks/domain/workshop/useWorkshopEarlierTurns';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const turn = (n: number): WorkshopTurn => ({
  id: `t${n}`,
  role: n % 2 === 1 ? 'user' : 'assistant',
  participant: n % 2 === 1 ? 'writer' : 'host',
  kind: 'message',
  content: `line ${n}`,
  timestamp: n,
  excerptVersion: 0
} as WorkshopTurn);
const turns = (from: number, to: number): WorkshopTurn[] =>
  Array.from({ length: to - from + 1 }, (_, index) => turn(from + index));

const sessionState = (from: number, to: number, roomRevision = 3) => ({
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
      widgetConfigs: []
    }
  },
  timestamp: 1
}) as never;

const page = (from: number, to: number): WorkshopEarlierTurnsPage => ({
  turns: turns(from, to),
  turnRewindability: {},
  reactions: [],
  widgetConfigs: [],
  remainingBefore: from - 1
});

const TARGET = { turnId: 't50', label: 'Jill · The barn' };

describe('useWorkshopEarlierTurns: a jump to a bookmark outside the window', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const asked = (): WorkshopRequestEarlierTurnsPayload[] => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: WorkshopRequestEarlierTurnsPayload }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_REQUEST_EARLIER_TURNS)
    .map((message) => message.payload);

  /** A 400-turn room whose window is t201…t400. */
  const mount = (from = 201, to = 400) => {
    const rendered = renderHook(
      (props: UseWorkshopEarlierTurnsOptions) => useWorkshopEarlierTurns(props),
      { initialProps: { windowTurns: turns(from, to), hiddenTurns: from - 1 } }
    );
    act(() => rendered.result.current.handleSessionState(sessionState(from, to)));
    const land = (request: WorkshopRequestEarlierTurnsPayload, body: Partial<WorkshopEarlierTurnsPayload>) =>
      act(() => rendered.result.current.handleEarlierTurns({
        type: MessageType.WORKSHOP_EARLIER_TURNS,
        source: 'extension.workshop',
        payload: { ...request, ...body },
        timestamp: 2
      } as never));
    const jump = (target: { turnId: string; label?: string } = TARGET) =>
      act(() => rendered.result.current.loadThrough(target));
    return { hook: rendered.result, rendered, land, jump };
  };

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('loads page after page back to the target, naming it on each request, then lands once', () => {
    const { hook, land, jump } = mount();
    jump();

    expect(asked()).toEqual([{ requestId: expect.any(String), roomRevision: 3, beforeTurnId: 't201', targetTurnId: 't50' }]);
    expect(hook.current.jumpingTo).toBe('t50');
    expect(hook.current.thread.pending).toBe(true);

    land(asked()[0], { page: page(101, 200) });
    // A page that does not hold it asks for the one before, announcing nothing yet.
    expect(asked()[1]).toMatchObject({ beforeTurnId: 't101', targetTurnId: 't50' });
    expect(hook.current.thread.announcement).toBe('');
    expect(hook.current.jumpOutcome).toBeUndefined();

    land(asked()[1], { page: page(1, 100) });
    expect(hook.current.jumpOutcome).toEqual({ ...TARGET, kind: 'landed', serial: 1 });
    expect(hook.current.jumpingTo).toBeUndefined();
    expect(hook.current.thread.pending).toBe(false);
    expect(hook.current.thread.announcement).toBe('200 earlier turns shown. Showing bookmark: Jill · The barn.');
    expect(hook.current.threadTurns.map((each) => each.id)).toContain('t50');
    expect(hook.current.thread.remaining).toBe(0);
    expect(asked()).toHaveLength(2);
  });

  it('lands at once, asking nothing, on a turn the run already holds', () => {
    const { hook, land, jump } = mount();
    act(() => hook.current.showEarlier());
    land(asked()[0], { page: page(1, 200) });

    jump();

    expect(asked()).toHaveLength(1);
    expect(hook.current.jumpOutcome).toMatchObject({ kind: 'landed', turnId: 't50' });
  });

  it('settles refused with the host\'s words, keeping the pages already shown', () => {
    const { hook, land, jump } = mount();
    jump();
    land(asked()[0], { error: 'This room no longer holds the turn to show.' });

    expect(hook.current.jumpOutcome).toMatchObject({ kind: 'refused', turnId: 't50', label: TARGET.label });
    expect(hook.current.thread.announcement).toBe('This room no longer holds the turn to show.');
    // The control's own error line is for "Show earlier turns", not a jump.
    expect(hook.current.thread.error).toBeUndefined();
  });

  it('takes only the pending answer: a newer jump drops the earlier one\'s', () => {
    const { hook, land, jump } = mount();
    jump();
    jump({ turnId: 't150', label: 'Jill · Later' });
    const [first, second] = asked();

    land(first, { page: page(101, 200) });
    expect(asked()).toHaveLength(2);
    expect(hook.current.threadTurns).toHaveLength(200);

    land(second, { page: page(101, 200) });
    expect(hook.current.jumpOutcome).toMatchObject({ kind: 'landed', turnId: 't150' });
  });

  it('is abandoned by a new room: nothing settles, and the late answer is dropped', () => {
    const { hook, land, jump, rendered } = mount();
    jump();
    act(() => hook.current.handleSessionState(sessionState(1, 10, 4)));
    rendered.rerender({ windowTurns: turns(1, 10), hiddenTurns: 0 });

    land(asked()[0], { page: page(101, 200) });

    expect(hook.current.jumpingTo).toBeUndefined();
    expect(hook.current.jumpOutcome).toBeUndefined();
    expect(hook.current.threadTurns).toHaveLength(10);
  });

  it('stops on cancel; the pages shown stay, and the late answer is dropped', () => {
    const { hook, land, jump } = mount();
    jump();
    land(asked()[0], { page: page(101, 200) });
    act(() => hook.current.cancelJump());

    land(asked()[1], { page: page(1, 100) });

    expect(hook.current.jumpingTo).toBeUndefined();
    expect(hook.current.jumpOutcome).toBeUndefined();
    expect(hook.current.thread.pending).toBe(false);
    expect(hook.current.threadTurns).toHaveLength(300);
  });

  it('waits for a re-read in flight, then starts from the run it read', () => {
    const { hook, land, jump, rendered } = mount();
    act(() => hook.current.showEarlier());
    land(asked()[0], { page: page(151, 200) });
    // The window slides by one: the held run is read again.
    act(() => hook.current.handleSessionState(sessionState(202, 401)));
    rendered.rerender({ windowTurns: turns(202, 401), hiddenTurns: 201 });
    jump();
    expect(asked()).toHaveLength(2);
    expect(hook.current.jumpingTo).toBe('t50');

    land(asked()[1], { page: page(102, 201) });
    expect(asked()[2]).toMatchObject({ beforeTurnId: 't151', targetTurnId: 't50' });
    land(asked()[2], { page: page(51, 150) });
    expect(asked()[3]).toMatchObject({ beforeTurnId: 't51' });
    land(asked()[3], { page: page(1, 50) });
    expect(hook.current.jumpOutcome).toMatchObject({ kind: 'landed', turnId: 't50' });
  });

  describe(`at most ${PROMPT_BUDGETS.workshopThread.jumpPages} pages (Okey's bound)`, () => {
    // Byte-bounded pages of ten turns: the host's distance check passes, the page count stops the walk.
    const tenTurnPages = (target: string) => {
      const { hook, land, jump } = mount();
      jump({ turnId: target, label: 'Jill · Far' });
      for (let index = 0; index < PROMPT_BUDGETS.workshopThread.jumpPages && !hook.current.jumpOutcome; index += 1) {
        const newest = 200 - index * 10;
        land(asked()[index], { page: page(newest - 9, newest) });
      }
      return hook;
    };

    it('lands on a target inside the last page allowed', () => {
      const hook = tenTurnPages('t171');
      expect(asked()).toHaveLength(PROMPT_BUDGETS.workshopThread.jumpPages);
      expect(hook.current.jumpOutcome).toMatchObject({ kind: 'landed', turnId: 't171' });
    });

    it('falls back to the reader for a target a page further back, asking no further page', () => {
      const hook = tenTurnPages('t170');
      expect(asked()).toHaveLength(PROMPT_BUDGETS.workshopThread.jumpPages);
      expect(hook.current.jumpOutcome).toMatchObject({ kind: 'refused', turnId: 't170' });
      expect(hook.current.thread.announcement).toBe(WORKSHOP_EARLIER_JUMP_TOO_FAR);
      expect(hook.current.threadTurns).toHaveLength(230);
    });
  });
});
