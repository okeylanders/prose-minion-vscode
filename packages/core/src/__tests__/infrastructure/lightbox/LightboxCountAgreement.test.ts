/**
 * The inspector's wells agree with the board's counts (Slice 4E). For every
 * entry the board lists (each top word, each word on the four
 * part-of-speech lists, each repeated phrase, each hapax word and each style
 * flag that counts instances), the instances a passage finds equal the count
 * the board shows, and so do the distinct instances it lights plus the ones
 * past its row bound. Each lit instance reads back as its term.
 *
 * The boards are built by the production LightboxService with the real
 * measurement services, from public-domain text: Chapter I of Lewis
 * Carroll's "Alice's Adventures in Wonderland" (1865), ¶1–¶8 as the worked
 * examples hold them, and the opening in curly, straight, mixed and wrapped
 * quotes; and Chapter VII's dialogue-heavy Tea-Party opening, as Gutenberg
 * sets it and in curly double quotes, where nearly every sentence ends with a
 * closing mark (ADR 2026-10-21). A few counts are literal, checked by hand
 * and with grep against the text, not taken from the code under test.
 */

import type { LightboxBoard, LightboxInstancesPassage, LightboxPassageRow, LightboxPassageTerm } from '@messages';
import { buildLightboxPassage } from '@/infrastructure/lightbox/LightboxPassages';
import { LIGHTBOX_PASSAGE_BOUNDS } from '@shared/constants/lightboxPassages';
import { extractFrequencyWords } from '@/tools/measure/wordFrequency';
import { proseStatsWords } from '@/tools/measure/passageProseStats';
import { boardWithPassages, lightboxSentenceRows, type LightboxBoardWithPassages } from '@/__tests__/infrastructure/lightbox/lightboxPassageFixtures';
import { readWorkedExample } from '@/__tests__/infrastructure/lightbox/lightboxReadingFixtures';
import {
  ALICE_OPENING_CURLY,
  ALICE_OPENING_MIXED,
  ALICE_OPENING_STRAIGHT,
  ALICE_OPENING_WRAPPED,
  aliceWords
} from '@/__tests__/infrastructure/lightbox/lightboxProseFixtures';
import { TEA_PARTY_CURLY, TEA_PARTY_SINGLE } from '@/__tests__/tools/measure/passageProseStats/teaPartyFixtures';

const EXAMPLE = readWorkedExample('A').paragraphs.join('\n\n');

const FIXTURES: ReadonlyArray<[string, string]> = [
  ['the worked examples\' ¶1–¶8', EXAMPLE],
  ['the opening, curly quotes', ALICE_OPENING_CURLY],
  ['the opening, straight quotes', ALICE_OPENING_STRAIGHT],
  ['the opening, mixed quotes', ALICE_OPENING_MIXED],
  ['the opening, wrapped lines', ALICE_OPENING_WRAPPED],
  ['the Tea-Party, single quotes', TEA_PARTY_SINGLE],
  ['the Tea-Party, curly double quotes', TEA_PARTY_CURLY],
  // Long enough that the most frequent words pass the row bound.
  ['6,000 words of the opening\'s vocabulary', aliceWords(6000)]
];

type Built = LightboxBoardWithPassages;
const build = (text: string): Promise<Built> => boardWithPassages(text);

