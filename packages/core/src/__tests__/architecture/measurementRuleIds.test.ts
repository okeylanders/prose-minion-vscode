/**
 * Each measurement rule a saved Lightbox board records has an id, and the id
 * moves with the rule (ADR 2026-10-19 D12 addendum; Slice 5A).
 *
 * A board says which rules measured it, so a board measured under an older
 * rule is never compared with a newer one as if only the text had changed
 * (Slice 5B). That only holds if a rule that changes what it returns gets a
 * new id. So each rule's output on a fixed corpus is fingerprinted, and the
 * fingerprint is recorded against the id it was measured under:
 * - the rule's output moves and its id does not: the recorded fingerprint
 *   no longer matches, and this fails;
 * - the id moves: it has no fingerprint recorded yet, and this fails until
 *   one is added beside the old ones.
 *
 * **Never edit a recorded fingerprint.** A new rule is a new id, recorded
 * as a new entry; the old entries stay, so the table is the rules' history.
 *
 * The corpus is public-domain text from "Alice's Adventures in Wonderland"
 * (Lewis Carroll, 1865) and lines written for these tests with made-up
 * names, each exercising a case its rule's ADR names.
 *
 * The Opinion's citation basis (epic decision 25) reads a board, not a
 * text, so its corpus is the format-1 fixture's board (`board-v1.json`):
 * every item the Opinion could cite there, with its basis.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { splitLightboxParagraphs, LIGHTBOX_PARAGRAPH_RULE_ID } from '@/infrastructure/lightbox/LightboxParagraphs';
import { proseSentenceSpans, PROSE_SENTENCE_RULE_ID } from '@/tools/measure/passageProseStats';
import { findDialogueSpans, DIALOGUE_SPANS_RULE_ID } from '@/utils/dialogueSpans';
import { findBeingVerbs, BEING_VERBS_RULE_ID } from '@/tools/measure/beingVerbs';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';
import { lightboxOpinionItems } from '@shared/constants/lightboxOpinionItems';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';

/** Each case its rule's ADR names, and ordinary prose around them. */
const CORPUS: readonly string[] = [
  // Ordinary prose (Alice, Chapter I).
  'Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had ' +
    'peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” ' +
    'thought Alice “without pictures or conversations?”',
  'There was nothing so _very_ remarkable in that; nor did Alice think it so _very_ much out of the way to hear the Rabbit say to ' +
    'itself, “Oh dear! Oh dear! I shall be late!”',
  // Paragraphs: blank lines with spaces, CRLF, leading and trailing space, a heading.
  '# Chapter One\n\nThe hall was dark.\n \nIt was long.\r\n\r\n   Odile ran.   \n\n\n\nThe end.',
  // Sentences: closing marks, nested and interleaved; elisions; ellipses; Mr.; brackets.
  '“Oh dear!” “Wait.” ‘Stop.’ \'Stop.\' (See below.) [It was not.] “He said ‘Stop!’” ‘He said “Stop!”’',
  '“Did you say ‘What a pity!’?” said the Rabbit. Mr. Pell arrived... and left.',
  'He was goin’ home. ’Twas late. She was doin’! “Oh dear! ” she said. late.’Twas night. stopped."Wait," she said.',
  // Sentences: speech tags, lower and capital, bare enders, a line break and a paragraph break.
  '“Wait!” she cried. “Who are you?” said the Caterpillar. “I was thinking...” she trailed off. “I’m going.” she said, and went.',
  '“Wait.” She turned. “Wait!” Odile said. Wait! she cried. (See below.) then on. “Oh!\n” she said.',
  '“Do bats eat cats?” for, you see, she was dozing.\n\n“Hjckrrh!” from the Gryphon.',
  // Dialogue: straight and curly, mixed, unclosed, a stray closer, single quotes, guillemets.
  '"Hello," she said. “Hello," he said. “Still talking, and the paragraph ends',
  'A stray ” closer. ‘Single quotes’ are not speech. «Nor are these.» “Nested “inner” outer.”',
  'First paragraph opens “a quote that runs on\n\n“And the next one closes it.”',
  // Being verbs: whole forms, contractions and the next-word rule (decision 26), with made-up names.
  'I am. You are. He is. They were. It was. To be. Having been. Being there.',
  'I’m cold. I\'m warm. You’re late. We\'re here. They’re gone. It’s fine. She\'s tired. That’s all. There\'s more.',
  'Bram’s late. Everyone’s here. Odile\'s not coming. The kettle’s boiling. The Rabbit’s watch. Alice’s sister. Bram’s own.',
  'He’s been. She’s got it. He’s gotten taller. It’s had its day. I ain’t got none. I ain’t had a cup. It ain’t so.',
  'Isn’t it? Aren\'t they? Wasn’t she? Weren\'t we? ’Tis true. \'Twas brillig. ‘Twere so.',
  'Let’s go. She’d been. We’ll see. They’ve gone. Ma’am. M’m. How’s she? Where’s he? The Rabbit’s very white gloves.',
  '_was_ and *was* and would-be, was being, seemed, became.'
];

