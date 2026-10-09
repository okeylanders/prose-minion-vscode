import type { WorkshopShowVsTellDraft } from '@messages';
import {
  buildShowVsTellArtifact,
  encodeShowVsTellArtifactValue,
  showVsTellArtifactLength
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  showVsTellWordCount,
  showVsTellWorkupVariants
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import { fixtureVariantId, generatedShowVsTellDraft } from './showVsTellFixtures';

const draftWith = (overrides: Partial<WorkshopShowVsTellDraft>): WorkshopShowVsTellDraft => ({
  ...generatedShowVsTellDraft(),
  ...overrides
});

describe('buildShowVsTellArtifact', () => {
  it('compiles the exact counted lines in workup order, prose and direction carry', () => {
    const body = buildShowVsTellArtifact(generatedShowVsTellDraft());

    expect(body.split('\n')).toEqual([
      'beat: "She hadn’t trusted him since the funeral."',
      'position: hinge · tell the bridge, show the fulcrum',
      'must survive: The distrust is old and funeral-rooted — and she never says it out loud.',
      'must not change: No flashback. Stay in the kitchen, stay in tonight.',
      'direction: guard as body fact — hand, doorframe; claim nothing',
      'keep: "Since the funeral she had volunteered nothing. Tonight she took the mug with her left hand and left the right one on the doorframe."',
      'note: the tell can stay if the fulcrum is shown'
    ]);
  });

  it('emits variants in workup order even when the kept list is out of order', () => {
    const draft = generatedShowVsTellDraft();
    const reversed = draftWith({ kept: [...draft.kept].reverse() });

    expect(buildShowVsTellArtifact(reversed)).toBe(buildShowVsTellArtifact(draft));
  });

  it('omits must not change and note when blank', () => {
    const draft = draftWith({
      invariants: { mustSurvive: 'the distrust', mustNotChange: '   ' },
      note: '  '
    });

    expect(buildShowVsTellArtifact(draft).split('\n').map((entry) => entry.split(' ')[0])).toEqual([
      'beat:', 'position:', 'must', 'direction:', 'keep:'
    ]);
    expect(buildShowVsTellArtifact(draft)).not.toContain('must not change');
    expect(buildShowVsTellArtifact(draft)).not.toContain('note:');
  });

  it('uses a position line for each position and never a score word', () => {
    expect(buildShowVsTellArtifact(draftWith({ position: 'state-it' })))
      .toContain('position: state it · direct tell');
    expect(buildShowVsTellArtifact(draftWith({ position: 'inhabit' })))
      .toContain('position: inhabit · full scene time');
  });

  it('trims values and writes straight quotes without escaping', () => {
    const body = buildShowVsTellArtifact(draftWith({
      beat: { text: '  She said "no".  ', provenance: { kind: 'pasted' } }
    }));

    expect(body.split('\n')[0]).toBe('beat: "She said "no"."');
  });

  it('encodes every line-break sequence as one ↵ so each value stays on its line', () => {
    expect(encodeShowVsTellArtifactValue('a\nb\r\nc\rd\u2028e\u2029f')).toBe('a↵b↵c↵d↵e↵f');
    expect(encodeShowVsTellArtifactValue('\n  trimmed edges \n')).toBe('trimmed edges');

    const draft = draftWith({
      invariants: { mustSurvive: 'line one\nline two', mustNotChange: 'x\r\ny' },
      kept: [{ variantId: fixtureVariantId(6), carryMode: 'prose' }]
    });
    const lines = buildShowVsTellArtifact(draft).split('\n');

    expect(lines).toContain('must survive: line one↵line two');
    expect(lines).toContain('must not change: x↵y');
    expect(lines.find((line) => line.startsWith('keep:'))).toBe(
      'keep: "“Ask me the real question,” she said.↵“I don’t have a real question.”↵“You never do. Not since March.”"'
    );
    // Every line starts with a frozen key, so none is a continuation.
    expect(lines.every((line) =>
      /^(beat|position|must survive|must not change|keep|direction|note):/u.test(line))).toBe(true);
  });

  it('never lengthens a value when encoding line breaks', () => {
    const value = 'one\r\ntwo\nthree\rfour\u2028five\u2029six';

    expect(encodeShowVsTellArtifactValue(value).length).toBeLessThanOrEqual(value.trim().length);
  });

  it('excludes unkept variants, craft notes, flags, readout, channels, budget, POV, and the passage', () => {
    const body = buildShowVsTellArtifact(generatedShowVsTellDraft());
    const draft = generatedShowVsTellDraft();
    const variants = showVsTellWorkupVariants(draft.workup!);

    for (const unkept of variants.filter((variant) =>
      !draft.kept.some((kept) => kept.variantId === variant.id))) {
      // Variant 1 repeats the beat verbatim, which the beat line legitimately carries.
      if (unkept.prose !== draft.beat.text) {
        expect(body).not.toContain(unkept.prose);
      }
      expect(body).not.toContain(unkept.direction);
    }
    for (const variant of variants) {
      expect(body).not.toContain(variant.gains);
      expect(body).not.toContain(variant.costs);
      for (const flag of variant.invariantFlags) {
        expect(body).not.toContain(flag.note);
      }
    }
    expect(body).not.toMatch(/thread-artifact|warning|channel|budget|pov|Daniel|reader speed/iu);
  });

  it('throws when a kept variant is not in the workup', () => {
    expect(() => buildShowVsTellArtifact(draftWith({
      kept: [{ variantId: 'svtw-other:variant-1', carryMode: 'direction' }]
    }))).toThrow(/not in the current workup/u);
    expect(() => buildShowVsTellArtifact(draftWith({ workup: null }))).toThrow(/not in the current workup/u);
  });

  it('reports its own length as the meter value', () => {
    const draft = generatedShowVsTellDraft();

    expect(showVsTellArtifactLength(draft)).toBe(buildShowVsTellArtifact(draft).length);
  });
});

describe('direction-only carry against the counted length', () => {
  const draft = generatedShowVsTellDraft();
  const variants = showVsTellWorkupVariants(draft.workup!);

  it('lowers the count for every fixture variant switched from prose to direction', () => {
    for (const variant of variants) {
      const asProse = showVsTellArtifactLength(draftWith({
        kept: [{ variantId: variant.id, carryMode: 'prose' }]
      }));
      const asDirection = showVsTellArtifactLength(draftWith({
        kept: [{ variantId: variant.id, carryMode: 'direction' }]
      }));

      expect(asDirection).toBeLessThan(asProse);
    }
  });

  it('never raises the count when the direction is at least three shorter than its prose', () => {
    // `keep: "…"` costs prose + 8; `direction: …` costs direction + 11. A margin
    // of three therefore guarantees the swap cannot grow the body.
    for (const margin of [3, 4, 10]) {
      const prose = 'p'.repeat(40);
      const variant = {
        ...variants[0],
        prose,
        direction: 'd'.repeat(prose.length - margin)
      };
      const workup = {
        ...draft.workup!,
        groups: [{ kind: 'told-cleanly' as const, variants: [variant] }]
      };
      const lengthFor = (carryMode: 'prose' | 'direction'): number => showVsTellArtifactLength(
        draftWith({ workup, kept: [{ variantId: variant.id, carryMode }], note: '' })
      );

      expect(lengthFor('direction')).toBeLessThanOrEqual(lengthFor('prose'));
    }
  });

  it('documents the contract edge: a direction only 1–2 shorter than its prose can cost up to 2 more', () => {
    // The Slice 1 integrity rule is "strictly shorter", so the gates accept a
    // direction one character shorter than its prose. Flagged in the Slice 3
    // handoff; real directions run a fraction of their prose.
    const prose = 'p'.repeat(40);
    const edge = { ...variants[0], prose, direction: 'd'.repeat(39) };
    const workup = { ...draft.workup!, groups: [{ kind: 'told-cleanly' as const, variants: [edge] }] };
    const lengthFor = (carryMode: 'prose' | 'direction'): number => showVsTellArtifactLength(
      draftWith({ workup, kept: [{ variantId: edge.id, carryMode }], note: '' })
    );

    expect(lengthFor('direction') - lengthFor('prose')).toBe(2);
  });
});

describe('showVsTellWordCount', () => {
  it('counts whitespace-separated words, deterministically', () => {
    expect(showVsTellWordCount('She hadn’t trusted him since the funeral.')).toBe(7);
    expect(showVsTellWordCount('  one\n two\t three  ')).toBe(3);
    expect(showVsTellWordCount('“Ask me,” she said.\n“No.”')).toBe(5);
    expect(showVsTellWordCount('   \n ')).toBe(0);
    expect(showVsTellWordCount('')).toBe(0);
  });
});
