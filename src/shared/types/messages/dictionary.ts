/**
 * Dictionary domain messages
 * Dictionary lookup and word operations
 */

import { BaseMessage, MessageType } from './base';

export interface LookupDictionaryMessage extends BaseMessage {
  type: MessageType.LOOKUP_DICTIONARY;
  word: string;
  contextText?: string;
}

export interface DictionaryResultMessage extends BaseMessage {
  type: MessageType.DICTIONARY_RESULT;
  result: string;
  toolName: string;
}
