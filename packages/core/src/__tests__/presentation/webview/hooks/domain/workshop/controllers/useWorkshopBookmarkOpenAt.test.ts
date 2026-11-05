/** @jest-environment jsdom */

/**
 * useWorkshopBookmarkOpenAt (ADR 2026-11-05 D8): Open at bookmark goes
 * through Open, then jumps once Open succeeded and the new room is on
 * screen; a refused Open, a declined confirmation, or a later Open's result
 * with no room change jumps nowhere.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopBookmarkOpenAt, UseWorkshopBookmarkOpenAtOptions } from '@hooks/domain/workshop/controllers/useWorkshopBookmarkOpenAt';

const TARGET = { sessionId: 's1', title: 'Tea party', turnId: 'turn-7', label: 'Alice at the door' };

function setup() {
  const openStoredSession = jest.fn();
  const jumpToTurn = jest.fn(() => true);
  const initial: UseWorkshopBookmarkOpenAtOptions = { roomRevision: 1, openStoredSession, jumpToTurn };
  const hook = renderHook((props: UseWorkshopBookmarkOpenAtOptions) => useWorkshopBookmarkOpenAt(props), { initialProps: initial });
  const update = (next: Partial<UseWorkshopBookmarkOpenAtOptions>) => hook.rerender({ ...initial, ...next });
  return { hook, openStoredSession, jumpToTurn, update };
}

describe('useWorkshopBookmarkOpenAt', () => {
  it('opens the session, then jumps once Open succeeded and the opened room is on screen', () => {
    const { hook, openStoredSession, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    expect(openStoredSession).toHaveBeenCalledWith({ sessionId: 's1', title: 'Tea party' });
    expect(jumpToTurn).not.toHaveBeenCalled();

    // The host sends the opened room's snapshot, then Open's result.
    update({ roomRevision: 2 });
    expect(jumpToTurn).not.toHaveBeenCalled();
    update({ roomRevision: 2, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).toHaveBeenCalledWith('turn-7', 'Alice at the door');
    expect(hook.result.current.pendingJump).toBeNull();
    expect(hook.result.current.persistedState).toEqual({});
  });

  it('waits for the new room when Open\'s result comes first', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    update({ sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
    update({ roomRevision: 3, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).toHaveBeenCalledTimes(1);
  });

  it('jumps nowhere when Open is refused, even as the room it restored arrives', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    update({ roomRevision: 2, sessionActionResult: { action: 'open', ok: false } });
    update({ roomRevision: 3, sessionActionResult: undefined });
    expect(jumpToTurn).not.toHaveBeenCalled();
    expect(hook.result.current.pendingJump).toBeNull();
  });

  it('jumps nowhere when the confirmation is declined', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    act(() => hook.result.current.dropPendingJump());
    update({ roomRevision: 2, sessionActionResult: { action: 'open', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
  });

  it('is not armed by another action\'s result', () => {
    const { hook, jumpToTurn, update } = setup();
    act(() => hook.result.current.openAtBookmark(TARGET));
    update({ roomRevision: 2, sessionActionResult: { action: 'save', ok: true } });
    expect(jumpToTurn).not.toHaveBeenCalled();
    expect(hook.result.current.pendingJump).toMatchObject({ opened: false });
  });
});
