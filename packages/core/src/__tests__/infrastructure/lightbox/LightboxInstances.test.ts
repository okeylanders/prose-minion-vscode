/**
 * Where a counted item's instances stand (Slice 4E): each finder is the rule
 * that made its figure. The token streams are the tools' own token lists,
 * token for token, each with the span it was read from; phrases are runs of
 * that stream; the hapax list is the prose-stats words used once. Lines from
 * Lewis Carroll's "Alice's Adventures in Wonderland" (1865, public domain)
 * and lines written for these tests.
 */

import { extractFrequencyWords } from '@/tools/measure/wordFrequency';
import { PassageProseStats, proseStatsWords } from '@/tools/measure/passageProseStats';
import { StyleFlags } from '@/tools/measure/styleFlags';
import { splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';
import {
  LIGHTBOX_STYLE_FLAG_IDS,
  lightboxFrequencyTokenSpans,
  lightboxHapaxWords,
  lightboxLowercaseSpanMap,
  lightboxParagraphsTouched,
  lightboxPhraseInstances,
  lightboxProseTokenSpans,
  lightboxStyleFlagInstances,
  lightboxTokenInstances
} from '@/infrastructure/lightbox/LightboxInstances';

/** Lines whose edges each tokenizer treats differently. */
const EDGES = [
  '“Oh dear!” — the Rabbit’s watch, the rabbit-hole, ’twas so. \'Tis late.',
  'İstanbul\'s KELVIN x2 3rd -- - \'quoted\' don\'t—won’t...   end',
  'Down, down, down. Would the fall NEVER come to an end? Never–never.',
  ''
];

describe('the token streams are the tools\' own, with spans', () => {
  it('reads exactly the word-frequency tool\'s tokens', () => {
    for (const text of EDGES) {
      expect(lightboxFrequencyTokenSpans(text).map((span) => span.token)).toEqual(extractFrequencyWords(text.toLowerCase()));
    }
  });

  it('reads exactly the prose-stats tool\'s words', () => {
    for (const text of EDGES) {
      expect(lightboxProseTokenSpans(text).map((span) => span.token)).toEqual(proseStatsWords(text));
    }
  });

  it('spans a word-frequency token from its first to its last letter or hyphen', () => {
    const text = EDGES[0] + ' ' + EDGES[1];
    const pairs = lightboxFrequencyTokenSpans(text).map(({ token, start, end }) => [token, text.slice(start, end)]);
    expect(pairs).toEqual([
      ['oh', 'Oh'], ['dear', 'dear'], ['the', 'the'], ['rabbits', 'Rabbit’s'], ['watch', 'watch'], ['the', 'the'],
      ['rabbit-hole', 'rabbit-hole'], ['twas', 'twas'], ['so', 'so'], ['tis', 'Tis'], ['late', 'late'],
      ['istanbul\'s', 'İstanbul\'s'], ['kelvin', 'KELVIN'], ['x', 'x'], ['rd', 'rd'], ['--', '--'], ['-', '-'],
      ['quoted', 'quoted'], ['don\'t', 'don\'t'], ['wont', 'won’t'], ['end', 'end']
    ]);
  });

  it('spans a prose-stats word from its first to its last letter or apostrophe, dashes and hyphens inside', () => {
    const text = EDGES[0] + ' ' + EDGES[1];
    const pairs = lightboxProseTokenSpans(text).map(({ token, start, end }) => [token, text.slice(start, end)]);
    expect(pairs).toEqual([
      ['oh', 'Oh'], ['dear', 'dear'], ['the', 'the'], ['rabbits', 'Rabbit’s'], ['watch', 'watch'], ['the', 'the'],
      ['rabbithole', 'rabbit-hole'], ['twas', 'twas'], ['so', 'so'], ['\'tis', '\'Tis'], ['late', 'late'],
      ['istanbul\'s', 'İstanbul\'s'], ['kelvin', 'KELVIN'], ['x', 'x'], ['rd', 'rd'],
      ['\'quoted\'', '\'quoted\''], ['don\'twont', 'don\'t—won’t'], ['end', 'end']
    ]);
  });
});

describe('instances', () => {
  it('finds a word as whole tokens only', () => {
    const text = 'Every bright window; a very bright window... very, VERY!';
    const slices = lightboxTokenInstances(lightboxFrequencyTokenSpans(text), 'very').map(({ start, end }) => text.slice(start, end));
    expect(slices).toEqual(['very', 'very', 'VERY']);
  });

  it('finds a phrase as consecutive tokens, overlapping and across a paragraph break, as the n-gram count does', () => {
    const text = 'He had had had enough.\n\nWould it never come to an end\n\nNever? It had had its day.';
    const tokens = lightboxFrequencyTokenSpans(text);
    const slices = (phrase: string) => lightboxPhraseInstances(tokens, phrase).map(({ start, end }) => text.slice(start, end));
    // "had had" stands three times: twice overlapping in "had had had", once later.
    expect(slices('had had')).toEqual(['had had', 'had had', 'had had']);
    expect(slices('end never')).toEqual(['end\n\nNever']);
    expect(slices('come to an end')).toEqual(['come to an end']);
    expect(slices('')).toEqual([]);
  });

  it('places a span across a paragraph break in both paragraphs', () => {
    const text = 'It was the end\n\nNever again.';
    const paragraphs = splitLightboxParagraphs(text);
    const [span] = lightboxPhraseInstances(lightboxFrequencyTokenSpans(text), 'end never');
    expect(lightboxParagraphsTouched(paragraphs, span)).toEqual([1, 2]);
  });

  it('finds each instance-counting style flag by its own detector, as many as the tool counts', () => {
    const text = 'Suddenly she was really quite frightened; the door was opened, and it had been locked. ' +
      'She did get very tired. It was only a family of rabbits, really.';
    const flags = new StyleFlags().analyze({ text }).flags;
    const counted = flags.filter((flag) => LIGHTBOX_STYLE_FLAG_IDS[flag.type] !== undefined);
    // The tool orders its flags by count; the ids are what matter.
    expect(Object.fromEntries(counted.map((flag) => [LIGHTBOX_STYLE_FLAG_IDS[flag.type], flag.count]))).toEqual({
      adverbs: 5,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
      'passive-voice': 2,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
      'weak-verbs': 6,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- the flag ids are kebab-case protocol literals.
      'filler-words': 4
    });
    for (const flag of counted) {
      expect(lightboxStyleFlagInstances(text, LIGHTBOX_STYLE_FLAG_IDS[flag.type])).toHaveLength(flag.count);
    }
    expect(lightboxStyleFlagInstances(text, 'passive-voice').map(({ start, end }) => text.slice(start, end)))
      .toEqual(['was opened', 'been locked']);
    // Repetitive Words and Clichés count words and phrases, not instances.
    expect(Object.keys(LIGHTBOX_STYLE_FLAG_IDS)).not.toContain('Repetitive Words');
    expect(Object.keys(LIGHTBOX_STYLE_FLAG_IDS)).not.toContain('Clichés');
  });
});

describe('the hapax list', () => {
  it('is the prose-stats words used once, in order of first appearance, as written', () => {
    const text = '# Down the Rabbit-Hole\n\nDown, down, down. Would the fall NEVER come to an end? Never—never.\n\n\'Tis the end.';
    const hapax = lightboxHapaxWords(text, splitLightboxParagraphs(text));
    expect(hapax.map(({ term, written, paragraph }) => [term, written, paragraph])).toEqual([
      ['rabbithole', 'Rabbit-Hole', 1],
      ['would', 'Would', 2],
      ['fall', 'fall', 2],
      ['never', 'NEVER', 2],
      ['come', 'come', 2],
      ['to', 'to', 2],
      ['an', 'an', 2],
      ['nevernever', 'Never—never', 2],
      ['\'tis', '\'Tis', 3]
    ]);
    // Exactly as many as the stats row's hapax count.
    expect(new PassageProseStats().analyze({ text }).hapaxCount).toBe(9);
  });
});

describe('spans of the lowercased text map back onto the text', () => {
  it('is the identity when lower-casing keeps every length', () => {
    const map = lightboxLowercaseSpanMap('Down the Rabbit-Hole');
    expect(map({ start: 9, end: 20 })).toEqual({ start: 9, end: 20 });
  });

  it('follows "İ", which lower-cases to two units, to the character it came from', () => {
    const text = 'İstanbul is far. İ';
    const lowered = text.toLowerCase();
    const map = lightboxLowercaseSpanMap(text);
    const at = lowered.indexOf(' is ') + 1;
    const span = map({ start: at, end: at + 2 });
    expect(text.slice(span.start, span.end)).toBe('is');
    // A token that is the lowered "i" alone ends after the whole "İ".
    const last = map({ start: lowered.length - 2, end: lowered.length - 1 });
    expect(text.slice(last.start, last.end)).toBe('İ');
    expect(map({ start: 0, end: 9 })).toEqual({ start: 0, end: 8 });
  });
});
