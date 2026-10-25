/**
 * Being verbs: what the board counts is what a quote is checked for. The
 * rate the numbers show (`countLightboxFigures`), the total craft steering
 * shows (`measureLightboxSteering`) and the quote check
 * (`verifyLightboxPatternInstance`) all run the one detector
 * (`findBeingVerbs`), so a quote is found holding an instance exactly when
 * the board counted one in it.
 *
 * Slice 4F found the writer's withheld readings had quoted contractions,
 * which the detector then never counted. The writer decided to count them
 * (epic decision 26): 'm and 're always; 's when the tagger reads a verb, or
 * reads a possessive that the next word makes is, and it is not has (been,
 * got, gotten, had); the negated forms, ain't too (except as has not);
 * 'tis, 'twas and 'twere; never 'd, 'll or 've. Every line below is written
 * for this test, with made-up names, unless marked as Lewis Carroll's
 * (public domain), and each expected count is literal.
 */
import { countLightboxFigures } from '@/infrastructure/lightbox/LightboxNumbers';
import { createLightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { verifyLightboxPatternInstance } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { measureLightboxSteering } from '@/infrastructure/lightbox/LightboxSteeringMeasure';
import { findBeingVerbs } from '@/tools/measure/beingVerbs';
import { boardWithNumbers } from './lightboxCraftFixtures';

const counted = (line: string) => countLightboxFigures(line, [line]).patterns['being-verbs'];
const steered = (line: string) => measureLightboxSteering({ text: line, paragraphs: [line] }).figures[0].total;
const checked = (line: string, quote: string) => {
  const verdict = verifyLightboxPatternInstance(createLightboxQuoteVerifier([line]), 'being-verbs', 1, quote);
  return verdict.found ? 'found' : verdict.reason;
};

describe('being verbs: what the board counts is what a quote is checked for', () => {
  it.each([
    // Counted since epic decision 26: 'm after I, 're, straight or curly.
    ['I\'m', 'I\'m late, said the clock.', 'I\'m late', ['\'m']],
    ['I’m, curly', 'I’m late, said the clock.', 'I’m late', ['’m']],
    ['you’re', 'You’re late again.', 'You’re late', ['’re']],
    ['we\'re', 'We\'re ready now.', 'We\'re ready', ['\'re']],
    ['they’re', 'They’re gone already.', 'They’re gone', ['’re']],
    // 's as is, where the tagger reads a verb.
    ['it’s', 'It’s far too late.', 'It’s far too late', ['’s']],
    ['she\'s', 'She\'s tired tonight.', 'She\'s tired', ['\'s']],
    ['that’s', 'That’s the trouble.', 'That’s the trouble', ['’s']],
    ['there\'s', 'There\'s a cat outside.', 'There\'s a cat', ['\'s']],
    // The negated forms: a whole-word pattern never matched these ("was" runs on into "n").
    ['isn’t', 'It isn’t so, she said.', 'It isn’t so', ['isn’t']],
    ['aren\'t', 'They aren\'t here yet.', 'They aren\'t here', ['aren\'t']],
    ['wasn’t', 'It wasn’t then, she said.', 'It wasn’t then', ['wasn’t']],
    ['weren\'t', 'We weren\'t there at all.', 'We weren\'t there', ['weren\'t']],
    ['ain’t', 'It ain’t so, said the cook.', 'It ain’t so', ['ain’t']],
    // The rule's stated limit: "he's gone" may mean has gone, and counts as is.
    ['he’s gone (the known limit)', 'He’s gone to the garden.', 'He’s gone to the garden', ['’s']],
    // The next-word rule (the writer's addition): after a name or noun the tagger reads as a possessive.
    ['Tobin’s late', 'Tobin’s late again, said Ivy.', 'Tobin’s late again', ['’s']],
    ['everyone’s here', 'Everyone’s here at last.', 'Everyone’s here at last', ['’s']],
    ['Ivy’s not coming', 'Ivy\'s not coming today.', 'Ivy\'s not coming', ['\'s']],
    ['the Hatter’s in the garden', 'The Hatter’s in the garden.', 'The Hatter’s in the garden', ['’s']],
    // The ambiguity, pinned: an -ing word reads as is (the dog is barking).
    ['the dog’s barking (pinned as is)', 'The dog’s barking again.', 'The dog’s barking again', ['’s']],
    // 'tis, 'twas and 'twere (the writer's addition), one being verb each.
    ['’tis', '’Tis so, said the cook.', '’Tis so, said the cook', ['Tis']],
    ['\'twas', '\'Twas late when Ivy came.', '\'Twas late when Ivy came', ['Twas']],
    ['’twere', 'Better ’twere done quickly.', 'Better ’twere done', ['twere']],
    // Controls: none of these is an instance of be.
    ['a possessive', 'The Rabbit’s watch ticked on.', 'The Rabbit’s watch', []],
    ['a possessive, straight', 'The Rabbit\'s watch ticked on.', 'The Rabbit\'s watch', []],
    ['let’s', 'Let’s go home now.', 'Let’s go home', []],
    ['she’s got (has)', 'She’s got the key.', 'She’s got the key', []],
    ['it’s had (has, the writer\'s addition)', 'It’s had its day, Ivy said.', 'It’s had its day', []],
    ['ain’t had (has not)', 'I ain’t had the key.', 'ain’t had the key', []],
    ['Alice’s sister (a possessive before a noun)', 'Alice’s sister read on.', 'Alice’s sister read on', []],
    ['the Queen’s croquet (a possessive before a noun)', 'The Queen’s croquet went on.', 'The Queen’s croquet went on', []],
    ['the Rabbit’s white gloves (adjectives before a noun)', 'The Rabbit’s white gloves fell.', 'The Rabbit’s white gloves fell', []],
    ['Alice’s own (a possessive before own)', 'Alice’s own sister read on.', 'Alice’s own sister read on', []],
    ['he’s gotten (has)', 'He’s gotten quite tall.', 'He’s gotten quite tall', []],
    ['ain’t got (has not)', 'I ain’t got the key.', 'ain’t got the key', []],
    ['she’d', 'She’d go if asked.', 'She’d go if asked', []],
    ['we’ll', 'We’ll see the garden.', 'We’ll see the garden', []],
    ['they’ve', 'They’ve left the hall.', 'They’ve left the hall', []],
    ['ma’am', 'Yes, ma’am, quite so.', 'Yes, ma’am, quite so', []],
    ['a linking verb', 'She seemed tired and became quiet.', 'She seemed tired', []],
    // A form joined to an underscore is no whole word to the detector: a stated false negative.
    ['underscore emphasis', 'She _was_ there.', 'She _was_ there', []],
    // "he's been": the 's is has, and the whole word "been" is the one instance.
    ['he’s been', 'He’s been here before.', 'He’s been here', ['been']],
    ['he’s never been', 'He’s never been here.', 'He’s never been here', ['been']],
    ['been after she’d', 'She’d been there before.', 'She’d been there', ['been']],
    ['was being', 'She was being watched.', 'She was being watched', ['was', 'being']],
    ['asterisk emphasis', 'She *was* there.', 'She *was* there', ['was']],
    // A hyphen ends a word, so a compound's "be" counts: a stated false positive.
    ['a hyphenated compound', 'A would-be hero stood there.', 'A would-be hero', ['be']]
  ])('%s: counted and checked alike', (_case, line, quote, forms) => {
    expect(findBeingVerbs(line).map((match) => match.text)).toEqual(forms);
    expect(counted(line)).toBe(forms.length);
    expect(steered(line)).toBe(forms.length);
    expect(checked(line, quote)).toBe(forms.length > 0 ? 'found' : 'no-instance');
  });

  it('agrees paragraph by paragraph on public-domain dialogue', () => {
    // Lewis Carroll, "Alice's Adventures in Wonderland" (1865), ch. VII, dialogue set in curly double quotes.
    const paragraphs = [
      '“There isn’t any,” said the March Hare.',
      '“Then it wasn’t very civil of you to offer it,” said Alice angrily.',
      '“I didn’t know it was YOUR table,” said Alice; “it’s laid for a great many more than three.”',
      '“Come, we shall have some fun now!” thought Alice. “I’m glad they’ve begun asking riddles.”'
    ];
    const text = paragraphs.join('\n\n');
    expect(paragraphs.map((paragraph) => findBeingVerbs(paragraph).map((match) => match.text))).toEqual([
      ['isn’t'], ['wasn’t'], ['was', '’s'], ['’m']
    ]);
    expect(countLightboxFigures(text, paragraphs).patterns['being-verbs']).toBe(5);
    const steering = measureLightboxSteering({ text, paragraphs }).figures[0];
    expect([steering.total, steering.narration, steering.dialogue]).toEqual([5, 0, 5]);
    const verifier = createLightboxQuoteVerifier(paragraphs);
    expect([
      verifyLightboxPatternInstance(verifier, 'being-verbs', 1, 'There isn’t any').found,
      verifyLightboxPatternInstance(verifier, 'being-verbs', 3, 'it’s laid for a great many').found,
      verifyLightboxPatternInstance(verifier, 'being-verbs', 4, 'I’m glad they’ve begun').found,
      verifyLightboxPatternInstance(verifier, 'being-verbs', 4, 'we shall have some fun').found
    ]).toEqual([true, true, true, false]);
  });

  it('gives the numbers row and craft steering the same count on a board, contractions among its words', async () => {
    const paragraphs = [
      '“There isn’t any,” said the March Hare.',
      '“Then it wasn’t very civil of you to offer it,” said Alice angrily.',
      '“I didn’t know it was YOUR table,” said Alice; “it’s laid for a great many more than three.”',
      '“Come, we shall have some fun now!” thought Alice. “I’m glad they’ve begun asking riddles.”'
    ];
    const board = await boardWithNumbers(paragraphs);
    const row = board.measured.numbers.rows.find((candidate) => candidate.stat === 'being-verbs');
    const steering = board.measured.steering.figures[0];
    expect([row?.instances, row?.paragraphs, row?.top]).toEqual([5, [1, 2, 3, 4], [
      { term: '’m', count: 1 }, { term: '’s', count: 1 }, { term: 'isn’t', count: 1 }
    ]]);
    expect([steering.total, steering.rate, steering.paragraphs]).toEqual([row?.instances, row?.value, row?.paragraphs]);
  });
});
