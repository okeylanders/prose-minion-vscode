/**
 * The being-verbs investigation (Slice 4F, default i): the writer saw being
 * verb readings withheld for quoting no instance and asked whether the board
 * counts one thing and checks another. It does not. The rate the numbers
 * show, the total craft steering shows and the quote check all run the one
 * detector (`findBeingVerbs`), so a quote is found holding an instance
 * exactly when the board counted one in it. What the readings quoted were
 * contractions and linking verbs, which the detector has never counted; the
 * prompt and task now say so. Each line below is written for this test, and
 * each expected count is literal.
 */
import { countLightboxFigures } from '@/infrastructure/lightbox/LightboxNumbers';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { verifyLightboxPatternInstance } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { measureLightboxSteering } from '@/infrastructure/lightbox/LightboxSteeringMeasure';

const counted = (line: string) => countLightboxFigures(line, [line]).patterns['being-verbs'];
const steered = (line: string) => measureLightboxSteering({ text: line, paragraphs: [line] }).figures[0].total;
const checked = (line: string, quote: string) => {
  const verdict = verifyLightboxPatternInstance(createLightboxQuoteVerifier([line]), 'being-verbs', 1, quote);
  return verdict.found ? 'found' : verdict.reason;
};

describe('being verbs: what the board counts is what a quote is checked for', () => {
  it.each([
    // Contractions hold no listed form as a whole word: not counted, so not an instance.
    ['contractions', 'She’s tired, I’m late, they’re gone, and it ain’t so.', 'She’s tired, I’m late', 0],
    ['negative contractions', 'It isn’t so, and it wasn’t then.', 'It isn’t so', 0],
    // Linking verbs other than "be" are not on the list.
    ['linking verbs', 'She seemed tired and became quiet.', 'She seemed tired', 0],
    // A form joined to an underscore is no whole word to the detector: a stated false negative.
    ['underscore emphasis', 'She _was_ there.', 'She _was_ there', 0],
    // "been" after a contraction is a whole word.
    ['been after a contraction', 'She’d been there before.', 'She’d been there', 1],
    ['was being', 'She was being watched.', 'She was being watched', 2],
    ['asterisk emphasis', 'She *was* there.', 'She *was* there', 1],
    // A hyphen ends a word, so a compound's "be" counts: a stated false positive.
    ['a hyphenated compound', 'A would-be hero stood there.', 'A would-be hero', 1]
  ])('%s: counted and checked alike', (_case, line, quote, expected) => {
    expect(counted(line)).toBe(expected);
    expect(steered(line)).toBe(expected);
    expect(checked(line, quote)).toBe(expected > 0 ? 'found' : 'no-instance');
  });
});
