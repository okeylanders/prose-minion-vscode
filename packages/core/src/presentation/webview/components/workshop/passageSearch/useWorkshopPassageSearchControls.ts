/**
 * The passage-search card's controls (ADR 2026-11-20 D20): the domain
 * hook's actions and answers, with the room's lock, in the shape the bubble
 * takes. The app composes it in one line, as it composes the context-paths
 * card's.
 */

import * as React from 'react';
import {
  useWorkshopPassageSearch,
  type UseWorkshopPassageSearchOptions
} from '@hooks/domain/workshop/useWorkshopPassageSearch';
import type { WorkshopPassageSearchControls } from './WorkshopPassageSearchCard';

export function useWorkshopPassageSearchControls(
  options: UseWorkshopPassageSearchOptions & { locked: boolean }
): WorkshopPassageSearchControls {
  const search = useWorkshopPassageSearch({
    roomKey: options.roomKey,
    ...(options.roomRevision !== undefined ? { roomRevision: options.roomRevision } : {})
  });
  const { estimates, busy, progress, feedback, requestEstimate, run, stop, cancel, send, discard, openReport } = search;
  return React.useMemo(() => ({
    estimates, busy, progress, feedback, locked: options.locked,
    onEstimate: requestEstimate, onRun: run, onStop: stop, onCancel: cancel, onSend: send, onDiscard: discard, onOpenReport: openReport
  }), [estimates, busy, progress, feedback, options.locked, requestEstimate, run, stop, cancel, send, discard, openReport]);
}
