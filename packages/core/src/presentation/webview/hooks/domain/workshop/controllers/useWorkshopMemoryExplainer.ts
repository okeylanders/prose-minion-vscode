/**
 * Presentation controller for the Memory tab's "Memory isn't context"
 * explainer (Workshop Project Memory, Slice 6 live pass): whether it is open.
 *
 * It starts open, so a writer meets the difference between memory and
 * context the first time. Once the writer folds it away, it stays folded:
 * the choice is a per-viewer preference kept in webview state, never in the
 * session file or a setting.
 */

import * as React from 'react';

/** Reads a stored choice; anything but a boolean opens it. */
export function parseWorkshopMemoryExplainerOpen(value: unknown): boolean {
  return typeof value === 'boolean' ? value : true;
}

export interface UseWorkshopMemoryExplainerOptions {
  /** The stored choice from webview state, read by the caller; may be anything. */
  initialOpen?: unknown;
}

export interface WorkshopMemoryExplainerState {
  explainerOpen: boolean;
}

export interface WorkshopMemoryExplainerActions {
  toggleExplainer: () => void;
}

export interface WorkshopMemoryExplainerPersistence {
  workshopMemoryExplainerOpen: boolean;
}

export type UseWorkshopMemoryExplainerReturn = WorkshopMemoryExplainerState &
  WorkshopMemoryExplainerActions & {
    persistedState: WorkshopMemoryExplainerPersistence;
  };

export function useWorkshopMemoryExplainer({
  initialOpen
}: UseWorkshopMemoryExplainerOptions = {}): UseWorkshopMemoryExplainerReturn {
  const [explainerOpen, setExplainerOpen] = React.useState(
    () => parseWorkshopMemoryExplainerOpen(initialOpen)
  );

  const toggleExplainer = React.useCallback(() => {
    setExplainerOpen((open) => !open);
  }, []);

  const persistedState = React.useMemo<WorkshopMemoryExplainerPersistence>(
    () => ({ workshopMemoryExplainerOpen: explainerOpen }),
    [explainerOpen]
  );

  return { explainerOpen, toggleExplainer, persistedState };
}
