/**
 * Dictionary domain messages
 * Dictionary lookup and word operations
 */

import { MessageEnvelope, MessageType } from './base';
import { TokenUsage } from './tokenUsage';

export interface DictionaryEntryOptions {
  /** Include the Topic & Related Lexicon appendix unless explicitly disabled. */
  includeEncyclopedia?: boolean;
  /**
   * Include the 🎨 Chromatic Palettes section (`pm-palette` fences) ONLY when
   * explicitly `true`. Absent means OFF, unlike `includeEncyclopedia`: callers
   * that cannot render palette fences (Workshop personas, a console host)
   * must never receive them by default. The Dictionary UI always sends a boolean.
   */
  includePalettes?: boolean;
}

export type ResolvedDictionaryEntryOptions = Required<DictionaryEntryOptions>;

/**
 * Apply each entry option's documented default and drop every non-option
 * field, so handlers can forward a payload's entry options as one object.
 * The `Required` return type makes a new option fail to compile here until
 * its default is decided.
 */
export function resolveDictionaryEntryOptions(
  options: DictionaryEntryOptions = {}
): ResolvedDictionaryEntryOptions {
  return {
    includeEncyclopedia: options.includeEncyclopedia !== false,
    includePalettes: options.includePalettes === true
  };
}

export interface LookupDictionaryPayload extends DictionaryEntryOptions {
  word: string;
  contextText?: string;
  /** Source of the selected word, recorded in history to restore the "Source:" line. */
  sourceUri?: string;
  relativePath?: string;
}

export interface LookupDictionaryMessage extends MessageEnvelope<LookupDictionaryPayload> {
  type: MessageType.LOOKUP_DICTIONARY;
}

export interface DictionaryResultPayload {
  result: string;
  toolName: string;
  /** The history entry this result was recorded as; absent when it was not recorded. */
  historyEntryId?: string;
}

export interface DictionaryResultMessage extends MessageEnvelope<DictionaryResultPayload> {
  type: MessageType.DICTIONARY_RESULT;
}

// Fast (parallel) dictionary generation

export interface FastGenerateDictionaryPayload extends DictionaryEntryOptions {
  word: string;
  context?: string;
  sourceUri?: string;
  relativePath?: string;
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
  /** The history entry this result was recorded as; absent when it was not recorded. */
  historyEntryId?: string;
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
