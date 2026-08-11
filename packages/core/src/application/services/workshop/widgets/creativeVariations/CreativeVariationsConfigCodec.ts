/** Creative Variations' exact persisted authoring-state contract. */

import {
  CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION,
  WorkshopCreativeVariationsDraft
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  arrayOf,
  boundedArrayAt,
  boundedStringAt,
  enumAt,
  exactKeys,
  exactObject,
  numberAt,
  objectAt,
  shapeError
} from '@/application/services/workshop/persistedValidation';
import type {
  WorkshopWidgetDraftRecoveryResult
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';
export {
  assertCreativeVariationsDraftIntegrity
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigIntegrity';

export interface CreativeVariationsDraftSummary {
  subjectPreview: string;
  selectionCount: number;
}

/** Creative Variations has never shipped, so no checkpoint defaults exist. */
export type CreativeVariationsCheckpointNormalization = never;

export function assertCreativeVariationsDraftCheckpointShape(
  value: unknown,
  path: string
): void {
  assertCreativeVariationsDraftShape(value, path);
}

export function assertCreativeVariationsDraftShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const draft = exactObject(
    value,
    path,
    [
      'subject',
      'surroundingContext',
      'invariants',
      'intent',
      'requestedCount',
      'workup',
      'selections',
      'note'
    ]
  );

  assertSubjectShape(draft.subject, `${path}.subject`);
  assertSurroundingContextShape(draft.surroundingContext, `${path}.surroundingContext`);

  const invariants = exactObject(
    draft.invariants,
    `${path}.invariants`,
    ['mustSurvive', 'mustNotChange']
  );
  boundedStringAt(
    invariants.mustSurvive,
    `${path}.invariants.mustSurvive`,
    budget.creativeMustSurviveCharacters,
    false
  );
  boundedStringAt(
    invariants.mustNotChange,
    `${path}.invariants.mustNotChange`,
    budget.creativeMustNotChangeCharacters
  );

  const intent = exactObject(draft.intent, `${path}.intent`, ['kind', 'aim', 'distance']);
  enumAt(intent.kind, `${path}.intent.kind`, ['custom-aim']);
  boundedStringAt(
    intent.aim,
    `${path}.intent.aim`,
    budget.creativeAimCharacters,
    false
  );
  enumAt(intent.distance, `${path}.intent.distance`, [
    'familiar',
    'adjacent',
    'tail',
    'far-tail'
  ]);

  assertRequestedCount(draft.requestedCount, `${path}.requestedCount`);
  if (draft.workup !== null) {
    assertWorkupShape(draft.workup, `${path}.workup`);
  }
  boundedArrayAt(draft.selections, `${path}.selections`, 0, 5, 'selections');
  arrayOf(draft.selections, `${path}.selections`, assertSelectionShape);
  boundedStringAt(draft.note, `${path}.note`, budget.creativeNoteCharacters);
}

function assertSubjectShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const subject = exactObject(value, path, ['text', 'provenance']);
  boundedStringAt(subject.text, `${path}.text`, budget.creativeSubjectCharacters, false);

  const provenance = objectAt(subject.provenance, `${path}.provenance`);
  if (provenance.kind === 'pasted') {
    exactKeys(provenance, `${path}.provenance`, ['kind']);
    return;
  }
  if (provenance.kind === 'excerpt') {
    exactKeys(
      provenance,
      `${path}.provenance`,
      ['kind', 'relativePath'],
      ['startLine', 'endLine']
    );
    boundedStringAt(
      provenance.relativePath,
      `${path}.provenance.relativePath`,
      budget.creativeProvenancePathCharacters,
      false
    );
    if (provenance.startLine !== undefined) {
      numberAt(provenance.startLine, `${path}.provenance.startLine`);
    }
    if (provenance.endLine !== undefined) {
      numberAt(provenance.endLine, `${path}.provenance.endLine`);
    }
    return;
  }
  shapeError(`${path}.provenance.kind`, 'pasted | excerpt');
}

function assertSurroundingContextShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const context = exactObject(value, path, ['writerText', 'sourceReferences']);
  boundedStringAt(
    context.writerText,
    `${path}.writerText`,
    budget.creativeContextCharacters
  );
  boundedArrayAt(
    context.sourceReferences,
    `${path}.sourceReferences`,
    0,
    budget.creativeSourceReferences,
    'source references'
  );
  arrayOf(context.sourceReferences, `${path}.sourceReferences`, (referenceValue, referencePath) => {
    const reference = objectAt(referenceValue, referencePath);
    if (reference.kind === 'active-excerpt') {
      exactKeys(reference, referencePath, ['kind']);
      return;
    }
    if (reference.kind === 'context-attachment') {
      exactKeys(reference, referencePath, ['kind', 'attachmentId']);
      boundedStringAt(
        reference.attachmentId,
        `${referencePath}.attachmentId`,
        budget.creativeSourceReferenceCharacters,
        false
      );
      if (!/^ctx-[1-9]\d*$/.test(reference.attachmentId as string)) {
        shapeError(`${referencePath}.attachmentId`, 'a ctx-<n> attachment id');
      }
      return;
    }
    shapeError(`${referencePath}.kind`, 'active-excerpt | context-attachment');
  });
}

function assertRequestedCount(value: unknown, path: string): void {
  numberAt(value, path);
  if (value !== 3 && value !== 4 && value !== 5) {
    shapeError(path, '3 | 4 | 5');
  }
}

function assertWorkupShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const workup = exactObject(
    value,
    path,
    ['workupId', 'generationProtocolVersion', 'cards', 'overlap']
  );
  boundedStringAt(
    workup.workupId,
    `${path}.workupId`,
    budget.creativeWorkupIdCharacters,
    false
  );
  numberAt(workup.generationProtocolVersion, `${path}.generationProtocolVersion`);
  if (workup.generationProtocolVersion !== CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION) {
    shapeError(
      `${path}.generationProtocolVersion`,
      String(CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION)
    );
  }
  boundedArrayAt(workup.cards, `${path}.cards`, 3, 5, 'cards');
  arrayOf(workup.cards, `${path}.cards`, assertCardShape);

  const overlap = exactObject(
    workup.overlap,
    `${path}.overlap`,
    ['algorithmVersion', 'pairs', 'maximumPair']
  );
  enumAt(
    overlap.algorithmVersion,
    `${path}.overlap.algorithmVersion`,
    [CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION]
  );
  boundedArrayAt(overlap.pairs, `${path}.overlap.pairs`, 3, 10, 'pairs');
  arrayOf(overlap.pairs, `${path}.overlap.pairs`, assertPairOverlapShape);
  const maximumPair = exactObject(
    overlap.maximumPair,
    `${path}.overlap.maximumPair`,
    ['leftPosition', 'rightPosition', 'score']
  );
  numberAt(maximumPair.leftPosition, `${path}.overlap.maximumPair.leftPosition`);
  numberAt(maximumPair.rightPosition, `${path}.overlap.maximumPair.rightPosition`);
  numberAt(maximumPair.score, `${path}.overlap.maximumPair.score`);
}

function assertCardShape(value: unknown, path: string): void {
  const budget = PROMPT_BUDGETS.workshopWidgets;
  const card = exactObject(
    value,
    path,
    ['position', 'approach', 'direction', 'prose', 'tradeoff', 'invariantFlags']
  );
  numberAt(card.position, `${path}.position`);
  boundedStringAt(
    card.approach,
    `${path}.approach`,
    budget.creativeApproachCharacters,
    false
  );
  boundedStringAt(
    card.direction,
    `${path}.direction`,
    budget.creativeDirectionCharacters,
    false
  );
  boundedStringAt(card.prose, `${path}.prose`, budget.creativeProseCharacters, false);
  const tradeoff = exactObject(card.tradeoff, `${path}.tradeoff`, ['gain', 'cost']);
  boundedStringAt(
    tradeoff.gain,
    `${path}.tradeoff.gain`,
    budget.creativeTradeoffCharacters,
    false
  );
  boundedStringAt(
    tradeoff.cost,
    `${path}.tradeoff.cost`,
    budget.creativeTradeoffCharacters,
    false
  );
  boundedArrayAt(
    card.invariantFlags,
    `${path}.invariantFlags`,
    0,
    budget.creativeFlagsPerCard,
    'invariant flags'
  );
  arrayOf(card.invariantFlags, `${path}.invariantFlags`, (flagValue, flagPath) => {
    const flag = exactObject(
      flagValue,
      flagPath,
      ['id', 'invariantField', 'kind', 'note']
    );
    boundedStringAt(
      flag.id,
      `${flagPath}.id`,
      budget.creativeWorkupIdCharacters + 40,
      false
    );
    enumAt(flag.invariantField, `${flagPath}.invariantField`, [
      'must-survive',
      'must-not-change'
    ]);
    enumAt(flag.kind, `${flagPath}.kind`, ['advisory-risk', 'hard-conflict']);
    boundedStringAt(
      flag.note,
      `${flagPath}.note`,
      budget.creativeFlagNoteCharacters,
      false
    );
  });
}