/** Every entry the board lists that a well can open, with the count it shows and how one instance reads. */
function listedEntries(board: LightboxBoard): Array<{ label: string; term: LightboxPassageTerm; count: number; reads: (text: string) => boolean }> {
  const measured = board.measured;
  const frequency = (expected: string[]) => (text: string) => extractFrequencyWords(text.toLowerCase()).join(' ') === expected.join(' ');
  return [
    ...measured.topWords.map((entry) => ({
      label: `top word "${entry.term}"`,
      term: { kind: 'word' as const, word: entry.term },
      count: entry.count,
      reads: frequency([entry.term])
    })),
    ...(['nouns', 'verbs', 'adjectives', 'adverbs'] as const).flatMap((pos) => measured.partsOfSpeech[pos].map((entry) => ({
      label: `${pos} "${entry.term}"`,
      term: { kind: 'pos' as const, pos, word: entry.term },
      count: entry.count,
      // A tagger token, normalized as the tool counts it: "n't" of "don't", "alice" of "Alice's".
      reads: (text: string) => text.toLowerCase().replace(/[^a-z']/g, '') === entry.term
    }))),
    ...[...measured.phrases.bigrams, ...measured.phrases.trigrams].map((entry) => ({
      label: `phrase "${entry.term}"`,
      term: { kind: 'phrase' as const, phrase: entry.term },
      count: entry.count,
      reads: frequency(entry.term.split(' '))
    })),
    ...measured.hapax.map((entry) => ({
      label: `hapax "${entry.term}"`,
      term: { kind: 'hapax' as const, word: entry.term },
      count: 1,
      reads: (text: string) => proseStatsWords(text).join('') === entry.term
    })),
    ...measured.styleFlags.flatMap((flag) => (flag.id ? [{
      label: `style flag ${flag.id}`,
      term: { kind: 'flag' as const, flag: flag.id },
      count: flag.count,
      reads: (text: string) => text.trim().length > 0
    }] : []))
  ];
}

/**
 * Each lit instance's text, its pieces joined in order (a space between
 * sentences). A row outside every sentence (PR #161 N-01) lights its
 * instances in its one stretch.
 */
function litTexts(rows: readonly LightboxPassageRow[]): Map<number, string> {
  const texts = new Map<number, string>();
  for (const row of rows) {
    for (const stretch of 'outside' in row ? [row.outside] : row.sentences) {
      const pieces = new Map<number, string>();
      for (const segment of stretch.segments) {
        for (const id of segment.instances ?? []) {
          pieces.set(id, (pieces.get(id) ?? '') + segment.text);
        }
      }
      for (const [id, piece] of pieces) {
        texts.set(id, texts.has(id) ? `${texts.get(id)} ${piece}` : piece);
      }
    }
  }
  return texts;
}

function instancesOf(built: Built, term: LightboxPassageTerm): LightboxInstancesPassage {
  const passage = buildLightboxPassage(built.board, built.passages, { kind: 'instances', term });
  if (passage.kind !== 'instances') {
    throw new Error(`Expected instances, got ${passage.kind}`);
  }
  return passage;
}

describe.each(FIXTURES)('on %s, every listed entry\'s well agrees with its count', (_name, text) => {
  let built: Built;
  beforeAll(async () => {
    built = await build(text);
  });

  it('lists entries in every family a well opens', () => {
    const families = new Set(listedEntries(built.board).map((entry) => entry.term.kind));
    // The repeated vocabulary uses no word once, so it alone has no hapax to open.
    const hapax = built.board.measured.headline.hapaxCount > 0 ? ['hapax'] : [];
    expect([...families].sort()).toEqual(['flag', ...hapax, 'phrase', 'pos', 'word']);
  });

  it('finds exactly as many instances as the board counts, and lights each, reading as its term', () => {
    const disagreements: string[] = [];
    for (const entry of listedEntries(built.board)) {
      const passage = instancesOf(built, entry.term);
      const lit = litTexts(passage.rows);
      const sentences = new Set(passage.rows.flatMap((row) => ('outside' in row ? [] : row.sentences.map((sentence) => `${sentence.paragraph}:${sentence.sentence}`))));
      const litOutside = new Set(passage.rows.flatMap((row) => ('outside' in row ? row.outside.segments.flatMap((segment) => segment.instances ?? []) : [])));
      const problems = [
        passage.instances !== entry.count && `found ${passage.instances}`,
        lit.size + passage.more.instances !== entry.count && `lit ${lit.size} + ${passage.more.instances} past the bound`,
        [...lit.values()].some((value) => !entry.reads(value)) && 'an instance that does not read as its term',
        sentences.size + passage.more.sentences !== passage.sentences && `${sentences.size} sentences shown + ${passage.more.sentences} past the bound`,
        litOutside.size + passage.more.outside !== passage.outside && `${litOutside.size} outside any sentence + ${passage.more.outside} past the bound`,
        passage.rows.length > LIGHTBOX_PASSAGE_BOUNDS.rows && `${passage.rows.length} rows sent`
      ].filter(Boolean);
      if (problems.length > 0) {
        disagreements.push(`${entry.label} ×${entry.count}: ${problems.join('; ')}`);
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('lists exactly as many hapax words as the stats row counts', () => {
    expect(built.board.measured.hapax).toHaveLength(built.board.measured.headline.hapaxCount);
  });
});

describe('literal counts on the worked examples\' ¶1–¶8 (checked with grep against the text)', () => {
  let built: Built;
  beforeAll(async () => {
    built = await build(EXAMPLE);
  });

  it('finds the counts a reader can check by hand', () => {
    expect(instancesOf(built, { kind: 'word', word: 'alice' }).instances).toBe(7);
    expect(instancesOf(built, { kind: 'pos', pos: 'verbs', word: 'was' }).instances).toBe(13);
    expect(instancesOf(built, { kind: 'pos', pos: 'adverbs', word: 'very' }).instances).toBe(8);
    expect(instancesOf(built, { kind: 'phrase', phrase: 'she had' }).instances).toBe(3);
    expect(instancesOf(built, { kind: 'flag', flag: 'weak-verbs' }).instances).toBe(28);
    expect(instancesOf(built, { kind: 'flag', flag: 'filler-words' }).instances).toBe(11);
    expect(instancesOf(built, { kind: 'flag', flag: 'adverbs' }).instances).toBe(7);
    expect(built.board.measured.hapax).toHaveLength(139);
    expect(built.board.measured.headline.hapaxCount).toBe(139);
  });

  it('puts both of "sister" in ¶2\'s first sentence, lit where the text has them', () => {
    const passage = instancesOf(built, { kind: 'word', word: 'sister' });
    expect({ instances: passage.instances, sentences: passage.sentences, rows: passage.rows.length }).toEqual({ instances: 2, sentences: 1, rows: 1 });
    const [sentence] = lightboxSentenceRows(passage.rows)[0].sentences;
    expect(sentence.paragraph).toBe(2);
    expect(sentence.sentence).toBe(1);
    expect(sentence.segments.filter((segment) => segment.instances).map((segment) => [segment.text, segment.instances]))
      .toEqual([['sister', [0]], ['sister', [1]]]);
    expect(sentence.segments.map((segment) => segment.text).join('').startsWith('Alice was beginning to get very tired')).toBe(true);
  });

  it('opens with the chapter\'s first one-off words, in order, as written', () => {
    expect(built.board.measured.hapax.slice(0, 5).map(({ written, paragraph }) => `${written} ¶${paragraph}`))
      .toEqual(['Chapter ¶1', 'beginning ¶2', 'tired ¶2', 'sitting ¶2', 'bank ¶2']);
  });
});

describe('the row bound', () => {
  it('sends the first rows and says what lies past them', async () => {
    const built = await build(aliceWords(6000));
    const top = built.board.measured.topWords[0];
    const passage = instancesOf(built, { kind: 'word', word: top.term });
    expect(passage.rows).toHaveLength(LIGHTBOX_PASSAGE_BOUNDS.rows);
    expect(passage.more.rows).toBeGreaterThan(0);
    expect(passage.rows.length + passage.more.rows).toBeLessThanOrEqual(passage.sentences);
    expect(litTexts(passage.rows).size + passage.more.instances).toBe(top.count);
  });
});
