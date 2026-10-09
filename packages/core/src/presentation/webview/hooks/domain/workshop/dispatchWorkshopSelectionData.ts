/** Authoritative target routing for Workshop consumers of the shared selection wire. */

import type { SelectionDataMessage } from '@messages';

export interface WorkshopSelectionDataConsumers {
  handleExcerptVerification: (message: SelectionDataMessage) => void;
  handleCreativeVariationsSubject: (message: SelectionDataMessage) => void;
  handleShowVsTellBeat: (message: SelectionDataMessage) => void;
}

export function dispatchWorkshopSelectionData(
  message: SelectionDataMessage,
  consumers: WorkshopSelectionDataConsumers
): void {
  switch (message.payload.target) {
    case 'workshop_excerpt_verify':
      consumers.handleExcerptVerification(message);
      return;
    case 'workshop_creative_variations_subject':
      consumers.handleCreativeVariationsSubject(message);
      return;
    case 'workshop_show_vs_tell_beat':
      consumers.handleShowVsTellBeat(message);
      return;
    default:
      return;
  }
}