function assertPairOverlapShape(value: unknown, path: string): void {
  const pair = exactObject(
    value,
    path,
    ['leftPosition', 'rightPosition', 'prose', 'direction', 'maximum']
  );
  numberAt(pair.leftPosition, `${path}.leftPosition`);
  numberAt(pair.rightPosition, `${path}.rightPosition`);
  numberAt(pair.prose, `${path}.prose`);
  numberAt(pair.direction, `${path}.direction`);
  numberAt(pair.maximum, `${path}.maximum`);
}

function assertSelectionShape(value: unknown, path: string): void {
  const selection = exactObject(
    value,
    path,
    ['position', 'carryMode', 'acceptedAdvisoryRiskIds']
  );
  numberAt(selection.position, `${path}.position`);
  enumAt(selection.carryMode, `${path}.carryMode`, ['direction', 'full-prose']);
  boundedArrayAt(
    selection.acceptedAdvisoryRiskIds,
    `${path}.acceptedAdvisoryRiskIds`,
    0,
    PROMPT_BUDGETS.workshopWidgets.creativeFlagsPerCard,
    'accepted advisory risks'
  );
  arrayOf(
    selection.acceptedAdvisoryRiskIds,
    `${path}.acceptedAdvisoryRiskIds`,
    (id, idPath) => boundedStringAt(
      id,
      idPath,
      PROMPT_BUDGETS.workshopWidgets.creativeWorkupIdCharacters + 40,
      false
    )
  );
}

export function cloneCreativeVariationsDraft(
  draft: WorkshopCreativeVariationsDraft
): WorkshopCreativeVariationsDraft {
  return {
    subject: {
      text: draft.subject.text,
      provenance: { ...draft.subject.provenance }
    },
    surroundingContext: {
      writerText: draft.surroundingContext.writerText,
      sourceReferences: draft.surroundingContext.sourceReferences.map(
        (reference) => ({ ...reference })
      )
    },
    invariants: { ...draft.invariants },
    intent: { ...draft.intent },
    requestedCount: draft.requestedCount,
    workup: draft.workup === null
      ? null
      : {
          workupId: draft.workup.workupId,
          generationProtocolVersion: draft.workup.generationProtocolVersion,
          cards: draft.workup.cards.map((card) => ({
            position: card.position,
            approach: card.approach,
            direction: card.direction,
            prose: card.prose,
            tradeoff: { ...card.tradeoff },
            invariantFlags: card.invariantFlags.map((flag) => ({ ...flag }))
          })),
          overlap: {
            algorithmVersion: draft.workup.overlap.algorithmVersion,
            pairs: draft.workup.overlap.pairs.map((pair) => ({ ...pair })),
            maximumPair: { ...draft.workup.overlap.maximumPair }
          }
        },
    selections: draft.selections.map((selection) => ({
      position: selection.position,
      carryMode: selection.carryMode,
      acceptedAdvisoryRiskIds: [...selection.acceptedAdvisoryRiskIds]
    })),
    note: draft.note
  };
}

export function summarizeCreativeVariationsDraft(
  draft: WorkshopCreativeVariationsDraft
): CreativeVariationsDraftSummary {
  return {
    subjectPreview: draft.subject.text.slice(
      0,
      PROMPT_BUDGETS.workshopWidgets.creativeSubjectPreviewCharacters
    ),
    selectionCount: draft.selections.length
  };
}

export function normalizeCreativeVariationsDraftForHydration(
  value: unknown
): WorkshopWidgetDraftRecoveryResult<
  WorkshopCreativeVariationsDraft,
  CreativeVariationsCheckpointNormalization
> {
  assertCreativeVariationsDraftCheckpointShape(value, 'Creative Variations checkpoint draft');
  const draft = value as WorkshopCreativeVariationsDraft;
  return {
    draft: cloneCreativeVariationsDraft(draft),
    normalizations: [],
    notices: []
  };
}
