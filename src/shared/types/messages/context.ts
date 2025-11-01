/**
 * Context domain messages
 * Context generation and project awareness
 */

import { MessageEnvelope, MessageType } from './base';
import { ContextPathGroup } from '../context';

export interface GenerateContextPayload {
  excerpt: string;
  existingContext?: string;
  sourceFileUri?: string;
  requestedGroups?: ContextPathGroup[];
}

export interface GenerateContextMessage extends MessageEnvelope<GenerateContextPayload> {
  type: MessageType.GENERATE_CONTEXT;
}

export interface ContextResultPayload {
  result: string;
  toolName: string;
  requestedResources?: string[];
}

export interface ContextResultMessage extends MessageEnvelope<ContextResultPayload> {
  type: MessageType.CONTEXT_RESULT;
}
