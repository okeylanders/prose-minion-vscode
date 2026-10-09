import { WorkshopShowVsTellDraft } from '@messages';
import {
  assertShowVsTellDraftIntegrity,
  assertShowVsTellDraftShape,
  assertShowVsTellWorkupShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellWorkupIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import {
  SHOW_VS_TELL_FIXTURE_WORKUP_ID,
  fixtureFlagId,
  fixtureVariantId,
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

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

describe('ShowVsTellConfigIntegrity', () => {
  it('treats model-declared flags as passive context, never as a veto on keep or carry', () => {
    const value = generatedShowVsTellDraft();
    value.kept = [
      { variantId: fixtureVariantId(3), carryMode: 'prose' },
      { variantId: fixtureVariantId(4), carryMode: 'prose' }
    ];

    expect(value.workup!.groups[1].variants[1].invariantFlags[0].kind).toBe('hard-conflict');
    expect(() => assertValid(value)).not.toThrow();
  });

  it.each<{ label: string; mutate: Mutation; message: RegExp }>([
    {
      label: 'a partial excerpt line range',
      mutate: (value) => {
        if (value.beat.provenance.kind === 'excerpt') {
          delete value.beat.provenance.endLine;
        }
      },
      message: /both startLine and endLine, or neither/
    },
    {
      label: 'an inverted excerpt line range',
      mutate: (value) => {
        value.beat.provenance = {
          kind: 'excerpt',
          relativePath: 'chapters/four.md',
          startLine: 12,
          endLine: 11
        };
      },
      message: /a valid 1-based inclusive line range/
    },
    {
      label: 'a focal character under an unspecified POV',
      mutate: (value) => { value.pov.mode = 'unspecified'; },
      message: /focalCharacter must be blank when the POV mode is unspecified/
    },
    {
      label: 'duplicate channels',
      mutate: (value) => { value.channels = ['observable-action', 'observable-action']; },
      message: /unique channels in the fixed channel order/
    },
    {
      label: 'channels outside their fixed order',
      mutate: (value) => { value.channels = ['sensory-evidence', 'observable-action']; },
      message: /unique channels in the fixed channel order/
    },
    {
      label: 'a workup id the host did not mint',
      mutate: (value) => { value.workup!.workupId = 'svtw-from-the-model'; },
      message: /host-minted svtw-<UUID> id/
    },
    {
      label: 'groups out of their fixed order',
      mutate: (value) => {
        const [told, evidence, ...rest] = value.workup!.groups;
        value.workup!.groups = [evidence, told, ...rest];
      },
      message: /groups\[0\]\.kind must be told-cleanly \(all four groups, in their fixed order\)/
    },
    {
      label: 'a missing group hidden by a duplicate kind',
      mutate: (value) => { value.workup!.groups[3].kind = 'shown-from-inside'; },
      message: /groups\[3\]\.kind must be mixed/
    },
    {
      label: 'a model-controlled variant id',
      mutate: (value) => { value.workup!.groups[0].variants[1].id = 'variant-from-the-model'; },
      message: new RegExp(`host-derived id ${SHOW_VS_TELL_FIXTURE_WORKUP_ID}:variant-2`)
    },
    {
      label: 'a duplicated channel within one variant',
      mutate: (value) => {
        value.workup!.groups[3].variants[0].channels = ['observable-action', 'observable-action'];
      },
      message: /groups\[3\]\.variants\[0\]\.channels must be channels without duplicates/
    },
    {
      label: 'a direction as long as its prose',
      mutate: (value) => {
        const variant = value.workup!.groups[0].variants[0];
        variant.direction = 'x'.repeat(variant.prose.length);
      },
      message: /direction must be strictly shorter than its prose/
    },
    {
      label: 'a direction longer than its prose',
      mutate: (value) => {
        const variant = value.workup!.groups[0].variants[0];
        variant.prose = 'She left.';
        variant.direction = 'keep the flat tell';
      },
      message: /direction must be strictly shorter than its prose/
    },
    {
      label: 'an exact normalized duplicate',
      mutate: (value) => {
        value.workup!.groups[3].variants[0].prose =
          'SHE TOOK the mug with her left hand — and kept the right one on the doorframe!';
      },
      message: /groups\[3\]\.variants\[0\]\.prose must be prose distinct from draft\.workup\.groups\[1\]\.variants\[0\]/
    },
    {
      label: 'a model-controlled flag id',
      mutate: (value) => {
        value.workup!.groups[1].variants[0].invariantFlags[0].id = `${fixtureVariantId(3)}:model`;
      },
      message: new RegExp(`host-derived id ${fixtureFlagId(3, 1)}`)
    },
    {
      label: 'a flag against a blank must not change',
      mutate: (value) => { value.invariants.mustNotChange = ''; },
      message: /invariantFlags\[0\]\.invariantField must be a writer-declared nonblank invariant field/
    },
    {
      label: 'a hard conflict against must survive',
      mutate: (value) => {
        asRecord(value.workup!.groups[1].variants[0].invariantFlags[0]).kind = 'hard-conflict';
      },
      message: /hard-conflict only against must-not-change/
    },
    {
      label: 'a kept variant missing from the workup',
      mutate: (value) => { value.kept[1].variantId = fixtureVariantId(8); },
      message: /kept\[1\]\.variantId must be a variant in the current workup/
    },
    {
      label: 'a variant kept twice',
      mutate: (value) => { value.kept[1].variantId = fixtureVariantId(3); },
      message: /kept variants without duplicates/
    },
    {
      label: 'kept variants outside workup order',
      mutate: (value) => { value.kept.reverse(); },
      message: /kept variants in workup order/
    }
  ])('rejects $label at semantic integrity', ({ mutate, message }) => {
    const value = mutated(mutate);

    assertShowVsTellDraftShape(value, 'draft');
    expect(() => assertShowVsTellDraftIntegrity(value, 'draft')).toThrow(message);
  });

  it('exposes the workup gate to callers that hold only the generation invariants', () => {
    const { workup, invariants } = generatedShowVsTellDraft();

    expect(() => assertShowVsTellWorkupShape(workup, 'workup')).not.toThrow();
    expect(() => assertShowVsTellWorkupShape({ ...workup!, groups: [] }, 'workup'))
      .toThrow(/workup\.groups must be an array containing exactly 4 groups/);
    expect(() => assertShowVsTellWorkupIntegrity(workup!, invariants, 'workup')).not.toThrow();
    expect(() => assertShowVsTellWorkupIntegrity(
      workup!,
      { ...invariants, mustNotChange: '   ' },
      'workup'
    )).toThrow(
      /workup\.groups\[1\]\.variants\[1\]\.invariantFlags\[0\]\.invariantField must be a writer-declared nonblank invariant field/
    );
  });
});
