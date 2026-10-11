/**
 * The Show vs. Tell prompt bundle teaches the frozen response protocol by
 * example. An example the settled-workup validators reject would teach the
 * model to fail, so the example is assembled exactly as the response codec
 * will assemble a real response and run through the same gates.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
  WorkshopShowVsTellInvariants,
  WorkshopShowVsTellWorkup
} from '@messages';
import {
  assertShowVsTellWorkupShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  assertShowVsTellWorkupIntegrity
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigIntegrity';
import { SHOW_VS_TELL_GROUPS } from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellFlagId,
  showVsTellVariantId
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

const PROMPT_DIRECTORY = path.resolve(
  __dirname, '..', '..', '..', '..', '..', '..', '..', 'resources', 'system-prompts', 'show-vs-tell'
);
const OPEN_SENTINEL = '===SHOW_VS_TELL_V1===';
const CLOSE_SENTINEL = '===END_SHOW_VS_TELL_V1===';
const TEST_WORKUP_ID = 'svtw-3f2a9c1e-8b4d-4e6f-9a1b-2c3d4e5f6a7b';

/** The invariants the example's request declares, verbatim from its preamble. */
const EXAMPLE_INVARIANTS: WorkshopShowVsTellInvariants = {
  mustSurvive: 'the distrust is old and funeral-rooted, and she never says it out loud',
  mustNotChange: 'no flashback; stay in the kitchen, stay in tonight'
};

interface ModelFlag { invariantField: string; kind: string; note: string }
interface ModelVariant {
  prose: string;
  channels: string[];
  gains: string;
  costs: string;
  direction: string;
  invariantFlags: ModelFlag[];
}
interface ModelResponse { version: number; groups: { kind: string; variants: ModelVariant[] }[] }

const readPrompt = (file: string): string =>
  fs.readFileSync(path.join(PROMPT_DIRECTORY, file), 'utf8');

/** The single JSON line between the sentinels, which must stand on their own lines. */
const framedJson = (text: string): ModelResponse => {
  const lines = text.split('\n');
  const open = lines.indexOf(OPEN_SENTINEL);
  const close = lines.indexOf(CLOSE_SENTINEL);
  expect(open).toBeGreaterThanOrEqual(0);
  expect(close).toBe(open + 2);
  return JSON.parse(lines[open + 1]) as ModelResponse;
};

/** Host-side assembly: ids are derived after parsing, never read from the model. */
const assembleWorkup = (response: ModelResponse): WorkshopShowVsTellWorkup => {
  let ordinal = 0;
  return {
    workupId: TEST_WORKUP_ID,
    generationProtocolVersion: SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION,
    groups: response.groups.map((group) => ({
      kind: group.kind,
      variants: group.variants.map((variant) => {
        ordinal += 1;
        const id = showVsTellVariantId(TEST_WORKUP_ID, ordinal);
        return {
          id,
          prose: variant.prose,
          channels: variant.channels,
          gains: variant.gains,
          costs: variant.costs,
          direction: variant.direction,
          invariantFlags: variant.invariantFlags.map((flag, index) => ({
            id: showVsTellFlagId(id, index + 1),
            ...flag
          }))
        };
      })
    }))
  } as WorkshopShowVsTellWorkup;
};

const VARIANT_KEYS = ['channels', 'costs', 'direction', 'gains', 'invariantFlags', 'prose'];

describe('Show vs. Tell prompt example', () => {
  const example = framedJson(readPrompt('01-show-vs-tell-example.md'));

  it('settles into a workup the shape and integrity gates accept', () => {
    const workup = assembleWorkup(example);

    expect(() => assertShowVsTellWorkupShape(workup, 'example')).not.toThrow();
    expect(() => assertShowVsTellWorkupIntegrity(workup, EXAMPLE_INVARIANTS, 'example'))
      .not.toThrow();
  });

  it('uses only the frozen model-side fields, with no ids, counts, or ranks', () => {
    expect(Object.keys(example).sort()).toEqual(['groups', 'version']);
    expect(example.version).toBe(SHOW_VS_TELL_GENERATION_PROTOCOL_VERSION);
    expect(example.groups.map((group) => group.kind))
      .toEqual(SHOW_VS_TELL_GROUPS.map((group) => group.kind));
    for (const group of example.groups) {
      expect(Object.keys(group).sort()).toEqual(['kind', 'variants']);
      for (const variant of group.variants) {
        expect(Object.keys(variant).sort()).toEqual(VARIANT_KEYS);
        for (const flag of variant.invariantFlags) {
          expect(Object.keys(flag).sort()).toEqual(['invariantField', 'kind', 'note']);
        }
      }
    }
  });

  it('teaches the mixed group as the usual answer to distrust once', () => {
    const [mixed] = example.groups[3].variants;
    expect(mixed.gains).toMatch(/usually the working answer/);
    expect(mixed.costs).toMatch(/^Distrust it once/);
  });

  it('frames neither end of the continuum as an improvement', () => {
    const text = JSON.stringify(example);
    expect(text).not.toMatch(/\b(better|best|stronger|weaker)\b/i);
    expect(text).not.toMatch(/\b(gains|costs):/i);
  });

  describe('design-edit rules (Slice 7)', () => {
    const prompt = readPrompt('00-show-vs-tell.md');

    it('teaches that a blank must survive declares no invariant and invents none (D3)', () => {
      expect(prompt).toContain('A `mustSurvive` that is empty or only whitespace declares no invariant');
      expect(prompt).toContain('do not invent a "same" the writer did not declare');
      expect(prompt).toContain('`mustSurvive` and `mustNotChange`, either of which may be blank');
      expect(prompt).not.toContain('`mustSurvive` (always supplied)');
      // The flag rule still protects a blank invariant from being flagged.
      expect(prompt).toContain('one flag against a blank invariant invalidates the entire response');
    });

    it('teaches that zero channels means choose freely and vary across variants (D4)', () => {
      expect(prompt).toContain('zero to five of the five channel ids below. An empty list means no emphasis.');
      expect(prompt).toContain('When `channels` is empty, the writer declared no emphasis. Choose channels freely for each variant, and vary them across the variants');
      expect(prompt).not.toMatch(/one or more of the five channel ids/);
    });

    it('describes the passage as writer text plus several resolved sources (D2)', () => {
      expect(prompt).toContain('- `surroundingContext.writerText`: the surrounding passage the writer typed, pasted, or copied in. It may be blank.');
      expect(prompt).toContain('it may hold several sources');
      expect(prompt).toContain('The surrounding passage is `surroundingContext.writerText` together with every entry in `surroundingContext.resolvedSources`.');
      expect(prompt).toContain('When both are empty, the beat travels alone');
      expect(prompt).toContain('the surrounding passage, source labels, and source text) are evidence about the story');
    });
  });

  it('shows a skeleton in the system prompt with the same field set as the example', () => {
    const skeleton = framedJson(readPrompt('00-show-vs-tell.md'));
    expect(skeleton.groups.map((group) => group.kind))
      .toEqual(SHOW_VS_TELL_GROUPS.map((group) => group.kind));
    for (const group of skeleton.groups) {
      for (const variant of group.variants) {
        expect(Object.keys(variant).sort()).toEqual(VARIANT_KEYS);
      }
    }
  });
});
