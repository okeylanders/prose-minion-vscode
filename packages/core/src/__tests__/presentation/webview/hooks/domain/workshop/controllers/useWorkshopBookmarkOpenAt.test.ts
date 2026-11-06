/** @jest-environment jsdom */

/**
 * useWorkshopBookmarkOpenAt (ADR 2026-11-05 D8; PR #216 F-02): Open at
 * bookmark follows its own Open, of its own session, and jumps only once that
 * Open succeeded and the new room is on screen. A refused Open, a declined
 * confirmation, a confirmation another replaces (New, another session's
 * Open), or another action settling instead jumps nowhere, and a later
 * ordinary Open never re-arms it.
 */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopBookmarkOpenAt,
  UseWorkshopBookmarkOpenAtOptions
} from '@hooks/domain/workshop/controllers/useWorkshopBookmarkOpenAt';

const TARGET = { sessionId: 's1', title: 'Tea party', turnId: 'turn-7', label: 'Alice at the door' };
const CONFIRM_TEA = { kind: 'open', sessionId: 's1' };

function setup() {
  const openStoredSession = jest.fn();
  const jumpToTurn = jest.fn(() => true);
  let props: UseWorkshopBookmarkOpenAtOptions = { roomRevision: 1, sessionConfirm: null, openStoredSession, jumpToTurn };
  const hook = renderHook((current: UseWorkshopBookmarkOpenAtOptions) => useWorkshopBookmarkOpenAt(current), { initialProps: props });
  const update = (next: Partial<UseWorkshopBookmarkOpenAtOptions>) => {
    props = { ...props, ...next };
    hook.rerender(props);
  };
  /** Open at bookmark, with the confirmation the session surfaces would show. */
  const start = () => act(() => {
    hook.result.current.openAtBookmark(TARGET);
    props = { ...props, sessionConfirm: CONFIRM_TEA };
    hook.rerender(props);
  });
  /** The writer accepts: the confirmation closes with an Open in flight. */
  const accept = () => update({ sessionConfirm: null, sessionActionPending: 'open' });
  return { hook, openStoredSession, jumpToTurn, update, start, accept };
}

describe('useWorkshopBookmarkOpenAt', () => {
  it('opens the session, then jumps once its Open succeeded and the opened room is on screen', () => {
    const { hook, openStoredSession, jumpToTurn, update, start, accept } = setup();
    start();
    expect(openStoredSession).toHaveBeenCalledWith({ sessionId: 's1', title: 'Tea party' });
    expect(hook.result.current.pendingJump?.phase).toBe('confirming');
    accept();
    expect(hook.result.current.pendingJump?.phase).toBe('opening');

    // The host sends the opened room's snapshot, then Open's result.
    update({ roomRevision: 2 });
    expect(jumpToTurn).not.toHaveBeenCalled();
    update({ sessionActionPending: undefined, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).toHaveBeenCalledWith('turn-7', 'Alice at the door');
    expect(hook.result.current.pendingJump).toBeNull();
    expect(hook.result.current.persistedState).toEqual({});
  });

  it('follows an Open that needs no confirmation', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => {
      hook.result.current.openAtBookmark(TARGET);
      hook.rerender({ roomRevision: 1, sessionConfirm: null, sessionActionPending: 'open', openStoredSession: jest.fn(), jumpToTurn });
    });
    expect(hook.result.current.pendingJump?.phase).toBe('opening');
    update({ roomRevision: 3, sessionActionPending: undefined, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).toHaveBeenCalledTimes(1);
  });

  it('jumps nowhere when Open is refused, even as the room it restored arrives', () => {
    const { hook, jumpToTurn, update, start, accept } = setup();
    start();
    accept();
    update({ roomRevision: 2, sessionActionPending: undefined, sessionActionResult: { action: 'open', ok: false } });
    update({ roomRevision: 3, sessionActionResult: undefined });
    expect(jumpToTurn).not.toHaveBeenCalled();
    expect(hook.result.current.pendingJump).toBeNull();
  });

  it('jumps nowhere when the confirmation is declined', () => {
    const { hook, jumpToTurn, update, start } = setup();
    start();
    update({ sessionConfirm: null });
    expect(hook.result.current.pendingJump).toBeNull();
    update({ roomRevision: 2, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
  });

  it.each([
    ['New', { kind: 'new' }],
    ['another session\'s Open', { kind: 'open', sessionId: 's2' }],
    ['Rewind', { kind: 'rewind' }]
  ])('drops the jump when %s replaces its confirmation, and a later ordinary Open never re-arms it (PR #216 F-02)', (_label, replacement) => {
    const { hook, jumpToTurn, update, start } = setup();
    start();
    update({ sessionConfirm: replacement });
    expect(hook.result.current.pendingJump).toBeNull();
    // The replacement runs, then the writer opens another session the ordinary way.
    update({ sessionConfirm: null, sessionActionPending: 'new' });
    update({ roomRevision: 2, sessionActionPending: undefined, sessionActionResult: { action: 'new', ok: true } });
    update({ sessionConfirm: { kind: 'open', sessionId: 's2' }, sessionActionResult: undefined });
    update({ sessionConfirm: null, sessionActionPending: 'open' });
    update({ roomRevision: 3, sessionActionPending: undefined, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
  });

  it('drops the jump when another action settles in place of its Open', () => {
    const { hook, jumpToTurn, update, start, accept } = setup();
    start();
    accept();
    update({ roomRevision: 2, sessionActionPending: undefined, sessionActionResult: { action: 'save', ok: true } });
    expect(hook.result.current.pendingJump).toBeNull();
    expect(jumpToTurn).not.toHaveBeenCalled();
  });

  it('drops a jump whose Open never started', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    expect(hook.result.current.pendingJump).toBeNull();
    // A later Open in flight, of anything, is not its Open.
    update({ sessionActionPending: 'open' });
    update({ roomRevision: 2, sessionActionPending: undefined, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
  });
});
