/**
 * Which models wrote a Writer's Dictionary entry, for a Workshop turn's model
 * stamp (ADR 2026-11-03 D7: a persona's dictionary lookups, scope
 * `dictionary`). History keeps recording its own `modelIds`; this is the
 * stamp's stricter reading: served ids are only those the provider named.
 */

import type { AnalysisRunModel } from '@/domain/models/AnalysisResult';
import type { ExecutionResult } from '@orchestration/AgentRunContracts';
import type { InferenceReplySource } from '@messages';

export interface DictionaryRunModels {
  readonly model?: AnalysisRunModel;
  readonly replySource?: InferenceReplySource;
}

/** One single-call lookup's run, scoped `dictionary`. */
export function dictionaryRunModel(result: Pick<ExecutionResult, 'models' | 'replySource'>): DictionaryRunModels {
  return {
    ...(result.models
      ? {
          model: {
            scope: 'dictionary',
            requestedModelId: result.models.requestedModelId,
            servedModelIds: [...result.models.servedModelIds]
          }
        }
      : {}),
    ...(result.replySource ? { replySource: result.replySource } : {})
  };
}

/** A block's run, numbered in the order its request was sent. */
export type DictionaryBlockRun = Pick<ExecutionResult, 'models' | 'replySource'> & {
  readonly dispatchOrder?: number;
};

/**
 * A full entry's runs, one per block whose text the entry kept. Read in the
 * order the requests were sent, not the order the blocks are shown (D7; Astra
 * N-02): the entry was requested of the earliest-sent block's model, served
 * by every model the blocks' providers named in that order, and is a provider
 * reply only when every block in it was one; a block the engine had to fill
 * in makes the entry unattributable.
 */
export function dictionaryEntryRunModel(
  includedBlocks: ReadonlyArray<DictionaryBlockRun>
): DictionaryRunModels {
  const sent = [...includedBlocks].sort(
    (left, right) => (left.dispatchOrder ?? Number.MAX_SAFE_INTEGER) - (right.dispatchOrder ?? Number.MAX_SAFE_INTEGER)
  );
  const first = sent.find((block) => block.models)?.models;
  if (!first || sent.length === 0) {
    return {};
  }
  const servedModelIds: string[] = [];
  for (const block of sent) {
    for (const id of block.models?.servedModelIds ?? []) {
      if (!servedModelIds.includes(id)) {
        servedModelIds.push(id);
      }
    }
  }
  return {
    model: { scope: 'dictionary', requestedModelId: first.requestedModelId, servedModelIds },
    replySource: includedBlocks.every((block) => block.replySource === 'provider') ? 'provider' : 'host-fallback'
  };
}
