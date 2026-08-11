/** Semantic and referential integrity for structurally valid Creative drafts. */

import type {
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsPairOverlap,
  WorkshopCreativeVariationsSelection,
  WorkshopCreativeVariationsWorkup
} from '@messages';
import { shapeError } from '@/application/services/workshop/persistedValidation';

const WORKUP_ID_PATTERN = /^cvw-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

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
    const key = reference.kind === 'active-excerpt'
      ? 'active-excerpt'
      : `context-attachment:${reference.attachmentId}`;
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
  if (!WORKUP_ID_PATTERN.test(workup.workupId)) {
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
      const expectedId = `${workup.workupId}:card-${card.position}:flag-${flagIndex + 1}`;
      if (flag.id !== expectedId) {
        shapeError(
          `${path}.workup.cards[${index}].invariantFlags[${flagIndex}].id`,
          `host-derived id ${expectedId}`
        );
      }
      if (
        flag.invariantField === 'must-not-change'
        && draft.invariants.mustNotChange.trim().length === 0
      ) {
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

  assertOverlapIntegrity(workup, path);
  assertSelectionsIntegrity(draft, workup, path);
}

function assertOverlapIntegrity(
  workup: WorkshopCreativeVariationsWorkup,
  path: string
): void {
  const expectedPairs: Array<[number, number]> = [];
  for (let left = 1; left < workup.cards.length; left += 1) {
    for (let right = left + 1; right <= workup.cards.length; right += 1) {
      expectedPairs.push([left, right]);
    }
  }
  if (workup.overlap.pairs.length !== expectedPairs.length) {
    shapeError(`${path}.workup.overlap.pairs`, `all ${expectedPairs.length} unordered pairs`);
  }

  for (const [index, pair] of workup.overlap.pairs.entries()) {
    const expected = expectedPairs[index];
    if (pair.leftPosition !== expected[0] || pair.rightPosition !== expected[1]) {
      shapeError(
        `${path}.workup.overlap.pairs[${index}]`,
        `canonical pair ${expected[0]}-${expected[1]}`
      );
    }
    assertOverlapScore(pair.prose, `${path}.workup.overlap.pairs[${index}].prose`);
    assertOverlapScore(pair.direction, `${path}.workup.overlap.pairs[${index}].direction`);
    assertOverlapScore(pair.maximum, `${path}.workup.overlap.pairs[${index}].maximum`);
    if (pair.maximum !== Math.max(pair.prose, pair.direction)) {
      shapeError(
        `${path}.workup.overlap.pairs[${index}].maximum`,
        'the maximum of prose and direction overlap'
      );
    }
  }

  const maximumPair = firstMaximumPair(workup.overlap.pairs);
  if (
    workup.overlap.maximumPair.leftPosition !== maximumPair.leftPosition
    || workup.overlap.maximumPair.rightPosition !== maximumPair.rightPosition
    || workup.overlap.maximumPair.score !== maximumPair.maximum
  ) {
    shapeError(`${path}.workup.overlap.maximumPair`, 'the first pair at the set maximum');
  }
}

function assertOverlapScore(value: number, path: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 100) {
    shapeError(path, 'an integer from 0 through 100');
  }
}

function firstMaximumPair(
  pairs: WorkshopCreativeVariationsPairOverlap[]
): WorkshopCreativeVariationsPairOverlap {
  return pairs.reduce((maximum, pair) => pair.maximum > maximum.maximum ? pair : maximum);
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
    assertSelectionRiskIntegrity(selection, card.invariantFlags, selectionPath);
  }
}

function assertSelectionRiskIntegrity(
  selection: WorkshopCreativeVariationsSelection,
  flags: WorkshopCreativeVariationsWorkup['cards'][number]['invariantFlags'],
  path: string
): void {
  if (flags.some((flag) => flag.kind === 'hard-conflict')) {
    shapeError(path, 'a card without a hard conflict');
  }
  const advisoryIds = flags
    .filter((flag) => flag.kind === 'advisory-risk')
    .map((flag) => flag.id);
  const acceptedIds = new Set(selection.acceptedAdvisoryRiskIds);
  if (acceptedIds.size !== selection.acceptedAdvisoryRiskIds.length) {
    shapeError(`${path}.acceptedAdvisoryRiskIds`, 'accepted risks without duplicates');
  }
  if (
    acceptedIds.size !== advisoryIds.length
    || advisoryIds.some((id) => !acceptedIds.has(id))
  ) {
    shapeError(
      `${path}.acceptedAdvisoryRiskIds`,
      'exactly every advisory risk declared by the selected card'
    );
  }
}
