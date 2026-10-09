import { WorkshopShowVsTellDraft } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  assertShowVsTellDraftCheckpointShape,
  assertShowVsTellDraftIntegrity,
  assertShowVsTellDraftShape,
  cloneShowVsTellDraft,
  normalizeShowVsTellDraftForHydration,
  summarizeShowVsTellDraft
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  createShowVsTellWorkupIdFactory,
  isShowVsTellWorkupId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellWorkupId';
import {
  SHOW_VS_TELL_FIXTURE_WORKUP_ID,
  fixtureFlagId,
  fixtureVariantId,
  generatedShowVsTellDraft,
  ungeneratedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const budget = PROMPT_BUDGETS.workshopWidgets;
type Mutation = (draft: WorkshopShowVsTellDraft) => void;

const assertValid = (value: WorkshopShowVsTellDraft): void => {
  assertShowVsTellDraftShape(value, 'draft');
  assertShowVsTellDraftIntegrity(value, 'draft');
};

const mutated = (mutate: Mutation): WorkshopShowVsTellDraft => {
  const value = generatedShowVsTellDraft();
  mutate(value);
  return value;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value as Record<string, unknown>;

describe('ShowVsTellConfigCodec', () => {
  it('accepts the exact current/checkpoint grammar and hydrates without migration', () => {
    const value = generatedShowVsTellDraft();

    expect(() => assertShowVsTellDraftCheckpointShape(value, 'draft')).not.toThrow();
    expect(() => assertValid(value)).not.toThrow();
    expect(normalizeShowVsTellDraftForHydration(value)).toEqual({
      draft: value,
      normalizations: [],
      notices: []
    });
  });

  it('round-trips a full draft through JSON exactly', () => {
    const value = generatedShowVsTellDraft();
    const decoded = JSON.parse(JSON.stringify(value)) as unknown;

    assertShowVsTellDraftShape(decoded, 'draft');
    assertShowVsTellDraftIntegrity(decoded as WorkshopShowVsTellDraft, 'draft');
    expect(normalizeShowVsTellDraftForHydration(decoded).draft).toEqual(value);
  });

  it('accepts an ungenerated draft at the shipped defaults only while nothing is kept', () => {
    const value = ungeneratedShowVsTellDraft();
    expect(() => assertValid(value)).not.toThrow();

    value.kept = [{ variantId: fixtureVariantId(1), carryMode: 'direction' }];
    expect(() => assertValid(value)).toThrow(/empty when no generated workup exists/);
  });

  it('round-trips persona custody and writer-edit state without borrowing editor identity', () => {
    const value = ungeneratedShowVsTellDraft();
    value.beat.provenance = { kind: 'persona-prefill', personaId: 'margot', editedByWriter: true };

    expect(() => assertValid(value)).not.toThrow();
    expect(cloneShowVsTellDraft(value).beat.provenance).toEqual({
      kind: 'persona-prefill',
      personaId: 'margot',
      editedByWriter: true
    });
  });

  describe('surrounding-context source reference (Q1)', () => {
    it('round-trips zero and one reference, and never stores passage text', () => {
      for (const sourceReferences of [
        [],
        [{ kind: 'active-excerpt' }],
        [{ kind: 'context-attachment', attachmentId: 'ctx-3' }]
      ] as WorkshopShowVsTellDraft['surroundingContext']['sourceReferences'][]) {
        const value = mutated((draft) => {
          draft.surroundingContext.sourceReferences = sourceReferences;
        });
        const decoded = JSON.parse(JSON.stringify(value)) as WorkshopShowVsTellDraft;

        expect(() => assertValid(decoded)).not.toThrow();
        expect(cloneShowVsTellDraft(decoded).surroundingContext).toEqual(value.surroundingContext);
        expect(Object.keys(decoded.surroundingContext)).toEqual(['sourceReferences']);
      }
    });

    it('clones references so a copy cannot alias the draft', () => {
      const value = generatedShowVsTellDraft();
      const copy = cloneShowVsTellDraft(value);

      expect(copy.surroundingContext.sourceReferences).not.toBe(
        value.surroundingContext.sourceReferences
      );
      expect(copy.surroundingContext.sourceReferences[0]).not.toBe(
        value.surroundingContext.sourceReferences[0]
      );
    });

    it.each([
      ['two references', [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-1' }]],
      ['an unknown kind', [{ kind: 'pasted-text' }]],
      ['a malformed ctx id', [{ kind: 'context-attachment', attachmentId: 'ctx-0' }]],
      ['a non-ctx id', [{ kind: 'context-attachment', attachmentId: 'attachment-1' }]],
      ['a missing attachment id', [{ kind: 'context-attachment' }]],
      ['an id on the excerpt reference', [{ kind: 'active-excerpt', attachmentId: 'ctx-1' }]],
      ['writer text smuggled onto the reference', [{ kind: 'active-excerpt', text: 'passage' }]]
    ])('rejects %s', (_label, references) => {
      const value = mutated((draft) => {
        draft.surroundingContext.sourceReferences =
          references as WorkshopShowVsTellDraft['surroundingContext']['sourceReferences'];
      });

      expect(() => assertShowVsTellDraftShape(value, 'draft')).toThrow();
    });

    it('rejects a missing context object or passage text beside the references', () => {
      const missing = generatedShowVsTellDraft() as unknown as Record<string, unknown>;
      delete missing.surroundingContext;
      expect(() => assertShowVsTellDraftShape(missing, 'draft')).toThrow();

      const withText = generatedShowVsTellDraft() as unknown as Record<string, unknown>;
      withText.surroundingContext = { sourceReferences: [], writerText: 'passage' };
      expect(() => assertShowVsTellDraftShape(withText, 'draft')).toThrow();
    });

    it('stays within the one-reference budget', () => {
      expect(budget.showVsTellSourceReferences).toBe(1);
      expect(budget.showVsTellSourceReferenceCharacters).toBe(500);
    });
  });

  it('defensively clones every nested record and summarizes the chip counts', () => {
    const source = generatedShowVsTellDraft();
    const clone = cloneShowVsTellDraft(source);

    clone.beat.text = 'mutated';
    clone.pov.focalCharacter = 'mutated';
    clone.channels.push('interiority');
    clone.workup!.groups[0].variants[0].channels.push('observable-action');
    clone.workup!.groups[1].variants[0].invariantFlags[0].note = 'mutated';
    clone.kept[0].carryMode = 'prose';

    expect(source).toEqual(generatedShowVsTellDraft());
    expect(summarizeShowVsTellDraft(source)).toEqual({
      beatPreview: 'She hadn’t trusted him since the funeral.',
      keptCount: 2,
      directionCount: 1
    });
  });

  it.each<{ label: string; mutate: Mutation; message: RegExp }>([
    {
      label: 'an unknown draft field',
      mutate: (value) => { asRecord(value).focusedVariant = 'variant-1'; },
      message: /unknown field focusedVariant/
    },
    {
      label: 'a missing note',
      mutate: (value) => { delete asRecord(value).note; },
      message: /missing required field note/
    },
    {
      label: 'a blank beat',
      mutate: (value) => { value.beat.text = '   '; },
      message: /beat\.text must be a non-empty string/
    },
    {
      label: 'an oversized beat',
      mutate: (value) => { value.beat.text = 'b'.repeat(budget.showVsTellBeatCharacters + 1); },
      message: /beat\.text must be a string of at most 160 characters/
    },
    {
      label: 'a multi-line beat',
      mutate: (value) => { value.beat.text = 'She hadn’t trusted him\nsince the funeral.'; },
      message: /beat\.text must be a single line/
    },
    {
      label: 'an unknown provenance kind',
      mutate: (value) => { asRecord(value.beat.provenance).kind = 'clipboard'; },
      message: /pasted \| persona-prefill \| excerpt/
    },
    {
      label: 'an oversized provenance path',
      mutate: (value) => {
        value.beat.provenance = {
          kind: 'excerpt',
          relativePath: 'p'.repeat(budget.showVsTellProvenancePathCharacters + 1)
        };
      },
      message: /relativePath must be a string of at most 500 characters/
    },
    {
      label: 'an unknown persona',
      mutate: (value) => {
        asRecord(value.beat).provenance = {
          kind: 'persona-prefill',
          personaId: 'the-model',
          editedByWriter: false
        };
      },
      message: /known Workshop persona id/
    },
    {
      label: 'an unknown POV mode',
      mutate: (value) => { asRecord(value.pov).mode = 'third'; },
      message: /unspecified \| first \| close-third/
    },
    {
      label: 'an oversized focal character',
      mutate: (value) => {
        value.pov.focalCharacter = 'f'.repeat(budget.showVsTellPovFocalCharacterCharacters + 1);
      },
      message: /focalCharacter must be a string of at most 80 characters/
    },
    {
      label: 'a multi-line focal character',
      mutate: (value) => { value.pov.focalCharacter = 'Daniel\nMara'; },
      message: /focalCharacter must be a single line/
    },
    {
      label: 'a blank must survive',
      mutate: (value) => { value.invariants.mustSurvive = ''; },
      message: /mustSurvive must be a non-empty string/
    },
    {
      label: 'an oversized must survive',
      mutate: (value) => {
        value.invariants.mustSurvive = 's'.repeat(budget.showVsTellMustSurviveCharacters + 1);
      },
      message: /mustSurvive must be a string of at most 120 characters/
    },
    {
      label: 'an oversized must not change',
      mutate: (value) => {
        value.invariants.mustNotChange = 'n'.repeat(budget.showVsTellMustNotChangeCharacters + 1);
      },
      message: /mustNotChange must be a string of at most 80 characters/
    },
    {
      label: 'zero channels',
      mutate: (value) => { value.channels = []; },
      message: /channels must be an array of 1–5 channels/
    },
    {
      label: 'an unknown channel',
      mutate: (value) => { asRecord(value).channels = ['observable-action', 'scent']; },
      message: /channels\[1\] must be observable-action \| sensory-evidence/
    },
    {
      label: 'an unknown length budget',
      mutate: (value) => { asRecord(value).lengthBudget = '+2 paragraphs'; },
      message: /tighter \| same-length \| plus-one-sentence \| plus-one-paragraph/
    },
    {
      label: 'an unknown position',
      mutate: (value) => { asRecord(value).position = 'dramatize'; },
      message: /state-it \| summarize \| hinge \| evidence \| inhabit/
    },
    {
      label: 'an oversized note',
      mutate: (value) => { value.note = 'n'.repeat(budget.showVsTellNoteCharacters + 1); },
      message: /note must be a string of at most 160 characters/
    },
    {
      label: 'a multi-line note',
      mutate: (value) => { value.note = 'keep the tell\ndirection: forged'; },
      message: /note must be a single line/
    },
    {
      label: 'an unknown generation protocol',
      mutate: (value) => { asRecord(value.workup).generationProtocolVersion = 2; },
      message: /generationProtocolVersion must be 1/
    },
    {
      label: 'an oversized workup id',
      mutate: (value) => {
        value.workup!.workupId = 'w'.repeat(budget.showVsTellWorkupIdCharacters + 1);
      },
      message: /workupId must be a string of at most 64 characters/
    },
    {
      label: 'a missing group',
      mutate: (value) => { value.workup!.groups.pop(); },
      message: /groups must be an array containing exactly 4 groups/
    },
    {
      label: 'an unknown group kind',
      mutate: (value) => { asRecord(value.workup!.groups[3]).kind = 'hinge'; },
      message: /told-cleanly \| shown-as-evidence \| shown-from-inside \| mixed/
    },
    {
      label: 'an empty group (three variants in total)',
      mutate: (value) => { value.workup!.groups[3].variants = []; },
      message: /groups\[3\]\.variants must be an array of 1–2 variants/
    },
    {
      label: 'a group of three (nine variants in total)',
      mutate: (value) => {
        value.workup!.groups[0].variants.push({
          ...value.workup!.groups[2].variants[0],
          channels: ['interiority'],
          invariantFlags: []
        });
        value.workup!.groups[3].variants.push({
          ...value.workup!.groups[2].variants[1],
          channels: ['dialogue-subtext'],
          invariantFlags: []
        });
      },
      message: /groups\[0\]\.variants must be an array of 1–2 variants/
    },
    {
      label: 'an unknown variant field',
      mutate: (value) => { asRecord(value.workup!.groups[0].variants[0]).wordCount = 7; },
      message: /unknown field wordCount/
    },
    {
      label: 'blank prose',
      mutate: (value) => { value.workup!.groups[0].variants[0].prose = ' '; },
      message: /prose must be a non-empty string/
    },
    {
      label: 'oversized prose',
      mutate: (value) => {
        value.workup!.groups[0].variants[0].prose = 'p'.repeat(budget.showVsTellProseCharacters + 1);
      },
      message: /prose must be a string of at most 1200 characters/
    },
    {
      label: 'a variant with no channel',
      mutate: (value) => { value.workup!.groups[0].variants[0].channels = []; },
      message: /variants\[0\]\.channels must be an array of 1–2 channels/
    },
    {
      label: 'a variant with three channels',
      mutate: (value) => {
        value.workup!.groups[0].variants[0].channels = [
          'summary-exposition',
          'observable-action',
          'interiority'
        ];
      },
      message: /variants\[0\]\.channels must be an array of 1–2 channels/
    },
    {
      label: 'blank gains',
      mutate: (value) => { value.workup!.groups[0].variants[0].gains = ''; },
      message: /gains must be a non-empty string/
    },
    {
      label: 'oversized gains',
      mutate: (value) => {
        value.workup!.groups[0].variants[0].gains = 'g'.repeat(budget.showVsTellGainsCharacters + 1);
      },
      message: /gains must be a string of at most 160 characters/
    },
    {
      label: 'oversized costs',
      mutate: (value) => {
        value.workup!.groups[0].variants[0].costs = 'c'.repeat(budget.showVsTellCostsCharacters + 1);
      },
      message: /costs must be a string of at most 160 characters/
    },
    {
      label: 'blank direction',
      mutate: (value) => { value.workup!.groups[0].variants[0].direction = ''; },
      message: /direction must be a non-empty string/
    },
    {
      label: 'oversized direction',
      mutate: (value) => {
        value.workup!.groups[0].variants[0].direction =
          'd'.repeat(budget.showVsTellDirectionCharacters + 1);
      },
      message: /direction must be a string of at most 120 characters/
    },
    {
      label: 'too many flags',
      mutate: (value) => {
        const variant = value.workup!.groups[1].variants[0];
        variant.invariantFlags = Array.from(
          { length: budget.showVsTellFlagsPerVariant + 1 },
          (_, index) => ({
            id: fixtureFlagId(3, index + 1),
            invariantField: 'must-survive' as const,
            kind: 'advisory-risk' as const,
            note: 'Risk.'
          })
        );
      },
      message: /invariantFlags must be an array of at most 4 invariant flags/
    },
    {
      label: 'an unknown flag kind',
      mutate: (value) => {
        asRecord(value.workup!.groups[1].variants[0].invariantFlags[0]).kind = 'warning';
      },
      message: /advisory-risk \| hard-conflict/
    },
    {
      label: 'an unknown invariant field',
      mutate: (value) => {
        asRecord(value.workup!.groups[1].variants[0].invariantFlags[0]).invariantField = 'pov';
      },
      message: /must-survive \| must-not-change/
    },
    {
      label: 'an oversized flag note',
      mutate: (value) => {
        value.workup!.groups[1].variants[0].invariantFlags[0].note =
          'n'.repeat(budget.showVsTellFlagNoteCharacters + 1);
      },
      message: /note must be a string of at most 160 characters/
    },
    {
      label: 'an unknown carry mode',
      mutate: (value) => { asRecord(value.kept[0]).carryMode = 'full-prose'; },
      message: /kept\[0\]\.carryMode must be direction \| prose/
    },
    {
      label: 'more kept variants than a workup can hold',
      mutate: (value) => {
        value.kept = Array.from({ length: budget.showVsTellVariants + 1 }, (_, index) => ({
          variantId: fixtureVariantId(index + 1),
          carryMode: 'direction' as const
        }));
      },
      message: /kept must be an array of at most 8 kept variants/
    }
  ])('rejects $label at the structural boundary', ({ mutate, message }) => {
    const value = mutated(mutate);

    expect(() => assertShowVsTellDraftShape(value, 'draft')).toThrow(message);
    expect(() => normalizeShowVsTellDraftForHydration(value)).toThrow(message);
  });

  it('mints fresh injectable host identities and recognizes only their exact form', () => {
    const values = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002'
    ];
    const createWorkupId = createShowVsTellWorkupIdFactory(() => values.shift()!);

    expect(createWorkupId()).toBe(SHOW_VS_TELL_FIXTURE_WORKUP_ID);
    expect(createWorkupId()).toBe('svtw-00000000-0000-4000-8000-000000000002');
    expect(isShowVsTellWorkupId(createShowVsTellWorkupIdFactory()())).toBe(true);
    expect(isShowVsTellWorkupId('cvw-00000000-0000-4000-8000-000000000001')).toBe(false);
  });
});
