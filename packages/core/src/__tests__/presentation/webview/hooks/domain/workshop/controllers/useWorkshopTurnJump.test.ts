/** @jest-environment jsdom */

/**
 * useWorkshopTurnJump (ADR 2026-11-03 D3, D4): one scroll-and-focus path for a
 * turn. From inside a sheet it closes the sheet first and jumps only once the
 * sheet is gone, because the frame behind an open sheet is inert and an inert
 * turn cannot take focus.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopTurnJump } from '@hooks/domain/workshop/controllers/useWorkshopTurnJump';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';

describe('useWorkshopTurnJump', () => {
  let turn: HTMLElement;
  let scrollIntoView: jest.Mock;

  beforeEach(() => {
    scrollIntoView = jest.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    turn = document.createElement('article');
    turn.tabIndex = -1;
    turn.setAttribute(WORKSHOP_TURN_ID_ATTRIBUTE, 'turn-4-assistant-1');
    document.body.appendChild(turn);
  });

  afterEach(() => {
    turn.remove();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  const options = (overrides: Partial<Parameters<typeof useWorkshopTurnJump>[0]> = {}) => ({
    overlayOpen: false,
    closeOverlay: jest.fn(),
    onOutsideWindow: jest.fn(),
    ...overrides
  });

  it('scrolls a turn into view and focuses it', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    act(() => result.current.jumpToTurn('turn-4-assistant-1'));

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement).toBe(turn);
    expect(props.onOutsideWindow).not.toHaveBeenCalled();
  });

  it('reports a turn outside the reload window instead', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    act(() => result.current.jumpToTurn('turn-1-assistant-0'));

    expect(props.onOutsideWindow).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('matches the turn id exactly, never as a selector', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    act(() => result.current.jumpToTurn('"] , [data-x="'));

    expect(props.onOutsideWindow).toHaveBeenCalledTimes(1);
  });

  it('closes the overlay first, and jumps only once it has closed', () => {
    const props = options({ overlayOpen: true });
    const { result, rerender } = renderHook((current) => useWorkshopTurnJump(current), { initialProps: props });

    act(() => result.current.jumpAfterClosing('turn-4-assistant-1'));

    expect(props.closeOverlay).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(result.current.pendingTurnId).toBe('turn-4-assistant-1');

    rerender({ ...props, overlayOpen: false });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(turn);
    expect(result.current.pendingTurnId).toBeNull();

    // A later overlay opening and closing jumps nowhere again.
    rerender({ ...props, overlayOpen: true });
    rerender({ ...props, overlayOpen: false });
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});
