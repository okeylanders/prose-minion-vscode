/**
 * The Craft Flags prompts and the cliché worked example (ADR 2026-10-21,
 * Amendment 2026-10-26: Slice 3c): one vocabulary with the Lightbox, the
 * fence's words in the prompt, and an example that reads through the
 * production frame, codec, anchoring and placement.
 */
import * as fs from 'fs';
import * as path from 'path';
import { FAMILIAR_PHRASE_DEFINITIONS, FAMILIAR_PHRASE_KINDS } from '@shared/constants/familiarPhrasing';
import { CRAFT_FLAG_KINDS } from '@/domain/models/CraftFlag';
import { decodeCraftFlagsReply, readCraftFlagsFrame } from '@services/craftFlags/CraftFlagsResponseCodec';
import { CRAFT_FLAGS_SHARED_PROMPT, CRAFT_FLAG_PROMPTS } from '@services/craftFlags/CraftFlagsService';
import { anchorQuote } from '@/utils/draftEdit/anchorEdits';
import { findSpeechSpans } from '@/utils/draftEdit/speechSpans';
import { phraseRepeats } from '@/utils/craftFlags/phraseRepeats';
import { CRAFT_FLAG_FORBIDDEN_PHRASES } from '@/utils/craftFlags/craftFlagPhrasing';

const PROMPTS = path.resolve(__dirname, '../../../../../../resources/system-prompts');
const readPrompt = (file: string) => fs.readFileSync(path.join(PROMPTS, file), 'utf8');
const shared = readPrompt(CRAFT_FLAGS_SHARED_PROMPT);
const [category, example] = CRAFT_FLAG_PROMPTS.cliche.map(readPrompt);
const section = (text: string, heading: string, next: string) => text.slice(text.indexOf(heading), text.indexOf(next));

describe('The Craft Flags prompts', () => {
  it('load the shared rules, then each category\'s section and worked example', () => {
    expect(CRAFT_FLAGS_SHARED_PROMPT).toBe('craft-flags/00-craft-flags.md');
    expect(CRAFT_FLAG_PROMPTS).toEqual({ cliche: ['craft-flags/10-cliche.md', 'craft-flags/11-cliche-example.md'] });
  });

  it('define the familiar kinds in the shared words, verbatim, and flag only the cliché category\'s two', () => {
    for (const kind of FAMILIAR_PHRASE_KINDS) {
      expect(category).toContain(`- \`${kind}\`: ${FAMILIAR_PHRASE_DEFINITIONS[kind]}.`);
    }
    const flagged = [...section(category, 'Flag only these two kinds', '## What to leave alone').matchAll(/^- `([a-z]+)`:/gm)].map((match) => match[1]);
    expect(flagged).toEqual([...CRAFT_FLAG_KINDS.cliche]);
  });

  it('hold the Lightbox\'s familiar phrasing to the same four kinds, and its weighted tier to the same words', () => {
    const lightbox = readPrompt('lightbox/50-stock-signature.md');
    expect(lightbox).toContain('`kind`: `idiom`, `cliche`, `stock` (a stock phrase), or `weighted`');
    expect(lightbox).toContain(`\`weighted\`: ${FAMILIAR_PHRASE_DEFINITIONS.weighted};`);
  });

  it('teach every word the phrasing fence withholds, and the other rules it holds a note to', () => {
    const phrasing = section(shared, '## How a note is phrased', '## Response format');
    for (const word of ['should', 'must', 'fix', 'cut', 'delete', 'remove', 'replace', 'rewrite', 'wrong', 'bad']) {
      expect(phrasing).toMatch(new RegExp(`\\b${word}\\b`));
    }
    // The fence's two-word orders, as the prompt names them (each with its other forms in the fence).
    for (const phrase of ['need to', 'have to']) {
      expect(CRAFT_FLAG_FORBIDDEN_PHRASES).toContain(phrase);
      expect(phrasing).toContain(phrase);
    }
    expect(phrasing).toMatch(/double quotation marks/);
    expect(phrasing).toMatch(/digit/);
  });
});

describe('The cliché worked example', () => {
  const passage = section(example, '## Passage', '## Response').replace('## Passage', '').trim();
  const frame = section(example, '## Response', 'Nothing else is flagged').match(/```\n([\s\S]*?)\n```/)?.[1] ?? '';
  const reply = decodeCraftFlagsReply(readCraftFlagsFrame(frame).root, 'cliche');

  it('reads through the production frame reader and codec, whole, every note shown as written', () => {
    expect(reply).toMatchObject({ malformed: 0, ignoredFields: 0, notesWithheld: 0 });
    expect(reply.findings.length).toBeGreaterThan(3);
    expect(new Set(reply.findings.map((finding) => finding.kind))).toEqual(new Set(['cliche', 'weighted']));
  });

  it('quotes phrases that anchor once in its passage, none in speech, each repeat counted by the host', () => {
    const speech = findSpeechSpans(passage);
    const repeats = phraseRepeats(passage, speech);
    const placed = reply.findings.map((finding) => {
      const anchored = anchorQuote(passage, finding.anchor);
      expect({ quote: finding.anchor.quote, kind: anchored.kind }).toEqual({ quote: finding.anchor.quote, kind: 'anchored' });
      const { start, end } = anchored.kind === 'anchored' ? anchored : { start: 0, end: 0 };
      expect(speech.some((span) => span.start < end && start < span.end)).toBe(false);
      return { text: passage.slice(start, end), repeats: repeats.count(passage.slice(start, end)) };
    });
    expect(placed.filter((each) => each.text === 'time stood still').map((each) => each.repeats)).toEqual([2, 2]);
  });

  it('leaves the Rabbit\'s cliché alone, inside its speech', () => {
    expect(passage).toContain('as busy as a bee');
    expect(reply.findings.some((finding) => /busy as a bee/.test(finding.anchor.quote))).toBe(false);
  });
});
