/**
 * Proofread reply fixtures: model replies about the public-domain passages
 * in `proofreadFixtures` (Lewis Carroll, 1865). Never manuscript text.
 */
import {
  PROOFREAD_CLOSING_SENTINEL,
  PROOFREAD_OPENING_SENTINEL
} from '@services/proofread/ProofreadResponseFrame';

export const WEATHER_ISSUE = {
  category: 'homophone',
  original: 'weather',
  before: 'very sleepy and stupid),',
  after: 'the pleasure of making',
  replacement: 'whether',
  explanation: '“Weather” is the climate; the conjunction is “whether”.'
};

export const RUNS_ISSUE = {
  category: 'tense',
  original: 'runs',
  before: 'White Rabbit with pink eyes',
  after: 'close by her.',
  replacement: 'ran',
  explanation: 'The narration is past tense.'
};

export const THE_THE_ISSUE = {
  category: 'spelling',
  original: 'the the',
  before: 'so very much out of',
  after: 'way to hear the',
  replacement: 'the',
  explanation: 'The word “the” is doubled.'
};

/** A framed reply around a JSON body. */
export const frameOf = (body: unknown) =>
  `${PROOFREAD_OPENING_SENTINEL}\n${typeof body === 'string' ? body : JSON.stringify(body)}\n${PROOFREAD_CLOSING_SENTINEL}`;

export const replyOf = (...issues: unknown[]) => frameOf({ version: 1, issues });
