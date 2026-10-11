/**
 * Show vs. Tell draft fixtures drawn from the Spread 04 design workup
 * (seven variants: 2 · 2 · 2 · 1). Ids are derived exactly as the host derives
 * them, so a fixture is valid only while the derivation rules hold.
 */

import {
  SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellVariant
} from '@messages';
import {
  showVsTellFlagId,
  showVsTellVariantId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

export const SHOW_VS_TELL_FIXTURE_WORKUP_ID = 'svtw-00000000-0000-4000-8000-000000000001';

export const fixtureVariantId = (ordinal: number): string =>
  showVsTellVariantId(SHOW_VS_TELL_FIXTURE_WORKUP_ID, ordinal);

export const fixtureFlagId = (variantOrdinal: number, flagOrdinal: number): string =>
  showVsTellFlagId(fixtureVariantId(variantOrdinal), flagOrdinal);

type VariantSeed = Omit<WorkshopShowVsTellVariant, 'id' | 'invariantFlags'> & {
  invariantFlags?: Array<Omit<WorkshopShowVsTellVariant['invariantFlags'][number], 'id'>>;
};

const variant = (ordinal: number, seed: VariantSeed): WorkshopShowVsTellVariant => ({
  id: fixtureVariantId(ordinal),
  prose: seed.prose,
  channels: seed.channels,
  gains: seed.gains,
  costs: seed.costs,
  direction: seed.direction,
  invariantFlags: (seed.invariantFlags ?? []).map((flag, index) => ({
    ...flag,
    id: fixtureFlagId(ordinal, index + 1)
  })) as WorkshopShowVsTellVariant['invariantFlags']
});

/** A committed-shape draft: generated workup, two kept variants, a note. */
export const generatedShowVsTellDraft = (): WorkshopShowVsTellDraft => ({
  beat: {
    text: 'She hadn’t trusted him since the funeral.',
    provenance: {
      kind: 'excerpt',
      relativePath: 'chapters/four.md',
      startLine: 12,
      endLine: 12
    }
  },
  surroundingContext: { writerText: '', sourceReferences: [{ kind: 'active-excerpt' }] },
  pov: { mode: 'close-third', focalCharacter: 'Daniel' },
  invariants: {
    mustSurvive: 'The distrust is old and funeral-rooted — and she never says it out loud.',
    mustNotChange: 'No flashback. Stay in the kitchen, stay in tonight.'
  },
  channels: ['observable-action', 'sensory-evidence'],
  lengthBudget: 'same-length',
  position: 'hinge',
  workup: {
    workupId: SHOW_VS_TELL_FIXTURE_WORKUP_ID,
    generationProtocolVersion: SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
    groups: [
      {
        kind: 'told-cleanly',
        variants: [
          variant(1, {
            prose: 'She hadn’t trusted him since the funeral.',
            channels: ['summary-exposition'],
            gains: 'Speed, certainty, nine words.',
            costs: 'Every scrap of reader work, and the doubt that would have made her interesting.',
            direction: 'keep the flat tell'
          }),
          variant(2, {
            prose: 'Since the funeral she had answered his questions and volunteered nothing.',
            channels: ['summary-exposition'],
            gains: 'A whole year in one clause, and a fact the reader can carry forward.',
            costs: 'Scene time this beat was never going to get.',
            direction: 'summarize the year — pattern, not incident'
          })
        ]
      },
      {
        kind: 'shown-as-evidence',
        variants: [
          variant(3, {
            prose: 'She took the mug with her left hand and kept the right one on the doorframe.',
            channels: ['observable-action'],
            gains: 'Deniability: nothing is claimed, so nothing can be argued with.',
            costs: 'Precision: some readers will only see a woman holding a door.',
            direction: 'guard as body fact — hand, doorframe; claim nothing',
            invariantFlags: [{
              invariantField: 'must-survive',
              kind: 'advisory-risk',
              note: 'The guard may read as fear rather than old distrust.'
            }]
          }),
          variant(4, {
            prose: 'The kitchen smelled of lilies again. She breathed through her mouth until he sat down.',
            channels: ['sensory-evidence'],
            gains: 'The funeral in the room without naming it, plus a body under strain.',
            costs: 'Two lines, and it depends on a reader who catches lilies.',
            direction: 'funeral arrives by smell; her body manages it, unexplained',
            invariantFlags: [{
              invariantField: 'must-not-change',
              kind: 'hard-conflict',
              note: 'The lilies may pull the scene toward a flashback.'
            }]
          })
        ]
      },
      {
        kind: 'shown-from-inside',
        variants: [
          variant(5, {
            prose: 'He had learned the pause before she answered him. Since March it had been three seconds long.',
            channels: ['interiority'],
            gains: 'The fact and the ache at once, inside his POV.',
            costs: 'A narrator who now admits he is counting.',
            direction: 'his inference — what he has learned to measure in her'
          }),
          variant(6, {
            prose: '“Ask me the real question,” she said.\n“I don’t have a real question.”\n“You never do. Not since March.”',
            channels: ['dialogue-subtext'],
            gains: 'Her voice instead of his summary, and a move in a game they both play.',
            costs: 'Control: subtext reads as banter if the beats around it are warm.',
            direction: 'subtext in dialogue — she names the month, not the feeling'
          })
        ]
      },
      {
        kind: 'mixed',
        variants: [
          variant(7, {
            prose: 'Since the funeral she had volunteered nothing. Tonight she took the mug with her left hand and left the right one on the doorframe.',
            channels: ['summary-exposition', 'observable-action'],
            gains: 'Both budgets: tells the year, shows the second that matters.',
            costs: 'Almost nothing, which is why it is usually the answer, and worth distrusting once.',
            direction: 'tell the year, show tonight — summary then scene'
          })
        ]
      }
    ]
  },
  kept: [
    { variantId: fixtureVariantId(3), carryMode: 'direction' },
    { variantId: fixtureVariantId(7), carryMode: 'prose' }
  ],
  note: 'the tell can stay if the fulcrum is shown'
});

/** A fresh authoring draft before any generation, at the shipped defaults. */
export const ungeneratedShowVsTellDraft = (): WorkshopShowVsTellDraft => ({
  beat: {
    text: 'She hadn’t trusted him since the funeral.',
    provenance: { kind: 'pasted' }
  },
  surroundingContext: { writerText: '', sourceReferences: [] },
  pov: { mode: 'unspecified', focalCharacter: '' },
  invariants: {
    mustSurvive: 'The distrust is old and funeral-rooted.',
    mustNotChange: ''
  },
  channels: ['observable-action', 'sensory-evidence'],
  lengthBudget: 'same-length',
  position: 'hinge',
  workup: null,
  kept: [],
  note: ''
});
