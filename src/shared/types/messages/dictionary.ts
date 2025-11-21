/**
 * Dictionary domain messages
 * Dictionary lookup and word operations
 */

import { MessageEnvelope, MessageType, TokenUsage } from './base';

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

// Fast (parallel) dictionary generation

export interface FastGenerateDictionaryPayload {
  word: string;
  context?: string;
  sourceUri?: string;
}

export interface FastGenerateDictionaryMessage extends MessageEnvelope<FastGenerateDictionaryPayload> {
  type: MessageType.FAST_GENERATE_DICTIONARY;
}

export interface DictionaryBlockResult {
  blockName: string;
  content: string;
  duration: number;
  error?: string;
  usage?: TokenUsage;
}

export interface FastGenerateDictionaryResultPayload {
  word: string;
  result: string; // Combined markdown result
  metadata: {
    totalDuration: number;
    blockDurations: Record<string, number>;
    partialFailures: string[];
    successCount: number;
    totalBlocks: number;
  };
  usage?: TokenUsage; // Aggregated usage across all blocks
}

export interface FastGenerateDictionaryResultMessage extends MessageEnvelope<FastGenerateDictionaryResultPayload> {
  type: MessageType.FAST_GENERATE_DICTIONARY_RESULT;
}

export interface DictionaryGenerationProgressPayload {
  word: string;
  completedBlocks: string[];
  totalBlocks: number;
}

export interface DictionaryGenerationProgressMessage extends MessageEnvelope<DictionaryGenerationProgressPayload> {
  type: MessageType.DICTIONARY_GENERATION_PROGRESS;
}
