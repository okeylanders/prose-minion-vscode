/**
 * The context-paths card's controls (ADR 2026-11-19 D27): the domain hook's
 * Apply and its answers, with the room's lock, in the shape the bubble
 * takes. The app composes it in one line, as it composes the receipt's.
 */

import * as React from 'react';
import {
  useWorkshopLocationsProposal,
  type UseWorkshopLocationsProposalOptions
} from '@hooks/domain/workshop/useWorkshopLocationsProposal';
import type { WorkshopLocationsProposalControls } from './WorkshopLocationsProposalCard';

export function useWorkshopLocationsProposalControls(
  options: UseWorkshopLocationsProposalOptions & { locked: boolean }
): WorkshopLocationsProposalControls {
  const { applying, feedback, apply } = useWorkshopLocationsProposal({
    roomKey: options.roomKey,
    ...(options.roomRevision !== undefined ? { roomRevision: options.roomRevision } : {})
  });
  return React.useMemo(() => ({ applying, feedback, locked: options.locked, onApply: apply }), [applying, feedback, options.locked, apply]);
}
