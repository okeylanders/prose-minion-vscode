/**
 * Dictionary domain messages
 * Dictionary lookup and word operations
 */

import { MessageEnvelope, MessageType } from './base';

export interface LookupDictionaryPayload {
  word: string;
  contextText?: string;
}

export interface LookupDictionaryMessage extends MessageEnvelope<LookupDictionaryPayload> {
  type: MessageType.LOOKUP_DICTIONARY;
}

export interface DictionaryResultPayload {
  result: string;
  toolName: string;
}

export interface DictionaryResultMessage extends MessageEnvelope<DictionaryResultPayload> {
  type: MessageType.DICTIONARY_RESULT;
}