const RULES = [
  {
    name: 'paragraphs',
    id: LIGHTBOX_PARAGRAPH_RULE_ID,
    run: (text: string) => splitLightboxParagraphs(text).map((paragraph) => [paragraph.index, paragraph.start, paragraph.end])
  },
  {
    name: 'sentences',
    id: PROSE_SENTENCE_RULE_ID,
    run: (text: string) => proseSentenceSpans(text).map((span) => [span.start, span.end])
  },
  {
    name: 'dialogue',
    id: DIALOGUE_SPANS_RULE_ID,
    run: (text: string) => findDialogueSpans(text).map((span) => [span.start, span.end, span.closed])
  },
  {
    name: 'beingVerbs',
    id: BEING_VERBS_RULE_ID,
    run: (text: string) => findBeingVerbs(text).map((match) => [match.start, match.end])
  }
] as const;

/**
 * Every id each rule has had, and its output's fingerprint over the corpus
 * (SHA-256 of the outputs as JSON). Append; never edit.
 */
/* eslint-disable @typescript-eslint/naming-convention -- keyed by the rules' kebab-case ids. */
const RECORDED: Readonly<Record<(typeof RULES)[number]['name'], Readonly<Record<string, string>>>> = {
  paragraphs: { 'blank-line-2026-10-19': '546f0936c3bf9156aae377cd0e93c2659086819fa03ba98a2e4eb5534ce0be4d' },
  sentences: { 'closing-marks-speech-tags-2026-10-21': '90816d0ad7a4fcde38e35803cb755905efc58de0e677f178d04e7432b71e012d' },
  dialogue: { 'double-quotes-2026-10-19': 'dd8f2b9fdde2205901eadd40e172a21e6552cffc5c03ba719f6f4f7a7804ea13' },
  beingVerbs: { 'contractions-next-word-2026-10-21': '9f6ad8623ded1666a88c0c6bc0e781658f546cddd8ccdea07f3e7825dc135a51' }
};
/** Every id the Opinion's basis has had, and its bases' fingerprint over the fixture's board. Append; never edit. */
const RECORDED_BASIS: Readonly<Record<string, string>> = {
  'item-data-2026-10-22': '38afd67a4a1aa0fc6aedf0764adf42e67254c372108c6cd8b62261ba270624d7'
};
/* eslint-enable @typescript-eslint/naming-convention */

/** Every item the Opinion could cite on the format-1 fixture's board, with its basis. */
function fixtureBases(): string[][] {
  const decoded = decodeLightboxBoardFile(fs.readFileSync(path.resolve(__dirname, '../fixtures/board-v1.json'), 'utf8'));
  const held = decoded.kind === 'board' ? lightboxBoardOfFile(decoded.file) : undefined;
  if (held?.kind !== 'board') {
    throw new Error('board-v1.json does not read as a one-source board');
  }
  return lightboxOpinionItems(held.board).map((item) => [item.key, item.basis]);
}

function fingerprint(run: (text: string) => unknown): string {
  return createHash('sha256').update(JSON.stringify(CORPUS.map(run)), 'utf8').digest('hex');
}

describe('measurement rule ids (ADR 2026-10-19 D12 addendum)', () => {
  it.each(RULES.map((rule) => [rule.name, rule] as const))('%s: its output is the one recorded for its id', (_name, rule) => {
    expect({ rule: rule.name, id: rule.id, fingerprint: fingerprint(rule.run) })
      .toEqual({ rule: rule.name, id: rule.id, fingerprint: RECORDED[rule.name][rule.id] });
  });

  it('opinionBasis: its bases over the format-1 fixture are the ones recorded for its id', () => {
    const bases = fixtureBases();
    // The headline, the standout and steering figures, the Sections, and every reading tile.
    expect([bases.length, bases.filter(([key]) => !key.startsWith('lbt-')).length]).toEqual([82, 7]);
    expect({ id: LIGHTBOX_OPINION_BASIS_RULE_ID, fingerprint: createHash('sha256').update(JSON.stringify(bases), 'utf8').digest('hex') })
      .toEqual({ id: LIGHTBOX_OPINION_BASIS_RULE_ID, fingerprint: RECORDED_BASIS[LIGHTBOX_OPINION_BASIS_RULE_ID] });
    expect(LIGHTBOX_OPINION_BASIS_RULE_ID).toMatch(/^[a-z]+(?:-[a-z]+)*-\d{4}-\d{2}-\d{2}$/);
  });

  it('gives each rule an id of its own, in lower-case words and a date', () => {
    expect(RULES.map((rule) => rule.id)).toEqual([
      'blank-line-2026-10-19',
      'closing-marks-speech-tags-2026-10-21',
      'double-quotes-2026-10-19',
      'contractions-next-word-2026-10-21'
    ]);
    for (const rule of RULES) {
      expect(rule.id).toMatch(/^[a-z]+(?:-[a-z]+)*-\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('measures something on every line of the corpus, so a rule cannot pass on an empty output', () => {
    expect(RULES.map((rule) => [rule.name, CORPUS.filter((text) => (rule.run(text) as unknown[]).length > 0).length])).toEqual([
      ['paragraphs', CORPUS.length],
      ['sentences', CORPUS.length],
      ['dialogue', 11],
      ['beingVerbs', 15]
    ]);
  });
});
