import type { MessageEnvelope, MessageType } from '../base';

/** The snapshot generation distinguishes reopened or branched rooms with identical turn IDs. */
export interface WorkshopHighlightIdentity {
  roomRevision: number;
  turnId: string;
}

export interface WorkshopHighlightMessage extends MessageEnvelope<WorkshopHighlightIdentity> {
  type: MessageType.WORKSHOP_SHOW_HIGHLIGHTS | MessageType.WORKSHOP_CLEAR_HIGHLIGHTS;
}

/** Display data for the current question in this Workshop pane. The host retains the actual set and its source. */
interface WorkshopHighlightPromptBase {
  promptId: string;
  roomRevision: number;
  displayPath: string;
  count: number;
}

export type WorkshopHighlightPrompt = WorkshopHighlightPromptBase & (
  | { kind: 'proposal'; persona: string; title: string }
  | { kind: 'restore'; setCount: number }
);

export interface WorkshopHighlightPromptAnswer {
  promptId: string;
  roomRevision: number;
  choice: 'apply' | 'skip' | 'restore' | 'not-now' | 'suppress';
}

export interface WorkshopAnswerHighlightPromptMessage extends MessageEnvelope<WorkshopHighlightPromptAnswer> {
  type: MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT;
}
