/** @jest-environment jsdom */

/**
 * The Memory tab's "Memory isn't context" explainer (Slice 6 live pass):
 * open the first time, folded once the writer folds it, and only a boolean
 * read back from webview state counts as a choice.
 */

import { act, renderHook } from '@testing-library/react';
import {
  parseWorkshopMemoryExplainerOpen,
  useWorkshopMemoryExplainer
} from '@hooks/domain/workshop/controllers/useWorkshopMemoryExplainer';

describe('useWorkshopMemoryExplainer', () => {
  it('starts open when nothing is stored, and persists what it shows', () => {
    const { result } = renderHook(() => useWorkshopMemoryExplainer());
    expect(result.current.explainerOpen).toBe(true);
    expect(result.current.persistedState).toEqual({ workshopMemoryExplainerOpen: true });
  });

  it('folds and unfolds, and its persisted state follows', () => {
    const { result } = renderHook(() => useWorkshopMemoryExplainer({ initialOpen: true }));
    act(() => result.current.toggleExplainer());
    expect(result.current.explainerOpen).toBe(false);
    expect(result.current.persistedState).toEqual({ workshopMemoryExplainerOpen: false });
    act(() => result.current.toggleExplainer());
    expect(result.current.explainerOpen).toBe(true);
  });

  it('a stored false keeps it folded', () => {
    const { result } = renderHook(() => useWorkshopMemoryExplainer({ initialOpen: false }));
    expect(result.current.explainerOpen).toBe(false);
  });

  it.each([undefined, null, 'false', 0, {}])('reads %p as no choice: open', (stored) => {
    expect(parseWorkshopMemoryExplainerOpen(stored)).toBe(true);
  });
});
