/**
 * Spark phrasing (ADR 2026-10-19 D7; Slice 4): offers as questions, never
 * instructions, never a number. The opener list is tuned on these fixtures:
 * every instruction below is caught, and every question passes. The
 * questions are about Lewis Carroll's "Alice's Adventures in Wonderland"
 * (1865, public domain) or written for these tests.
 */
import { readFileSync } from 'fs';
import * as path from 'path';
import {
  LIGHTBOX_SPARK_IMPERATIVE_OPENERS,
  LIGHTBOX_SPARK_PHRASING_REASONS,
  lightboxSparkPhrasingFault
} from '@/infrastructure/lightbox/LightboxSparkPhrasing';
import { PROMPT_ROOT } from './lightboxReadingFixtures';
import { LIGHTBOX_PROMPT_FILES } from '@/infrastructure/lightbox/LightboxReadingPrompts';

const R = LIGHTBOX_SPARK_PHRASING_REASONS;

/** Offers the lane must keep: questions, some set up by a sentence, none instructing. */
const QUESTIONS = [
  'What does the empty jar know that Alice does not?',
  'Who is waiting at the other end of the hole?',
  'The Rabbit is late, and the chapter never says for what. Who is waiting?',
  'Alice pictures how brave they will think her at home. Who is at home?',
  'What if the sister looked up from her book at the moment Alice ran?',
  'Why does the fall feel like leisure rather than danger?',
  'How long could a fall go on before it stopped being a fall?',
  'Is the well furnished for someone who was expected?',
  'Does the watch belong to the Rabbit, or to whoever it hurries toward?',
  'Could the shelves be the house she has left, seen from below?',
  'Would the marmalade have mattered if the jar had been full?',
  'Should the Rabbit ever speak to Alice directly, or only to itself?',
  'Have the pictures and conversations Alice wants been in the book all along?',
  'Where does the tunnel stop being a tunnel and start being a well?',
  'When the Rabbit says “Oh dear!”, who is it speaking to?',
  'Suppose the hole had been a door: what would she have done?',
  'What does ¶7 hold that ¶4 does not?',
  'Which of the things on the shelves does she stop to look at — and why those?',
  'One question the chapter leaves open: is anyone looking for her?',
  'What is the daisy-chain for, if she never makes it?',
  'Is the narrator’s “(Which was very likely true.)” on her side, or the reader’s?',
  'The hot day made her sleepy; how much of what follows is the afternoon’s doing?',
  'What does the chapter let her not think about?',
  '“Well!” she thinks. Is that relief, or the start of a boast?'
];

/** Instructions the lane must refuse, each for the rule named. */
const INSTRUCTIONS: Array<[string, string]> = [
  ['Add a line where Alice notices the cold?', R.instruction],
  ['Cut the sister: does the chapter need her?', R.instruction],
  ['Try opening on the fall itself?', R.instruction],
  ['Consider giving the Rabbit a second line?', R.instruction],
  ['Imagine the jar were full: what then?', R.instruction],
  ['Notice how the shelves repeat. What do they echo?', R.instruction],
  ['Make the fall frightening, then ask what she fears?', R.instruction],
  ['Show us the sister’s face as Alice leaves?', R.instruction],
  ['Let the Rabbit look back once?', R.instruction],
  ['Why not end the chapter at the bottom of the well?', R.instruction],
  ['How about a sound as she lands?', R.instruction],
  ['Don’t explain the watch. Why would it need explaining?', R.instruction],
  ['The jar is empty. Give it a label that lies?', R.instruction],
  ['What waits below; write it as a room?', R.instruction],
  ['Who is she falling toward — think about the Rabbit?', R.instruction],
  ['“Look at the shelves again”: what is on them?', R.instruction],
  ['What does the Rabbit want? You should decide before the next chapter?', R.directive],
  ['Is the fall too long? Make sure the reader knows?', R.instruction],
  ['What if the sister follows? You need to set it up?', R.directive],
  ['The jar is empty.', R.notQuestion],
  ['Write the moment she lands.', R.notQuestion],
  ['Light has as many words as darkness, 8 and 8. What happens if light comes down?', R.number],
  ['She falls for 3 paragraphs: is that long?', R.number]
];

describe('Spark phrasing', () => {
  it.each(QUESTIONS.map((question) => [question]))('keeps the offer %s', (question) => {
    expect(lightboxSparkPhrasingFault(question)).toBeUndefined();
  });

  it.each(INSTRUCTIONS)('refuses %s', (spark, reason) => {
    expect(lightboxSparkPhrasingFault(spark)).toBe(reason);
  });

  it('allows a ¶ address, the only number a spark may hold', () => {
    expect(lightboxSparkPhrasingFault('What does ¶12 share with ¶ 4?')).toBeUndefined();
    expect(lightboxSparkPhrasingFault('What does ¶12 share with 4 others?')).toBe(R.number);
  });

  it('ends as a question even inside closing quotes or brackets', () => {
    expect(lightboxSparkPhrasingFault('Who asks “what is the use of a book?”')).toBeUndefined();
    expect(lightboxSparkPhrasingFault('(Who is it late for?)')).toBeUndefined();
  });

  it('does not mistake a word inside another for a directive', () => {
    expect(lightboxSparkPhrasingFault('Would anyone who knew her be surprised to find her gone?')).toBeUndefined();
  });

  it('names in its prompt only openers the rule refuses, so the prompt and the rule cannot drift', () => {
    const prompt = readFileSync(path.join(PROMPT_ROOT, LIGHTBOX_PROMPT_FILES.lenses.spark), 'utf8');
    const line = prompt.split('\n').find((candidate) => candidate.includes('never open a sentence or a clause with an instruction')) ?? '';
    const named = [...line.matchAll(/"([^"]+)"/g)].map((match) => match[1].toLocaleLowerCase('en-US'));
    const openers = named.filter((phrase) => !phrase.startsWith('you ') && phrase !== 'make sure');
    expect(openers.length).toBeGreaterThan(5);
    for (const opener of openers) {
      expect(LIGHTBOX_SPARK_IMPERATIVE_OPENERS).toContain(opener);
    }
  });
});
