/**
 * Creative Variations development-checkpoint repairs (ADR 2026-07-30).
 *
 * The codec owns the exact current shape; this module owns how a draft saved
 * by an earlier development build is recognized and repaired into it. Every
 * repair here is narrowly named, deterministic, logged by name through the
 * persistence coordinator, and regression-tested with an old-shape fixture.
 * None of them is a version migration: no Marketplace release wrote these
 * shapes, so `schemaVersion` is untouched.
 */

import type { WorkshopCreativeVariationsDraft } from '@messages';
import {
  arrayOf,
  objectAt,
  stringAt
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
import {
  assertCreativeVariationsDraftShape,
  cloneCreativeVariationsDraft
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';

/**
 * `dropped-creative-variations-advisory-acceptance`: from `d14ab795`
 * (2026-08-10) until `e28b3fbc` (2026-08-15), a draft selection persisted
 * `acceptedAdvisoryRiskIds`, the advisory risks the writer had accepted for
 * that card under the exact-set commit-eligibility rule. `e28b3fbc` made
 * advisory flags passive warnings and removed the rule, so the field means
 * nothing now. No release wrote it (v2.1.1 predates it, v2.2.0 follows its
 * removal), so it is dropped here, never migrated.
 */
export type CreativeVariationsCheckpointNormalization =
  | 'dropped-creative-variations-advisory-acceptance';

const LEGACY_ADVISORY_ACCEPTANCE = 'acceptedAdvisoryRiskIds';

/**
 * The checkpoint grammar is the current grammar plus exactly one legacy key:
 * `acceptedAdvisoryRiskIds` on a draft selection, as an array of strings.
 * Any other unknown key, anywhere, is still refused by the current shape.
 */
export function assertCreativeVariationsDraftCheckpointShape(
  value: unknown,
  path: string
): void {
  assertCreativeVariationsDraftShape(withoutLegacyAdvisoryAcceptance(value, path).draft, path);
}

export function normalizeCreativeVariationsDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopCreativeVariationsDraft,
  CreativeVariationsCheckpointNormalization
> {
  const path = 'Creative Variations checkpoint draft';
  const legacy = withoutLegacyAdvisoryAcceptance(value, path);
  assertCreativeVariationsDraftShape(legacy.draft, path);
  return {
    draft: cloneCreativeVariationsDraft(legacy.draft as WorkshopCreativeVariationsDraft),
    normalizations: legacy.dropped
      ? ['dropped-creative-variations-advisory-acceptance']
      : [],
    notices: []
  };
}

/**
 * Returns the draft with the legacy key removed from each selection that
 * carries it, after checking its old type. Anything that is not the expected
 * container passes through untouched, for the current shape to refuse.
 */
function withoutLegacyAdvisoryAcceptance(
  value: unknown,
  path: string
): { draft: unknown; dropped: boolean } {
  if (!isPlainObject(value) || !Array.isArray(value.selections)) {
    return { draft: value, dropped: false };
  }
  let dropped = false;
  const selections = value.selections.map((selection: unknown, index: number) => {
    if (
      !isPlainObject(selection)
      || !Object.prototype.hasOwnProperty.call(selection, LEGACY_ADVISORY_ACCEPTANCE)
    ) {
      return selection;
    }
    const selectionPath = `${path}.selections[${index}]`;
    const fieldPath = `${selectionPath}.${LEGACY_ADVISORY_ACCEPTANCE}`;
    arrayOf(selection[LEGACY_ADVISORY_ACCEPTANCE], fieldPath, stringAt);
    const { [LEGACY_ADVISORY_ACCEPTANCE]: _legacyAcceptance, ...current } = objectAt(
      selection,
      selectionPath
    );
    dropped = true;
    return current;
  });
  return dropped
    ? { draft: { ...value, selections }, dropped }
    : { draft: value, dropped };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}
