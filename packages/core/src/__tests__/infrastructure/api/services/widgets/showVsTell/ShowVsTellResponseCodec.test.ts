import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_RESPONSE_END,
  SHOW_VS_TELL_RESPONSE_START,
  decodeShowVsTellResponse
} from '@services/widgets/showVsTell/ShowVsTellResponseCodec';
import {
  assertShowVsTellWorkupShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellWorkupIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import {
  showVsTellFlagId,
  showVsTellVariantId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  SVT_EXAMPLE_INVARIANTS,
  SVT_TEST_WORKUP_ID,
  exampleResponseText,
  exampleWire,
  frameShowVsTellResponse,
  type WireResponse
} from '@/__tests__/infrastructure/api/services/widgets/showVsTell/showVsTellResponseFixtures';

const budget = PROMPT_BUDGETS.workshopWidgets;
const context = { workupId: SVT_TEST_WORKUP_ID, invariants: SVT_EXAMPLE_INVARIANTS };
const decode = (content: string, invariants = SVT_EXAMPLE_INVARIANTS) =>
  decodeShowVsTellResponse(content, { workupId: SVT_TEST_WORKUP_ID, invariants });

/** Mutates a fresh copy of the example's wire JSON and frames it. */
const mutated = (mutate: (wire: WireResponse) => void): string => {
  const wire = exampleWire();
  mutate(wire);
  return frameShowVsTellResponse(wire);
};

describe('decodeShowVsTellResponse', () => {
  describe('the prompt example', () => {
    it('decodes through the real codec into a workup both gates accept', () => {
      const workup = decode(exampleResponseText());

      expect(workup.workupId).toBe(SVT_TEST_WORKUP_ID);
      expect(workup.groups.map((group) => group.variants.length)).toEqual([2, 2, 2, 1]);
      expect(() => assertShowVsTellWorkupShape(workup, 'workup')).not.toThrow();
      expect(() => assertShowVsTellWorkupIntegrity(workup, SVT_EXAMPLE_INVARIANTS, 'workup'))
        .not.toThrow();
    });

    it('derives every id on the host, one-based across groups and per variant', () => {
      const workup = decode(exampleResponseText());
      const variants = workup.groups.flatMap((group) => group.variants);

      expect(variants.map((variant) => variant.id)).toEqual(
        variants.map((_variant, index) => showVsTellVariantId(SVT_TEST_WORKUP_ID, index + 1))
      );
      const flagged = variants.filter((variant) => variant.invariantFlags.length > 0);
      expect(flagged.length).toBeGreaterThan(0);
      for (const variant of flagged) {
        expect(variant.invariantFlags.map((flag) => flag.id)).toEqual(
          variant.invariantFlags.map((_flag, index) => showVsTellFlagId(variant.id, index + 1))
        );
      }
    });

    it('is deterministic: the same text and id settle to an equal workup', () => {
      expect(decode(exampleResponseText())).toEqual(decode(exampleResponseText()));
    });
  });

  describe('multi-line values (writer decision Q2)', () => {
    it('accepts line breaks in prose, direction, gains, costs, and flag notes', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[1].variants[1];
        variant.prose = `${variant.prose}\n“Another line,” she said.\nAnd a third.`;
        variant.direction = 'First line of the direction.\nSecond line.';
        variant.gains = 'One.\nTwo.';
        variant.costs = 'Three.\nFour.';
        variant.invariantFlags = [{
          invariantField: 'must-survive',
          kind: 'advisory-risk',
          note: 'Note line one.\nNote line two.'
        }];
      });

      expect(() => decode(content)).not.toThrow();
    });
  });

  describe('sentinels and framing', () => {
    const example = exampleResponseText();

    it.each([
      ['a missing opening sentinel', example.replace(`${SHOW_VS_TELL_RESPONSE_START}\n`, '')],
      ['a missing closing sentinel', example.replace(`\n${SHOW_VS_TELL_RESPONSE_END}`, '')],
      ['commentary before the opening sentinel', `Here is the workup:\n${example}`],
      ['commentary after the closing sentinel', `${example}\nHope this helps.`],
      ['a Markdown fence around the response', `\`\`\`json\n${example}\n\`\`\``],
      ['a misplaced sentinel (closing first)', `${SHOW_VS_TELL_RESPONSE_END}\n${example.split('\n')[1]}\n${SHOW_VS_TELL_RESPONSE_START}`],
      ['a duplicated opening sentinel', `${SHOW_VS_TELL_RESPONSE_START}\n${example}`],
      ['a duplicated closing sentinel', `${example}\n${SHOW_VS_TELL_RESPONSE_END}`],
      ['a sentinel with a changed version', example.replace('SHOW_VS_TELL_V1', 'SHOW_VS_TELL_V2')],
      ['an empty body', `${SHOW_VS_TELL_RESPONSE_START}\n${SHOW_VS_TELL_RESPONSE_END}`],
      ['invalid JSON', `${SHOW_VS_TELL_RESPONSE_START}\n{"version":1,\n${SHOW_VS_TELL_RESPONSE_END}`],
      ['an empty response', '']
    ])('rejects %s', (_label, content) => {
      expect(() => decode(content)).toThrow();
    });

    it('rejects a truncated response that never reaches its closing sentinel', () => {
      const truncated = example.slice(0, Math.floor(example.length * 0.6));

      expect(() => decode(truncated)).toThrow(/exactly one|closing sentinel/);
    });

    it('rejects a response over the character ceiling before parsing it', () => {
      const oversized = `${example}${' '.repeat(budget.showVsTellResponseCharacters)}`;

      expect(oversized.length).toBeGreaterThan(budget.showVsTellResponseCharacters);
      expect(() => decode(oversized)).toThrow(
        new RegExp(`exceeds ${budget.showVsTellResponseCharacters} characters`)
      );
    });

    it('rejects a workup id the host did not mint', () => {
      expect(() => decodeShowVsTellResponse(example, { ...context, workupId: 'model-chosen' }))
        .toThrow(/host-minted svtw-<UUID>/);
    });
  });

  describe('exact keys and model-supplied ids', () => {
    it.each<[string, (wire: WireResponse) => void]>([
      ['an unknown top-level key', (wire) => { (wire as unknown as Record<string, unknown>).ranking = []; }],
      ['a missing groups key', (wire) => { delete (wire as unknown as Record<string, unknown>).groups; }],
      ['a missing version', (wire) => { delete (wire as unknown as Record<string, unknown>).version; }],
      ['a model-supplied workup id', (wire) => { (wire as unknown as Record<string, unknown>).workupId = SVT_TEST_WORKUP_ID; }],
      ['an unknown group key', (wire) => { (wire.groups[0] as unknown as Record<string, unknown>).label = 'Told'; }],
      ['a model-supplied group id', (wire) => { (wire.groups[0] as unknown as Record<string, unknown>).id = 'g1'; }],
      ['a missing group variants key', (wire) => { delete (wire.groups[0] as unknown as Record<string, unknown>).variants; }],
      ['a model-supplied variant id', (wire) => { (wire.groups[0].variants[0] as unknown as Record<string, unknown>).id = 'v1'; }],
      ['a model-supplied word count', (wire) => { (wire.groups[0].variants[0] as unknown as Record<string, unknown>).wordCount = 9; }],
      ['a model-supplied score', (wire) => { (wire.groups[0].variants[0] as unknown as Record<string, unknown>).score = 0.9; }],
      ['a missing variant key', (wire) => { delete (wire.groups[0].variants[0] as unknown as Record<string, unknown>).costs; }],
      ['a model-supplied flag id', (wire) => {
        (wire.groups[1].variants[0].invariantFlags[0] as unknown as Record<string, unknown>).id = 'f1';
      }],
      ['an unknown flag key', (wire) => {
        (wire.groups[1].variants[0].invariantFlags[0] as unknown as Record<string, unknown>).severity = 'high';
      }],
      ['a non-string prose', (wire) => { (wire.groups[0].variants[0] as unknown as Record<string, unknown>).prose = 7; }],
      ['a non-array channels', (wire) => { (wire.groups[0].variants[0] as unknown as Record<string, unknown>).channels = 'summary-exposition'; }],
      ['a wrong protocol version', (wire) => { wire.version = 2; }],
      ['a stringified protocol version', (wire) => { (wire as unknown as Record<string, unknown>).version = '1'; }]
    ])('rejects %s', (_label, mutate) => {
      expect(() => decode(mutated(mutate))).toThrow();
    });
  });

  describe('group count, kind, and order', () => {
    it.each<[string, (wire: WireResponse) => void]>([
      ['three groups', (wire) => { wire.groups.pop(); }],
      ['five groups', (wire) => { wire.groups.push({ ...wire.groups[0] }); }],
      ['no groups', (wire) => { wire.groups = []; }],
      ['an unknown group kind', (wire) => { wire.groups[0].kind = 'ranked-best'; }],
      ['groups in the wrong order', (wire) => { wire.groups.reverse(); }],
      ['the first two groups swapped', (wire) => { [wire.groups[0], wire.groups[1]] = [wire.groups[1], wire.groups[0]]; }],
      ['a repeated kind replacing another', (wire) => { wire.groups[3].kind = 'told-cleanly'; }],
      ['a group with no variants', (wire) => { wire.groups[2].variants = []; }],
      ['a group with three variants', (wire) => {
        const group = wire.groups[3];
        group.variants.push(
          { ...group.variants[0], prose: 'A second, different mixed variant of the beat that is long enough to hold a direction.' },
          { ...group.variants[0], prose: 'A third, different mixed variant of the beat that is also long enough for its direction.' }
        );
      }]
    ])('rejects %s', (_label, mutate) => {
      expect(() => decode(mutated(mutate))).toThrow();
    });

    it('accepts one variant in a group and two in another (the 4–8 total follows)', () => {
      const content = mutated((wire) => { wire.groups[0].variants.pop(); });

      expect(decode(content).groups.map((group) => group.variants.length)).toEqual([1, 2, 2, 1]);
    });
  });

  describe('field limits', () => {
    const long = (length: number): string => `${'word '.repeat(Math.ceil(length / 5))}`.slice(0, length);

    it.each<[string, (wire: WireResponse) => void]>([
      ['a blank prose', (wire) => { wire.groups[0].variants[0].prose = '   '; }],
      ['an oversize prose', (wire) => { wire.groups[0].variants[0].prose = long(budget.showVsTellProseCharacters + 1); }],
      ['a blank direction', (wire) => { wire.groups[0].variants[0].direction = ''; }],
      ['an oversize direction', (wire) => {
        wire.groups[0].variants[0].prose = long(budget.showVsTellProseCharacters);
        wire.groups[0].variants[0].direction = long(budget.showVsTellDirectionCharacters + 1);
      }],
      ['an oversize gains', (wire) => { wire.groups[0].variants[0].gains = long(budget.showVsTellGainsCharacters + 1); }],
      ['a blank gains', (wire) => { wire.groups[0].variants[0].gains = ' '; }],
      ['an oversize costs', (wire) => { wire.groups[0].variants[0].costs = long(budget.showVsTellCostsCharacters + 1); }],
      ['a blank costs', (wire) => { wire.groups[0].variants[0].costs = ''; }],
      ['no channels', (wire) => { wire.groups[0].variants[0].channels = []; }],
      ['three channels', (wire) => { wire.groups[0].variants[0].channels = ['summary-exposition', 'observable-action', 'interiority']; }],
      ['a repeated channel', (wire) => { wire.groups[0].variants[0].channels = ['observable-action', 'observable-action']; }],
      ['an unknown channel', (wire) => { wire.groups[0].variants[0].channels = ['summary']; }],
      ['five flags on one variant', (wire) => {
        wire.groups[1].variants[0].invariantFlags = Array.from(
          { length: budget.showVsTellFlagsPerVariant + 1 },
          (_value, index) => ({
            invariantField: 'must-survive', kind: 'advisory-risk', note: `Risk ${index + 1}.`
          })
        );
      }],
      ['an oversize flag note', (wire) => {
        wire.groups[1].variants[0].invariantFlags[0].note = long(budget.showVsTellFlagNoteCharacters + 1);
      }],
      ['a blank flag note', (wire) => { wire.groups[1].variants[0].invariantFlags[0].note = '  '; }],
      ['an unknown flag kind', (wire) => { wire.groups[1].variants[0].invariantFlags[0].kind = 'blocker'; }],
      ['an unknown flag field', (wire) => { wire.groups[1].variants[0].invariantFlags[0].invariantField = 'tone'; }]
    ])('rejects %s', (_label, mutate) => {
      expect(() => decode(mutated(mutate))).toThrow();
    });

    it('accepts fields exactly at their limits', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[0].variants[0];
        variant.gains = long(budget.showVsTellGainsCharacters);
        variant.costs = long(budget.showVsTellCostsCharacters);
        variant.prose = long(budget.showVsTellProseCharacters);
        variant.direction = long(budget.showVsTellDirectionCharacters);
      });

      expect(() => decode(content)).not.toThrow();
    });
  });

  describe('the direction is strictly shorter than its prose', () => {
    it('rejects a direction exactly as long as its prose', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[0].variants[0];
        variant.prose = 'She waited by the door.';
        variant.direction = 'Hold her at the door ';
        variant.direction = variant.direction.padEnd(variant.prose.length, 'x');
      });

      expect(() => decode(content)).toThrow(/strictly shorter than its prose/);
    });

    it('rejects a direction longer than its prose', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[0].variants[0];
        variant.prose = 'She waited.';
        variant.direction = 'Hold her still at the door and let the silence do the telling.';
      });

      expect(() => decode(content)).toThrow(/strictly shorter than its prose/);
    });

    it('measures both sides trimmed, so padding cannot make a direction pass', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[0].variants[0];
        variant.prose = 'She waited.';
        variant.direction = `  ${'x'.repeat(11)}  `;
      });

      expect(() => decode(content)).toThrow(/strictly shorter than its prose/);
    });

    it('accepts a direction one character shorter than its prose', () => {
      const content = mutated((wire) => {
        const variant = wire.groups[0].variants[0];
        variant.prose = 'She waited by the door.';
        variant.direction = 'x'.repeat(variant.prose.length - 1);
      });

      expect(() => decode(content)).not.toThrow();
    });
  });

  describe('normalized duplicate prose', () => {
    const withSecondProse = (first: string, second: string): string =>
      mutated((wire) => {
        wire.groups[0].variants[0].prose = first;
        wire.groups[0].variants[0].direction = 'Say it plainly.';
        wire.groups[1].variants[0].prose = second;
        wire.groups[1].variants[0].direction = 'Say it plainly.';
      });

    it('rejects the exact same prose in two groups', () => {
      expect(() => decode(withSecondProse('She was not sure.', 'She was not sure.'))).toThrow(
        /distinct from .* after normalization/
      );
    });

    it('rejects a case and punctuation difference only', () => {
      expect(() => decode(withSecondProse('She was not sure.', 'she WAS not... sure!'))).toThrow(
        /after normalization/
      );
    });

    it.each([
      ['a right single quote (U+2019)', 'She hadn’t looked up.'],
      ['a left single quote (U+2018)', 'She hadn‘t looked up.'],
      ['a modifier-letter apostrophe (U+02BC)', 'She hadnʼt looked up.']
    ])('rejects %s against the ASCII apostrophe', (_label, variantProse) => {
      expect(() => decode(withSecondProse("She hadn't looked up.", variantProse))).toThrow(
        /after normalization/
      );
    });

    it('rejects a full-width and NFKC-equivalent restatement', () => {
      expect(() => decode(withSecondProse('She was not sure.', 'Ｓhe was not sure.'))).toThrow(
        /after normalization/
      );
    });

    it('accepts prose that differs by a real word', () => {
      expect(() => decode(withSecondProse('She was not sure.', 'She was never sure.'))).not.toThrow();
    });
  });

  describe('flags against the declared invariants', () => {
    const flag = (invariantField: string, kind: string) => ({
      invariantField, kind, note: 'Passive warning.'
    });

    it('rejects a flag against a blank must-not-change', () => {
      const content = mutated((wire) => {
        wire.groups[1].variants[0].invariantFlags = [flag('must-not-change', 'advisory-risk')];
      });

      expect(() => decode(content, { mustSurvive: 'the distrust is old', mustNotChange: '' }))
        .toThrow(/writer-declared nonblank invariant field/);
    });

    it('rejects a flag against a whitespace-only must-not-change', () => {
      const content = mutated((wire) => {
        wire.groups[1].variants[0].invariantFlags = [flag('must-not-change', 'advisory-risk')];
      });

      expect(() => decode(content, { mustSurvive: 'the distrust is old', mustNotChange: '   ' }))
        .toThrow(/writer-declared nonblank invariant field/);
    });

    it('rejects a flag against a blank must-survive', () => {
      const content = mutated((wire) => {
        wire.groups[1].variants[0].invariantFlags = [flag('must-survive', 'advisory-risk')];
      });

      expect(() => decode(content, { mustSurvive: '', mustNotChange: 'no flashback' }))
        .toThrow(/writer-declared nonblank invariant field/);
    });

    it('rejects a hard-conflict against must-survive', () => {
      const content = mutated((wire) => {
        wire.groups[1].variants[0].invariantFlags = [flag('must-survive', 'hard-conflict')];
      });

      expect(() => decode(content)).toThrow(/hard-conflict only against must-not-change/);
    });

    it('accepts a hard-conflict against a nonblank must-not-change, passively', () => {
      const content = mutated((wire) => {
        wire.groups[1].variants[0].invariantFlags = [flag('must-not-change', 'hard-conflict')];
      });

      const workup = decode(content);

      expect(workup.groups[1].variants[0].invariantFlags).toEqual([
        expect.objectContaining({ invariantField: 'must-not-change', kind: 'hard-conflict' })
      ]);
    });
  });
});
