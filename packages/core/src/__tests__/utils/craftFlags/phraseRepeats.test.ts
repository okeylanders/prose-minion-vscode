/**
 * How often a flagged phrase stands in the document's narration (ADR
 * 2026-10-21, Amendment 2026-10-26: Slice 3c). Text adapts public-domain
 * *Alice*.
 */
import { PHRASE_REPEATS, phraseRepeats } from '@/utils/craftFlags/phraseRepeats';

const range = (text: string, part: string, from = 0) => {
  const start = text.indexOf(part, from);
  return { start, end: start + part.length };
};

describe('phraseRepeats', () => {
  it('counts a phrase at word boundaries, case and runs of space folded', () => {
    const text = 'Time stood still. Then, at the well, time  stood\nstill again; but timestood still and time stood stillness did not count.';
    expect(phraseRepeats(text, []).count('time stood still')).toBe(2);
  });

  it('sets a phrase\'s own leading and trailing marks aside', () => {
    const text = 'And time stood still, as it had before: time stood still.';
    expect(phraseRepeats(text, []).count('time stood still.')).toBe(2);
    expect(phraseRepeats(text, []).count('  “time stood still,”')).toBe(2);
  });

  it('folds curly apostrophes and dashes', () => {
    const text = 'Her heart’s in her throat — and her heart\'s in her throat - again.';
    expect(phraseRepeats(text, []).count("her heart's in her throat")).toBe(2);
    expect(phraseRepeats(text, []).count('throat — and')).toBe(1);
  });

  it('leaves out an occurrence touching a skipped range: speech, protected regions', () => {
    const text = 'A chill ran down her spine. “A chill ran down her spine,” said the Rabbit. A chill ran down her spine.';
    const speech = range(text, '“A chill ran down her spine,”');
    expect(phraseRepeats(text, [speech]).count('a chill ran down her spine')).toBe(2);
    expect(phraseRepeats(text, []).count('a chill ran down her spine')).toBe(3);
  });

  it('counts occurrences that overlap (PR #177 N-03)', () => {
    expect(phraseRepeats('Never say never say never, said the Queen.', []).count('never say never')).toBe(2);
    expect(phraseRepeats('Alice, Alice, Alice!', []).count('alice, alice')).toBe(2);
  });

  it('counts inflected forms apart: the stated limit', () => {
    const text = 'A chill ran down her spine. A chill runs down his spine.';
    expect(phraseRepeats(text, []).count('a chill ran down her spine')).toBe(1);
  });

  it('counts nothing for a phrase with no word in it', () => {
    expect(phraseRepeats('Oh dear! Oh dear!', []).count(' —! ')).toBe(0);
  });

  it('reads a phrase\'s own marks as text, never as a pattern', () => {
    const text = 'She asked (as she always did) why. She asked (as she always did) why.';
    expect(phraseRepeats(text, []).count('asked (as she always did) why')).toBe(2);
    expect(phraseRepeats('A cat. A cot.', []).count('c.t')).toBe(0);
  });

  it('counts at most its bound of distinct phrases, and says nothing of the rest (PR #177 N-02)', () => {
    const words = Array.from({ length: PHRASE_REPEATS.phrases + 1 }, (_, index) => `word${String.fromCharCode(97 + (index % 26))}${index}`);
    const repeats = phraseRepeats(words.join(' '), []);
    const counts = words.map((word) => repeats.count(word));

    expect(counts.slice(0, PHRASE_REPEATS.phrases).every((count) => count === 1)).toBe(true);
    expect(counts[PHRASE_REPEATS.phrases]).toBeUndefined();
    expect(repeats.count(words[0].toUpperCase())).toBe(1);
  });

  it('answers the same phrase again from what it counted', () => {
    const repeats = phraseRepeats('Oh dear! Oh dear! I shall be late!', []);
    expect(repeats.count('Oh dear')).toBe(2);
    expect(repeats.count('OH DEAR!')).toBe(2);
  });
});
