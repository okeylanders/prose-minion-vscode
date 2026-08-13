/** Closed fan-out for Workshop consumers of the shared selection wire. */

import type { SelectionDataMessage } from '@messages';

export interface WorkshopSelectionDataConsumers {
  handleExcerptVerification: (message: SelectionDataMessage) => void;
  handleCreativeVariationsSubject: (payload: SelectionDataMessage['payload']) => void;
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
      consumers.handleCreativeVariationsSubject(message.payload);
      return;
    default:
      return;
  }
}
