/**
 * @jest-environment jsdom
 */

/**
 * useFullTabRailCollapse (Everyday Conveniences, item D): whether a full
 * tab's rail is collapsed. Wide, it is the writer's stored choice; narrow, it
 * starts collapsed and opens as an overlay that never touches that choice.
 */

import { act, renderHook } from '@testing-library/react';
import {
  FULL_TAB_RAIL_NARROW_QUERY,
  FullTabMatchMedia,
  FullTabNarrowQuery,
  useFullTabRailCollapse
} from '@hooks/fulltab/useFullTabRailCollapse';

type Listener = (event: { matches: boolean }) => void;

/** A media query a test can move, in place of jsdom's missing layout. */
function narrowQuery(matches: boolean) {
  const listeners = new Set<Listener>();
  const query: FullTabNarrowQuery = {
    matches,
    addEventListener: (_type, listener) => { listeners.add(listener); },
    removeEventListener: (_type, listener) => { listeners.delete(listener); }
  };
  const matchMedia = jest.fn<ReturnType<FullTabMatchMedia>, [string]>(() => query);
  return {
    matchMedia,
    listeners,
    set: (next: boolean) => act(() => {
      query.matches = next;
      listeners.forEach((listener) => listener({ matches: next }));
    })
  };
}

describe('useFullTabRailCollapse', () => {
  it('starts expanded, toggles, and keeps the choice in persistedState', () => {
    const { result } = renderHook(() => useFullTabRailCollapse());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.overlay).toBe(false);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: false });

    act(() => result.current.onToggle());
    expect(result.current.collapsed).toBe(true);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: true });

    act(() => result.current.onToggle());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: false });
  });

  it('restores a stored choice and reads anything else as expanded', () => {
    expect(renderHook(() => useFullTabRailCollapse({ initialCollapsed: true })).result.current.collapsed)
      .toBe(true);
    for (const stored of [undefined, null, 'true', 1, {}]) {
      expect(renderHook(() => useFullTabRailCollapse({ initialCollapsed: stored })).result.current.collapsed)
        .toBe(false);
    }
  });

  it('asks about 900px', () => {
    const media = narrowQuery(false);
    renderHook(() => useFullTabRailCollapse({ matchMedia: media.matchMedia }));
    expect(FULL_TAB_RAIL_NARROW_QUERY).toBe('(max-width: 900px)');
    expect(media.matchMedia).toHaveBeenCalledWith('(max-width: 900px)');
  });

  it('starts collapsed on a narrow tab, whatever was stored, and keeps what was stored', () => {
    const media = narrowQuery(true);
    const { result } = renderHook(() =>
      useFullTabRailCollapse({ initialCollapsed: false, matchMedia: media.matchMedia }));
    expect(result.current.narrow).toBe(true);
    expect(result.current.collapsed).toBe(true);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: false });
  });

  it('opens over the thread on a narrow tab without changing the stored choice', () => {
    const media = narrowQuery(true);
    const { result } = renderHook(() => useFullTabRailCollapse({ matchMedia: media.matchMedia }));

    act(() => result.current.onToggle());
    expect(result.current.collapsed).toBe(false);
    expect(result.current.overlay).toBe(true);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: false });

    act(() => result.current.onToggle());
    expect(result.current.collapsed).toBe(true);
    expect(result.current.overlay).toBe(false);
    expect(result.current.persistedState).toEqual({ fullTabRailCollapsed: false });
  });

  it('goes back to the stored choice when the tab widens, and collapses again when it narrows', () => {
    const media = narrowQuery(false);
    const { result } = renderHook(() => useFullTabRailCollapse({ matchMedia: media.matchMedia }));
    expect(result.current.collapsed).toBe(false);

    media.set(true);
    expect(result.current.collapsed).toBe(true);
    act(() => result.current.expand());
    expect(result.current.overlay).toBe(true);

    media.set(false);
    expect(result.current.collapsed).toBe(false);
    expect(result.current.overlay).toBe(false);

    // Narrow again: the overlay it left open does not come back.
    media.set(true);
    expect(result.current.collapsed).toBe(true);
  });

  it('stops listening on unmount', () => {
    const media = narrowQuery(false);
    const { unmount } = renderHook(() => useFullTabRailCollapse({ matchMedia: media.matchMedia }));
    expect(media.listeners.size).toBe(1);
    unmount();
    expect(media.listeners.size).toBe(0);
  });

  it('is never narrow where the window has no matchMedia (jsdom)', () => {
    expect(typeof window.matchMedia).toBe('undefined');
    expect(renderHook(() => useFullTabRailCollapse()).result.current.narrow).toBe(false);
  });

  it('expand focuses the named element once the rail is open', () => {
    const target = document.createElement('button');
    target.id = 'rail-collapse-test-target';
    document.body.appendChild(target);
    const { result } = renderHook(() => useFullTabRailCollapse({ initialCollapsed: true }));

    act(() => result.current.expand('rail-collapse-test-target'));
    expect(result.current.collapsed).toBe(false);
    expect(document.activeElement).toBe(target);
    target.remove();
  });
});
