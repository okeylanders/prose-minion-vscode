/**
 * Contract-shaped fixtures for the Creative Variations presentation tests.
 * Shapes mirror the persisted contract exactly (host-derived flag ids,
 * contiguous positions, full canonical pair matrix) so the components are
 * exercised against what the codec would actually let through.
 */

import {
  CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  WorkshopCreativeVariationCard,
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsWorkup
} from '@messages';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';

export const WORKUP_ID = 'cvw-1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
export const ADVISORY_RISK_ID = `${WORKUP_ID}:card-2:flag-1`;
export const HARD_CONFLICT_ID = `${WORKUP_ID}:card-3:flag-1`;
const baseDraftSubject =
  'He set the mug down where her hand could reach it without asking. She smiled.';

export const cardOne: WorkshopCreativeVariationCard = {
  position: 1,
  approach: 'Baseline — the competent fix',
  direction: 'cut the told line, downgrade the smile — baseline',
  prose:
    'He set the mug down where her hand could reach it without asking. Her mouth moved, not quite a smile.',
  tradeoff: {
    gain: 'the obvious win — nothing else is risked',
    cost: 'nothing, which is the problem'
  },
  invariantFlags: []
};

export const cardTwo: WorkshopCreativeVariationCard = {
  position: 2,
  approach: 'Her refusal, timed',
  direction: 'stage the distrust as a pause and an untouched mug',
  prose:
    'She let it sit long enough that he heard the kettle. She was not going to touch it while he was watching.',
  tradeoff: {
    gain: 'the distrust becomes an event the reader times',
    cost: 'the funeral leaves the paragraph entirely'
  },
  invariantFlags: [
    {
      id: ADVISORY_RISK_ID,
      invariantField: 'must-survive',
      kind: 'advisory-risk',
      note: 'adds a fact — the chair'
    }
  ]
};

export const cardThree: WorkshopCreativeVariationCard = {
  position: 3,
  approach: 'Absence as furniture',
  direction: 'stage the distrust as a pause and an untouched mug, still',
  prose:
    'She let it sit long enough that he heard the kettle. She was not going to touch it while he was watching. Still.',
  tradeoff: {
    gain: 'the loss pays again every time the kitchen appears',
    cost: 'a fact you did not have'
  },
  invariantFlags: [
    {
      id: HARD_CONFLICT_ID,
      invariantField: 'must-not-change',
      kind: 'hard-conflict',
      note: 'moves her closing line'
    }
  ]
};

export const workup: WorkshopCreativeVariationsWorkup = {
  workupId: WORKUP_ID,
  generationProtocolVersion: CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  cards: [cardOne, cardTwo, cardThree],
  overlap: computeCreativeVariationsTextualOverlap(
    baseDraftSubject,
    [cardOne, cardTwo, cardThree]
  )
};

export const baseDraft: WorkshopCreativeVariationsDraft = {
  subject: {
    text: baseDraftSubject,
    provenance: {
      kind: 'excerpt',
      relativePath: 'Drafts/chapter-five.md',
      startLine: 12,
      endLine: 18
    }
  },
  surroundingContext: { writerText: '', sourceReferences: [] },
  invariants: {
    mustSurvive: 'The distrust is old and funeral-rooted. The mug is offered, never handed.',
    mustNotChange: 'Her last line stays “Somebody had to.”'
  },
  intent: {
    kind: 'custom-aim',
    aim: 'let the props carry the grief instead of stated feeling',
    distance: 'tail'
  },
  requestedCount: 3,
  workup: null,
  selections: [],
  note: ''
};

export const generatedDraft: WorkshopCreativeVariationsDraft = {
  ...baseDraft,
  workup
};

export const emptyDraft: WorkshopCreativeVariationsDraft = {
  subject: { text: '', provenance: { kind: 'pasted' } },
  surroundingContext: { writerText: '', sourceReferences: [] },
  invariants: { mustSurvive: '', mustNotChange: '' },
  intent: { kind: 'custom-aim', aim: '', distance: 'tail' },
  requestedCount: 3,
  workup: null,
  selections: [],
  note: ''
};
