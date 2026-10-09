/** Semantic and referential integrity for structurally valid Show vs. Tell drafts. */

import type {
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellInvariants,
  WorkshopShowVsTellVariant,
  WorkshopShowVsTellWorkup
} from '@messages';
import { shapeError } from '@/application/services/workshop/persistedValidation';
import {
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_GROUPS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  compareShowVsTellSourceReferences,
  showVsTellFlagId,
  showVsTellProseComparisonKey,
  showVsTellSourceReferenceKey,
  showVsTellVariantId,
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  isShowVsTellWorkupId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellWorkupId';

const CHANNEL_ORDER: ReadonlyMap<string, number> = new Map(
  SHOW_VS_TELL_CHANNELS.map(({ id }, index) => [id, index])
);

/** Requires a current-shape assertion for the draft before this phase runs. */
export function assertShowVsTellDraftIntegrity(
  draft: WorkshopShowVsTellDraft,
  path: string
): void {
  assertProvenanceIntegrity(draft, path);
  assertSourceReferenceIntegrity(draft, path);
  assertPovIntegrity(draft, path);
  assertChannelsIntegrity(draft, path);

  if (draft.workup === null) {
    if (draft.kept.length > 0) {
      shapeError(`${path}.kept`, 'empty when no generated workup exists');
    }
    return;
  }

  assertShowVsTellWorkupIntegrity(draft.workup, draft.invariants, `${path}.workup`);
  assertKeptIntegrity(draft, draft.workup, path);
}

function assertProvenanceIntegrity(draft: WorkshopShowVsTellDraft, path: string): void {
  const provenance = draft.beat.provenance;
  if (provenance.kind !== 'excerpt') {
    return;
  }
  const hasStart = provenance.startLine !== undefined;
  const hasEnd = provenance.endLine !== undefined;
  if (hasStart !== hasEnd) {
    shapeError(`${path}.beat.provenance`, 'both startLine and endLine, or neither');
  }
  if (
    hasStart
    && (
      !Number.isSafeInteger(provenance.startLine)
      || !Number.isSafeInteger(provenance.endLine)
      || provenance.startLine! < 1
      || provenance.endLine! < provenance.startLine!
    )
  ) {
    shapeError(`${path}.beat.provenance`, 'a valid 1-based inclusive line range');
  }
}

/** Context sources are a set: unique, and in the one canonical order (D2). */
function assertSourceReferenceIntegrity(draft: WorkshopShowVsTellDraft, path: string): void {
  const keys = new Set<string>();
  const references = draft.surroundingContext.sourceReferences;
  for (const [index, reference] of references.entries()) {
    const key = showVsTellSourceReferenceKey(reference);
    if (keys.has(key)) {
      shapeError(`${path}.surroundingContext.sourceReferences`, 'source references without duplicates');
    }
    keys.add(key);
    if (index > 0 && compareShowVsTellSourceReferences(references[index - 1], reference) > 0) {
      shapeError(
        `${path}.surroundingContext.sourceReferences`,
        'source references in canonical order (active excerpt first, then attachments by ctx ordinal)'
      );
    }
  }
}

/** `unspecified` names no focal character, so the prompt never names one either. */
function assertPovIntegrity(draft: WorkshopShowVsTellDraft, path: string): void {
  if (draft.pov.mode === 'unspecified' && draft.pov.focalCharacter.trim().length > 0) {
    shapeError(`${path}.pov.focalCharacter`, 'blank when the POV mode is unspecified');
  }
}

/** Channel emphasis is a set (possibly empty, D4); one canonical order gives it one representation. */
function assertChannelsIntegrity(draft: WorkshopShowVsTellDraft, path: string): void {
  let previous = -1;
  for (const channel of draft.channels) {
    const order = CHANNEL_ORDER.get(channel)!;
    if (order <= previous) {
      shapeError(`${path}.channels`, 'unique channels in the fixed channel order');
    }
    previous = order;
  }
}

/**
 * Every rule a settled workup obeys, given the invariants it was generated
 * against. Persisted drafts and the provider response codec share this gate,
 * so a workup cannot be valid at generation and invalid at reopen. Requires a
 * current-shape assertion of the workup first.
 */
export function assertShowVsTellWorkupIntegrity(
  workup: WorkshopShowVsTellWorkup,
  invariants: WorkshopShowVsTellInvariants,
  path: string
): void {
  if (!isShowVsTellWorkupId(workup.workupId)) {
    shapeError(`${path}.workupId`, 'a host-minted svtw-<UUID> id');
  }

  const proseKeys = new Map<string, string>();
  let ordinal = 0;
  for (const [groupIndex, group] of workup.groups.entries()) {
    const groupPath = `${path}.groups[${groupIndex}]`;
    const expectedKind = SHOW_VS_TELL_GROUPS[groupIndex].kind;
    if (group.kind !== expectedKind) {
      shapeError(`${groupPath}.kind`, `${expectedKind} (all four groups, in their fixed order)`);
    }
    for (const [variantIndex, variant] of group.variants.entries()) {
      ordinal += 1;
      const variantPath = `${groupPath}.variants[${variantIndex}]`;
      assertVariantIntegrity(workup, invariants, variant, ordinal, variantPath);

      const proseKey = showVsTellProseComparisonKey(variant.prose);
      const duplicateOf = proseKeys.get(proseKey);
      if (duplicateOf !== undefined) {
        shapeError(`${variantPath}.prose`, `prose distinct from ${duplicateOf} after normalization`);
      }
      proseKeys.set(proseKey, variantPath);
    }
  }
}

function assertVariantIntegrity(
  workup: WorkshopShowVsTellWorkup,
  invariants: WorkshopShowVsTellInvariants,
  variant: WorkshopShowVsTellVariant,
  ordinal: number,
  path: string
): void {
  const expectedId = showVsTellVariantId(workup.workupId, ordinal);
  if (variant.id !== expectedId) {
    shapeError(`${path}.id`, `host-derived id ${expectedId}`);
  }
  if (new Set(variant.channels).size !== variant.channels.length) {
    shapeError(`${path}.channels`, 'channels without duplicates');
  }
  // No direction-versus-prose length rule (writer decision D5, 2026-10-09):
  // a told variant can be shorter than any honest direction for it, and the
  // meter already shows the real cost of either carry.

  for (const [flagIndex, flag] of variant.invariantFlags.entries()) {
    const flagPath = `${path}.invariantFlags[${flagIndex}]`;
    const expectedFlagId = showVsTellFlagId(expectedId, flagIndex + 1);
    if (flag.id !== expectedFlagId) {
      shapeError(`${flagPath}.id`, `host-derived id ${expectedFlagId}`);
    }
    const declaredInvariant = flag.invariantField === 'must-survive'
      ? invariants.mustSurvive
      : invariants.mustNotChange;
    if (declaredInvariant.trim().length === 0) {
      shapeError(`${flagPath}.invariantField`, 'a writer-declared nonblank invariant field');
    }
    // The flag union forbids this pairing at compile time; persisted JSON is untyped.
    if (flag.kind === 'hard-conflict' && flag.invariantField !== 'must-not-change') {
      shapeError(`${flagPath}.kind`, 'hard-conflict only against must-not-change');
    }
  }
}

/** Kept variants reference the current workup once each, in workup order. */
function assertKeptIntegrity(
  draft: WorkshopShowVsTellDraft,
  workup: WorkshopShowVsTellWorkup,
  path: string
): void {
  const ordinals = new Map(
    showVsTellWorkupVariants(workup).map((variant, index) => [variant.id, index + 1])
  );
  let previous = 0;
  for (const [index, kept] of draft.kept.entries()) {
    const keptPath = `${path}.kept[${index}]`;
    const ordinal = ordinals.get(kept.variantId);
    if (ordinal === undefined) {
      shapeError(`${keptPath}.variantId`, 'a variant in the current workup');
    }
    if (ordinal === previous) {
      shapeError(`${path}.kept`, 'kept variants without duplicates');
    }
    if (ordinal < previous) {
      shapeError(`${path}.kept`, 'kept variants in workup order');
    }
    previous = ordinal;
  }
}
