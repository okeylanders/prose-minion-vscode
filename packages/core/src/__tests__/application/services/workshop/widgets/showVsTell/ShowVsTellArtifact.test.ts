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

  it('omits must survive when blank (D3), leaving the frozen line keys and order intact', () => {
    const body = buildShowVsTellArtifact({
      ...generatedShowVsTellDraft(),
      invariants: { mustSurvive: ' \n ', mustNotChange: 'No flashback.' }
    });
    const lines = body.split('\n');

    expect(lines.some((line) => line.startsWith('must survive:'))).toBe(false);
    expect(lines.slice(0, 3)).toEqual([
      'beat: "She hadn’t trusted him since the funeral."',
      'position: hinge · tell the bridge, show the fulcrum',
      'must not change: No flashback.'
    ]);
    expect(body.length).toBeLessThan(buildShowVsTellArtifact(generatedShowVsTellDraft()).length);
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

  /** A one-variant workup whose only variant has exactly this prose and direction. */
  const countFor = (prose: string, direction: string, carryMode: 'prose' | 'direction'): number => {
    const variant = { ...variants[0], prose, direction };
    const workup = { ...draft.workup!, groups: [{ kind: 'told-cleanly' as const, variants: [variant] }] };
    return showVsTellArtifactLength(
      draftWith({ workup, kept: [{ variantId: variant.id, carryMode }], note: '' })
    );
  };

  it('prices the swap exactly: keep costs prose + 8, direction costs direction + 11', () => {
    const base = countFor('p'.repeat(40), 'd'.repeat(10), 'prose')
      - countFor('p'.repeat(40), 'd'.repeat(10), 'direction');

    // keep: "…" = prose + 8; direction: … = direction + 11 → 48 − 21 = 27.
    expect(base).toBe(27);
  });

  it('prices a direction honestly when it is as long as or longer than its prose (D5: no length gate)', () => {
    const prose = 'p'.repeat(60);

    // The meter tells the truth either way; nothing rejects the variant.
    expect(countFor(prose, 'd'.repeat(57), 'direction')).toBe(countFor(prose, 'd'.repeat(57), 'prose'));
    expect(countFor(prose, 'd'.repeat(59), 'direction')).toBeGreaterThan(countFor(prose, 'd'.repeat(59), 'prose'));
    expect(countFor('She left.', 'keep the flat tell', 'direction'))
      .toBeGreaterThan(countFor('She left.', 'keep the flat tell', 'prose'));
  });

  it('measures a CRLF prose after encoding, so the meter matches the compiled artifact', () => {
    const prose = ['p'.repeat(24), 'p'.repeat(23), 'p'.repeat(23), 'p'.repeat(23), 'p'.repeat(23)]
      .join('\r\n');
    const direction = 'd'.repeat(120);

    expect(prose.length).toBe(124);
    expect(encodeShowVsTellArtifactValue(prose).length).toBe(120);
    expect(countFor(prose, direction, 'direction') - countFor(prose, direction, 'prose')).toBe(3);
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
