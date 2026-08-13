import {
  CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
  CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION,
  WorkshopCreativeVariationsDraft
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  assertCreativeVariationsDraftCheckpointShape,
  assertCreativeVariationsDraftIntegrity,
  assertCreativeVariationsDraftShape,
  cloneCreativeVariationsDraft,
  normalizeCreativeVariationsDraftForHydration,
  summarizeCreativeVariationsDraft
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsConfigCodec';
import {
  createCreativeVariationsWorkupIdFactory
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsWorkupId';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';

const WORKUP_ID = 'cvw-00000000-0000-4000-8000-000000000001';
const advisoryId = `${WORKUP_ID}:card-1:flag-1`;

const draft = (): WorkshopCreativeVariationsDraft => {
  const value: WorkshopCreativeVariationsDraft = ({
  subject: {
    text: 'Mara folded the letter before she answered.',
    provenance: {
      kind: 'excerpt',
      relativePath: 'chapters/three.md',
      startLine: 18,
      endLine: 19
    }
  },
  surroundingContext: {
    writerText: 'Her brother has just asked whether she plans to leave.',
    sourceReferences: [
      { kind: 'active-excerpt' },
      { kind: 'context-attachment', attachmentId: 'ctx-2' }
    ]
  },
  invariants: {
    mustSurvive: 'Mara delays her answer and keeps the letter in hand.',
    mustNotChange: 'Third-person past; Mara does not reveal her decision.'
  },
  intent: {
    kind: 'custom-aim',
    aim: 'Make the delay feel deliberate without making Mara cold.',
    distance: 'tail'
  },
  requestedCount: 3,
  workup: {
    workupId: WORKUP_ID,
    generationProtocolVersion: CREATIVE_VARIATIONS_GENERATION_PROTOCOL_VERSION,
    cards: [
      {
        position: 1,
        approach: 'Displace the answer into the paper',
        direction: 'Let the fold become a precise delaying action.',
        prose: 'Mara sharpened the letter crease with one thumbnail before she looked up.',
        tradeoff: {
          gain: 'The delay becomes physical and intentional.',
          cost: 'The precision can read as defensive.'
        },
        invariantFlags: [{
          id: advisoryId,
          invariantField: 'must-survive',
          kind: 'advisory-risk',
          note: 'The new action may draw attention away from the unanswered question.'
        }]
      },
      {
        position: 2,
        approach: 'Use the brother as the pressure gauge',
        direction: 'Hold on his waiting while Mara controls the silence.',
        prose: 'Her brother waited. Mara kept her eyes on the letter until the silence belonged to her.',
        tradeoff: {
          gain: 'The relationship carries the pressure.',
          cost: 'The camera shifts briefly away from Mara.'
        },
        invariantFlags: []
      },
      {
        position: 3,
        approach: 'Let the answer nearly arrive',
        direction: 'Begin the reply, then redirect into a smaller truth.',
        prose: '“I have not—” Mara folded the letter once more. “I have not decided what to tell him.”',
        tradeoff: {
          gain: 'The false start makes the restraint audible.',
          cost: 'It introduces more dialogue than the source.'
        },
        invariantFlags: []
      }
    ],
    overlap: {
      algorithmVersion: CREATIVE_VARIATIONS_OVERLAP_ALGORITHM_VERSION,
      pairs: [],
      maximumPair: { leftPosition: 1, rightPosition: 2, score: 0 }
    }
  },
  selections: [{
    position: 1,
    carryMode: 'direction',
    acceptedAdvisoryRiskIds: [advisoryId]
  }],
  note: 'Keep the restraint, but let the paper do less symbolic work.'
  });
  value.workup!.overlap = computeCreativeVariationsTextualOverlap(
    value.subject.text,
    value.workup!.cards
  );
  return value;
};

const assertValid = (value: WorkshopCreativeVariationsDraft): void => {
  assertCreativeVariationsDraftShape(value, 'draft');
  assertCreativeVariationsDraftIntegrity(value, 'draft');
};

describe('CreativeVariationsConfigCodec', () => {
  it('accepts the exact current/checkpoint grammar and hydrates without migration', () => {
    const value = draft();

    expect(() => assertCreativeVariationsDraftCheckpointShape(value, 'draft')).not.toThrow();
    expect(() => assertValid(value)).not.toThrow();
    expect(normalizeCreativeVariationsDraftForHydration(value)).toEqual({
      draft: value,
      normalizations: [],
      notices: []
    });
  });

  it('accepts an ungenerate authoring draft only when selections are empty', () => {
    const value = draft();
    value.workup = null;
    value.selections = [];
    expect(() => assertValid(value)).not.toThrow();

    value.selections = [{
      position: 1,
      carryMode: 'direction',
      acceptedAdvisoryRiskIds: []
    }];
    expect(() => assertValid(value)).toThrow(/empty when no generated workup exists/);
  });

  it('accepts blank optional invariants and creative aim before generation', () => {
    const value = draft();
    value.invariants.mustSurvive = '';
    value.invariants.mustNotChange = '';
    value.intent.aim = '   ';
    value.workup = null;
    value.selections = [];

    expect(() => assertValid(value)).not.toThrow();
  });

  it.each([
    {
      label: 'unknown draft field',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value as unknown as Record<string, unknown>).transientPanel = 'comparison';
      },
      message: /unknown field transientPanel/
    },
    {
      label: 'unknown distance',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value.intent as { distance: string }).distance = 'moonshot';
      },
      message: /familiar.*adjacent.*tail.*far-tail/
    },
    {
      label: 'unsupported count',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value as { requestedCount: number }).requestedCount = 6;
      },
      message: /3 \| 4 \| 5/
    },
    {
      label: 'oversized prose',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.cards[0].prose = 'x'.repeat(
          PROMPT_BUDGETS.workshopWidgets.creativeProseCharacters + 1
        );
      },
      message: /prose.*at most 20000 characters/
    },
    {
      label: 'unknown flag kind',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value.workup!.cards[0].invariantFlags[0] as { kind: string }).kind = 'warning';
      },
      message: /advisory-risk \| hard-conflict/
    }
  ])('rejects $label at the structural boundary', ({ mutate, message }) => {
    const value = draft();
    mutate(value);
    expect(() => assertCreativeVariationsDraftShape(value, 'draft')).toThrow(message);
  });

  it.each([
    {
      label: 'partial excerpt line provenance',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        if (value.subject.provenance.kind === 'excerpt') {
          delete value.subject.provenance.endLine;
        }
      },
      message: /both startLine and endLine/
    },
    {
      label: 'duplicate context references',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.surroundingContext.sourceReferences.push({ kind: 'active-excerpt' });
      },
      message: /source references without duplicates/
    },
    {
      label: 'non-UUID workup identity',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.workupId = 'cvw-not-host-minted';
      },
      message: /host-minted cvw-<UUID>/
    },
    {
      label: 'cardinality drift',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value as { requestedCount: number }).requestedCount = 4;
      },
      message: /exactly 4 requested cards/
    },
    {
      label: 'gapped positions',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.cards[1].position = 3;
      },
      message: /contiguous position 2/
    },
    {
      label: 'model-controlled flag identity',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.cards[0].invariantFlags[0].id = `${WORKUP_ID}:model-flag`;
      },
      message: /host-derived id/
    },
    {
      label: 'flag against a blank writer field',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.invariants.mustNotChange = '';
        value.workup!.cards[1].invariantFlags = [{
          id: `${WORKUP_ID}:card-2:flag-1`,
          invariantField: 'must-not-change',
          kind: 'advisory-risk',
          note: 'The boundary might move.'
        }];
      },
      message: /writer-declared nonblank invariant field/
    },
    {
      label: 'must-survive flag against a blank writer field',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.invariants.mustSurvive = '';
      },
      message: /writer-declared nonblank invariant field/
    },
    {
      label: 'hard conflict against must-survive',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.cards[1].invariantFlags = [{
          id: `${WORKUP_ID}:card-2:flag-1`,
          invariantField: 'must-survive',
          kind: 'hard-conflict',
          note: 'The declared fact changes.'
        }];
      },
      message: /hard-conflict only against must-not-change/
    },
    {
      label: 'missing pair evidence',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        (value as { requestedCount: number }).requestedCount = 4;
        value.workup!.cards.push({
          ...value.workup!.cards[2],
          position: 4,
          direction: 'Move the reply into an action the brother cannot miss.',
          prose: 'Mara tucked the letter into his coat pocket and walked to the door.',
          tradeoff: { ...value.workup!.cards[2].tradeoff },
          invariantFlags: []
        });
      },
      message: /all 6 unordered pairs/
    },
    {
      label: 'noncanonical pair order',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.overlap.pairs[1].rightPosition = 2;
      },
      message: /recomputed textual-overlap-v2 evidence for pair 1-3/
    },
    {
      label: 'unbounded overlap score',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.overlap.pairs[0].prose = 101;
      },
      message: /recomputed textual-overlap-v2 evidence/
    },
    {
      label: 'dishonest pair maximum',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.overlap.pairs[0].maximum = 10;
      },
      message: /recomputed textual-overlap-v2 evidence/
    },
    {
      label: 'dishonest set maximum',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.overlap.maximumPair.score = 30;
      },
      message: /first recomputed pair at the set maximum/
    },
    {
      label: 'selection outside current workup',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.selections[0].position = 4;
      },
      message: /card in the current workup/
    },
    {
      label: 'missing advisory acceptance',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.selections[0].acceptedAdvisoryRiskIds = [];
      },
      message: /exactly every advisory risk/
    },
    {
      label: 'sibling-card risk acceptance',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.selections[0].acceptedAdvisoryRiskIds = [
          `${WORKUP_ID}:card-2:flag-1`
        ];
      },
      message: /exactly every advisory risk/
    },
    {
      label: 'selected hard-conflict card',
      mutate: (value: WorkshopCreativeVariationsDraft) => {
        value.workup!.cards[1].invariantFlags = [{
          id: `${WORKUP_ID}:card-2:flag-1`,
          invariantField: 'must-not-change',
          kind: 'hard-conflict',
          note: 'The POV would change.'
        }];
        value.selections = [{
          position: 2,
          carryMode: 'direction',
          acceptedAdvisoryRiskIds: []
        }];
      },
      message: /card without a hard conflict/
    }
  ])('rejects $label at semantic integrity', ({ mutate, message }) => {
    const value = draft();
    mutate(value);
    assertCreativeVariationsDraftShape(value, 'draft');
    expect(() => assertCreativeVariationsDraftIntegrity(value, 'draft')).toThrow(message);
  });

  it('defensively clones every nested authoring record and emits a bounded summary', () => {
    const source = draft();
    const originalMaximum = source.workup!.overlap.pairs[0].maximum;
    const clone = cloneCreativeVariationsDraft(source);

    clone.subject.text = 'mutated';
    clone.surroundingContext.sourceReferences.push({ kind: 'active-excerpt' });
    clone.workup!.cards[0].tradeoff.gain = 'mutated';
    clone.workup!.cards[0].invariantFlags[0].note = 'mutated';
    clone.workup!.overlap.pairs[0].maximum = 99;
    clone.selections[0].acceptedAdvisoryRiskIds.length = 0;

    expect(source.subject.text).not.toBe('mutated');
    expect(source.surroundingContext.sourceReferences).toHaveLength(2);
    expect(source.workup!.cards[0].tradeoff.gain).not.toBe('mutated');
    expect(source.workup!.cards[0].invariantFlags[0].note).not.toBe('mutated');
    expect(source.workup!.overlap.pairs[0].maximum).toBe(originalMaximum);
    expect(source.selections[0].acceptedAdvisoryRiskIds).toEqual([advisoryId]);
    expect(summarizeCreativeVariationsDraft(source)).toEqual({
      subjectPreview: source.subject.text,
      selectionCount: 1
    });

    const longSubject = draft();
    longSubject.subject.text = 'x'.repeat(
      PROMPT_BUDGETS.workshopWidgets.creativeSubjectPreviewCharacters + 10
    );
    expect(summarizeCreativeVariationsDraft(longSubject).subjectPreview).toHaveLength(
      PROMPT_BUDGETS.workshopWidgets.creativeSubjectPreviewCharacters
    );
  });

  it('builds injectable fresh host identities without owning a counter', () => {
    const values = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ];
    const createWorkupId = createCreativeVariationsWorkupIdFactory(() => values.shift()!);

    expect(createWorkupId()).toBe('cvw-00000000-0000-4000-8000-000000000001');
    expect(createWorkupId()).toBe('cvw-00000000-0000-4000-8000-000000000002');
  });
});
