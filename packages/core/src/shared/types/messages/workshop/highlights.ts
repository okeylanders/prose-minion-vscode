import type { MessageEnvelope, MessageType } from '../base';

/** The snapshot generation distinguishes reopened or branched rooms with identical turn IDs. */
export interface WorkshopHighlightIdentity {
  roomRevision: number;
  turnId: string;
}

export interface WorkshopHighlightMessage extends MessageEnvelope<WorkshopHighlightIdentity> {
  type: MessageType.WORKSHOP_SHOW_HIGHLIGHTS | MessageType.WORKSHOP_CLEAR_HIGHLIGHTS;
}
