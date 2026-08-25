/** Semantic and referential integrity for structurally valid Creative drafts. */

import type {
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsWorkup
} from '@messages';
import { shapeError } from '@/application/services/workshop/persistedValidation';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import { CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION } from '@messages';
import {
  isCreativeVariationsWorkupId
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsWorkupId';
import {
  creativeVariationsFlagId,
  creativeVariationsSourceReferenceKey
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';

export function assertCreativeVariationsDraftIntegrity(
  draft: WorkshopCreativeVariationsDraft,
  path: string
): void {
  assertProvenanceIntegrity(draft, path);
  assertSourceReferenceIntegrity(draft, path);

  if (draft.workup === null) {
    if (draft.selections.length > 0) {
      shapeError(`${path}.selections`, 'empty when no generated workup exists');
    }
    return;
  }

  assertWorkupIntegrity(draft, draft.workup, path);
}

function assertProvenanceIntegrity(draft: WorkshopCreativeVariationsDraft, path: string): void {
  const provenance = draft.subject.provenance;
  if (provenance.kind !== 'excerpt') {
    return;
  }
  const hasStart = provenance.startLine !== undefined;
  const hasEnd = provenance.endLine !== undefined;
  if (hasStart !== hasEnd) {
    shapeError(`${path}.subject.provenance`, 'both startLine and endLine, or neither');
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
    shapeError(`${path}.subject.provenance`, 'a valid 1-based inclusive line range');
  }
}

function assertSourceReferenceIntegrity(
  draft: WorkshopCreativeVariationsDraft,
  path: string
): void {
  const keys = new Set<string>();
  for (const reference of draft.surroundingContext.sourceReferences) {
    const key = creativeVariationsSourceReferenceKey(reference);
    if (keys.has(key)) {
      shapeError(
        `${path}.surroundingContext.sourceReferences`,
        'source references without duplicates'
      );
    }
    keys.add(key);
  }
}

function assertWorkupIntegrity(
  draft: WorkshopCreativeVariationsDraft,
  workup: WorkshopCreativeVariationsWorkup,
  path: string
): void {
  if (!isCreativeVariationsWorkupId(workup.workupId)) {
    shapeError(`${path}.workup.workupId`, 'a host-minted cvw-<UUID> id');
  }
  if (workup.cards.length !== draft.requestedCount) {
    shapeError(`${path}.workup.cards`, `exactly ${draft.requestedCount} requested cards`);
  }

  for (const [index, card] of workup.cards.entries()) {
    const expectedPosition = index + 1;
    if (card.position !== expectedPosition) {
      shapeError(
        `${path}.workup.cards[${index}].position`,
        `contiguous position ${expectedPosition}`
      );
    }
    for (const [flagIndex, flag] of card.invariantFlags.entries()) {
      const expectedId = creativeVariationsFlagId(
        workup.workupId,
        card.position,
        flagIndex + 1
      );
      if (flag.id !== expectedId) {
        shapeError(
          `${path}.workup.cards[${index}].invariantFlags[${flagIndex}].id`,
          `host-derived id ${expectedId}`
        );
      }
      const declaredInvariant = flag.invariantField === 'must-survive'
        ? draft.invariants.mustSurvive
        : draft.invariants.mustNotChange;
      if (declaredInvariant.trim().length === 0) {
        shapeError(
          `${path}.workup.cards[${index}].invariantFlags[${flagIndex}].invariantField`,
          'a writer-declared nonblank invariant field'
        );
      }
      if (flag.kind === 'hard-conflict' && flag.invariantField !== 'must-not-change') {
        shapeError(
          `${path}.workup.cards[${index}].invariantFlags[${flagIndex}].kind`,
          'hard-conflict only against must-not-change'
        );
      }
    }
  }

  assertOverlapIntegrity(draft, workup, path);
  assertSelectionsIntegrity(draft, workup, path);
}

function assertOverlapIntegrity(
  draft: WorkshopCreativeVariationsDraft,
  workup: WorkshopCreativeVariationsWorkup,
  path: string
): void {
  let expected: WorkshopCreativeVariationsWorkup['overlap'];
  try {
    expected = computeCreativeVariationsTextualOverlap(draft.subject.text, workup.cards);
  } catch (error) {
    shapeError(
      `${path}.workup.cards`,
      error instanceof Error ? error.message : 'valid textual overlap inputs'
    );
  }
  if (workup.overlap.pairs.length !== expected.pairs.length) {
    shapeError(`${path}.workup.overlap.pairs`, `all ${expected.pairs.length} unordered pairs`);
  }

  for (const [index, pair] of workup.overlap.pairs.entries()) {
    const expectedPair = expected.pairs[index];
    if (
      pair.leftPosition !== expectedPair.leftPosition
      || pair.rightPosition !== expectedPair.rightPosition
      || pair.prose !== expectedPair.prose
      || pair.direction !== expectedPair.direction
      || pair.maximum !== expectedPair.maximum
    ) {
      shapeError(
        `${path}.workup.overlap.pairs[${index}]`,
        `recomputed ${CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION} evidence for pair ${expectedPair.leftPosition}-${expectedPair.rightPosition}`
      );
    }
  }

  if (
    workup.overlap.maximumPair.leftPosition !== expected.maximumPair.leftPosition
    || workup.overlap.maximumPair.rightPosition !== expected.maximumPair.rightPosition
    || workup.overlap.maximumPair.score !== expected.maximumPair.score
  ) {
    shapeError(
      `${path}.workup.overlap.maximumPair`,
      'the first recomputed pair at the set maximum'
    );
  }
}

function assertSelectionsIntegrity(
  draft: WorkshopCreativeVariationsDraft,
  workup: WorkshopCreativeVariationsWorkup,
  path: string
): void {
  const positions = new Set<number>();
  for (const [index, selection] of draft.selections.entries()) {
    const selectionPath = `${path}.selections[${index}]`;
    if (!Number.isSafeInteger(selection.position) || selection.position < 1) {
      shapeError(`${selectionPath}.position`, 'a positive card position');
    }
    if (positions.has(selection.position)) {
      shapeError(`${path}.selections`, 'selections without duplicate card positions');
    }
    positions.add(selection.position);

    const card = workup.cards[selection.position - 1];
    if (!card || card.position !== selection.position) {
      shapeError(`${selectionPath}.position`, 'a card in the current workup');
    }
  }
}
