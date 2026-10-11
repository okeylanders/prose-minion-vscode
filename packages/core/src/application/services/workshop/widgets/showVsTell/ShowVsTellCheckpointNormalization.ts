/**
 * Show vs. Tell development-checkpoint repairs (ADR 2026-07-30).
 *
 * The codec owns the exact current shape; this module owns how a draft saved
 * by an earlier slice is recognized and repaired into it. Every repair here is
 * narrowly named, deterministic, logged by name through the persistence
 * coordinator, and regression-tested with an old-shape fixture. None of them
 * is a version migration: the pre-Slice-7 shape never shipped on the
 * Marketplace, so `schemaVersion` is untouched.
 */

import type { WorkshopShowVsTellDraft } from '@messages';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
import {
  assertShowVsTellDraftCheckpointShape,
  assertShowVsTellDraftShape,
  cloneShowVsTellDraft
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';

/**
 * Development-checkpoint repairs (ADR 2026-07-30), never version migrations.
 *
 * `defaulted-widget-show-vs-tell-surrounding-passage-text`: Slice 7 (D2)
 * added the required `surroundingContext.writerText`. A draft saved by an
 * earlier slice has only `sourceReferences`; it opens with a blank passage.
 * The recommendation seed's new `contextText` is optional, so a seed saved
 * before Slice 7 needs no repair.
 */
export type ShowVsTellCheckpointNormalization =
  | 'defaulted-widget-show-vs-tell-surrounding-passage-text';

export function normalizeShowVsTellDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopShowVsTellDraft,
  ShowVsTellCheckpointNormalization
> {
  assertShowVsTellDraftCheckpointShape(value, 'Show vs. Tell checkpoint draft');
  const draft = value as WorkshopShowVsTellDraft;
  const normalizations: ShowVsTellCheckpointNormalization[] = [];
  const defaultedPassageText = typeof draft.surroundingContext.writerText !== 'string';
  if (defaultedPassageText) {
    normalizations.push('defaulted-widget-show-vs-tell-surrounding-passage-text');
  }
  const normalized: WorkshopShowVsTellDraft = defaultedPassageText
    ? {
        ...draft,
        surroundingContext: { ...draft.surroundingContext, writerText: '' }
      }
    : draft;
  assertShowVsTellDraftShape(normalized, 'Recovered Show vs. Tell draft');
  return {
    draft: cloneShowVsTellDraft(normalized),
    normalizations,
    notices: []
  };
}
