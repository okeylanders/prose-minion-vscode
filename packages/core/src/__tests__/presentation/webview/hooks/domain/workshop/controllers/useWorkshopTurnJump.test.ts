/** @jest-environment jsdom */

/**
 * useWorkshopTurnJump (ADR 2026-11-03 D3, D4): one scroll-and-focus path for a
 * turn. From inside a sheet it hands the jump to the overlay's focus restore,
 * which runs it in place of the opener once the sheet is gone (PR #187 F-01).
 * The full path through the real sheet is in `WorkshopApp.readInProvenance`.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopTurnJump } from '@hooks/domain/workshop/controllers/useWorkshopTurnJump';
import { WORKSHOP_TURN_ID_ATTRIBUTE } from '@components/workshop/WorkshopTurnBubble';
import { focusAfterOverlaysClose, __resetOverlayFocusStateForTests } from '@hooks/useOverlayDismiss';

jest.mock('@hooks/useOverlayDismiss', () => ({
  ...jest.requireActual('@hooks/useOverlayDismiss'),
  focusAfterOverlaysClose: jest.fn()
}));

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
    __resetOverlayFocusStateForTests();
    (focusAfterOverlaysClose as jest.Mock).mockReset();
    turn.remove();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });

  const options = (overrides: Partial<Parameters<typeof useWorkshopTurnJump>[0]> = {}) => ({
    closeOverlay: jest.fn(),
    onOutsideWindow: jest.fn(),
    ...overrides
  });

  it('scrolls a turn into view and focuses it', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    let took = false;
    act(() => { took = result.current.jumpToTurn('turn-4-assistant-1'); });

    expect(took).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(document.activeElement).toBe(turn);
    expect(props.onOutsideWindow).not.toHaveBeenCalled();
  });

  it('reports a turn outside the reload window instead', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    let took = true;
    act(() => { took = result.current.jumpToTurn('turn-1-assistant-0'); });

    // Taking no focus leaves the overlay's opener restore to run.
    expect(took).toBe(false);
    expect(props.onOutsideWindow).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('matches the turn id exactly, never as a selector', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    act(() => result.current.jumpToTurn('"] , [data-x="'));

    expect(props.onOutsideWindow).toHaveBeenCalledTimes(1);
  });

  it('hands the jump to the overlay\'s focus restore before it closes the overlay', () => {
    const order: string[] = [];
    (focusAfterOverlaysClose as jest.Mock).mockImplementation(() => order.push('destination'));
    const props = options({ closeOverlay: jest.fn(() => order.push('close')) });
    const { result } = renderHook(() => useWorkshopTurnJump(props));

    act(() => result.current.jumpAfterClosing('turn-4-assistant-1'));

    expect(order).toEqual(['destination', 'close']);
    expect(scrollIntoView).not.toHaveBeenCalled();
    const [[destination]] = (focusAfterOverlaysClose as jest.Mock).mock.calls;
    expect(destination()).toBe(true);
    expect(document.activeElement).toBe(turn);
  });
});
