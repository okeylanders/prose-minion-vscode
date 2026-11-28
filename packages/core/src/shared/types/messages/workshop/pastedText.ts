import type { MessageEnvelope, MessageType } from '../base';

export type WorkshopMessageTextAction = 'stage' | 'read' | 'update' | 'take' | 'remove';

export interface WorkshopMessageTextIdentity {
  requestId: string;
  roomRevision: number;
  action: WorkshopMessageTextAction;
}

export type WorkshopStageMessageTextPayload = WorkshopMessageTextIdentity & (
  | { action: 'stage'; text: string }
  | { action: 'update'; attachmentId: string; text: string }
  | { action: 'read' | 'take' | 'remove'; attachmentId: string }
);

export interface WorkshopStageMessageTextMessage extends MessageEnvelope<WorkshopStageMessageTextPayload> {
  type: MessageType.WORKSHOP_STAGE_MESSAGE_TEXT;
}

export type WorkshopMessageTextResultPayload = WorkshopMessageTextIdentity & (
  | { ok: false; reason: string }
  | { ok: true; attachmentId: string; text?: string }
);

export interface WorkshopMessageTextResultMessage extends MessageEnvelope<WorkshopMessageTextResultPayload> {
  type: MessageType.WORKSHOP_MESSAGE_TEXT_RESULT;
}
