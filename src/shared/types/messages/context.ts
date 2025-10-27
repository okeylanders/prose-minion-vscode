/**
 * Context domain messages
 * Context generation and project awareness
 */

import { BaseMessage, MessageType } from './base';
import { ContextPathGroup } from '../context';

export interface GenerateContextMessage extends BaseMessage {
  type: MessageType.GENERATE_CONTEXT;
  excerpt: string;
  existingContext?: string;
  sourceFileUri?: string;
  requestedGroups?: ContextPathGroup[];
}

export interface ContextResultMessage extends BaseMessage {
  type: MessageType.CONTEXT_RESULT;
  result: string;
  toolName: string;
  requestedResources?: string[];
}
