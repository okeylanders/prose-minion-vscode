/**
 * The being-verb detector (Lightbox Slice 4B; contractions counted by the
 * writer's decision of 2026-10-21, epic decision 26): the one detector the
 * numbers tile, the writer's average, craft steering and the quote check
 * share, with its rule and its stated limits pinned. Lines are written for
 * these tests unless marked as Lewis Carroll's (public domain).
 */

import {
  BEING_VERB_ELIDED_FORMS,
  BEING_VERB_FORMS,
  BEING_VERB_HAS_WORDS,
  BEING_VERB_NEGATED_FORMS,
  findBeingVerbs,
  findBeingVerbsWith
} from '@/tools/measure/beingVerbs';
import { tagTextTokens, type TaggedToken } from '@/tools/measure/wordFrequency';

const forms = (text: string) => findBeingVerbs(text).map((match) => match.text);

describe('findBeingVerbs', () => {
  it('finds every whole-word form, in any case, with its offsets', () => {
    const text = 'I am here. It IS late; they Are gone, she was and they were. To be, having been, being.';
    const found = findBeingVerbs(text);
    expect(found.map((match) => match.text.toLowerCase())).toEqual(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
    for (const match of found) {
      expect(text.slice(match.start, match.end)).toBe(match.text);
    }
    expect(new Set(found.map((match) => match.text.toLowerCase()))).toEqual(new Set(BEING_VERB_FORMS));
  });

  it('counts no part of a longer word, an apostrophe joining a word too', () => {
    expect(findBeingVerbs('this island, aware, wasp, isolated, beings, beneath, Amen')).toEqual([]);
    // "am" inside "ma'am" and "being" inside "being's" are parts of words, not forms.
    expect(forms('Yes, ma\'am. Yes, ma’am. The being\'s soul.')).toEqual([]);
  });

  it('counts \'m after I and \'re after any word, straight or curly, spanning the contraction', () => {
    const text = 'I\'m late; you\'re here, we’re there, they’re gone, and I’m cold.';
    const found = findBeingVerbs(text);
    expect(found.map((match) => match.text)).toEqual(['\'m', '\'re', '’re', '’re', '’m']);
    for (const match of found) {
      expect(text.slice(match.start, match.end)).toBe(match.text);
    }
    expect(found[0]).toEqual({ start: 1, end: 3, text: '\'m' });
    // 'm stands for "am" only after I: "ma'm" and "M'm" are not contractions of it.
    expect(forms('Yes, ma\'m. M\'m, good.')).toEqual([]);
  });

  it('counts \'s as is where the tagger reads a verb, and never a possessive or let\'s', () => {
    expect(forms('It\'s cold. She’s tired. That\'s that. There’s a cat. Who\'s there?')).toEqual(['\'s', '’s', '\'s', '’s', '\'s']);
    expect(forms('The Rabbit\'s watch is gold. The Rabbit’s watch.')).toEqual(['is']);
    expect(forms('Let\'s go. Let’s see. LET\'S GO. let\'s not.')).toEqual([]);
    expect(findBeingVerbs('It’s cold.')).toEqual([{ start: 2, end: 4, text: '’s' }]);
  });

  it('reads \'s before been, got, gotten or had as has, looking past adverbs and emphasis marks', () => {
    expect([...BEING_VERB_HAS_WORDS]).toEqual(['been', 'got', 'gotten', 'had']);
    // Only the whole word "been" counts in these lines.
    expect(forms('He\'s been here. She\'s got it. He’s gotten tired.')).toEqual(['been']);
    expect(forms('He\'s never been there. She\'s always got time. It\'s just gotten worse.')).toEqual(['been']);
    expect(forms('He\'s *been* there.')).toEqual(['been']);
    // "had" too (the writer's addition): it's had is it has had.
    expect(forms('It\'s had its day. He’s already had enough. Tobin’s had tea.')).toEqual([]);
  });

  it('counts the ambiguous "he\'s gone" as is: the rule\'s known limit', () => {
    expect(forms('He\'s gone. Tobin’s gone.')).toEqual(['\'s', '’s']);
  });

  it('reads \'s after a name or noun by the next word, where the tagger reads a possessive', () => {
    // Is: before an adjective or a participle, an -ing word, an adverb or not, a preposition or to, a determiner.
    expect(forms('Tobin’s late. Everyone’s here. Tobin’s not coming. Tobin’s in the garden. Tobin’s to blame.'))
      .toEqual(['’s', '’s', '’s', '’s', '’s']);
    expect(forms('Ivy’s tired. Ivy’s very late. Dinah’s our cat. The door’s shut.')).toEqual(['’s', '’s', '’s', '’s']);
    // Stays a possessive: before a noun or name, before own, before adjectives a noun follows, before a pronoun.
    expect(forms('The Rabbit’s watch. Alice’s sister. The Queen’s croquet. The Hatter’s tea, Tobin’s Ivy.')).toEqual([]);
    expect(forms('Alice’s own sister. The Rabbit’s white gloves. Tobin’s tired eyes.')).toEqual([]);
    expect(forms('That one’s Tobin’s.')).toEqual([]);
  });

  it('pins the next-word rule\'s readings where English is ambiguous', () => {
    // An -ing word reads as is: "the dog is barking", not "the dog's barking" as a noun.
    expect(forms('The dog’s barking.')).toEqual(['’s']);
    expect(forms('Tobin’s sewing basket.')).toEqual(['’s']);
    // A pronoun next keeps a possessive: "how's she?" is not counted.
    expect(forms('How’s she? Where’s he?')).toEqual([]);
  });

  it('counts \'tis, \'twas and \'twere as one being verb each, straight or curly, spanning the word after the mark', () => {
    expect([...BEING_VERB_ELIDED_FORMS]).toEqual(['\'tis', '\'twas', '\'twere']);
    const text = '’Tis so. \'Twas late. ‘Twere better. Oh, \'tis true, ’twas so.';
    const found = findBeingVerbs(text);
    expect(found.map((match) => match.text)).toEqual(['Tis', 'Twas', 'Twere', 'tis', 'twas']);
    expect(found[0]).toEqual({ start: 1, end: 4, text: 'Tis' });
    // A mark after a letter, or a longer word, is no elided form; nor does "is" inside "'tis" count again.
    expect(forms('don\'tis, \'tisket, \'twill, \'twasn')).toEqual([]);
  });

  it('counts the negated forms as whole words, ain\'t too, except ain\'t as has not', () => {
    expect([...BEING_VERB_NEGATED_FORMS]).toEqual(['isn\'t', 'aren\'t', 'wasn\'t', 'weren\'t', 'ain\'t']);
    expect(forms('It isn\'t so, it wasn’t then, they aren\'t, we weren’t, and it ain\'t so.'))
      .toEqual(['isn\'t', 'wasn’t', 'aren\'t', 'weren’t', 'ain\'t']);
    expect(forms('I ain\'t got none. They ain’t gotten it. I ain\'t never been there.')).toEqual(['been']);
    expect(forms('I ain’t had none.')).toEqual([]);
  });

  it('never counts \'d, \'ll or \'ve', () => {
    expect(forms('She\'d go, we\'ll see, they\'ve left; she’d, we’ll, they’ve.')).toEqual([]);
    // "been" after 'd is a whole word.
    expect(forms('She’d been there.')).toEqual(['been']);
  });

  it('counts no \'s when the tagger cannot load, and reads ain\'t by the next word alone', () => {
    const missing = () => {
      throw new Error('no tagger');
    };
    expect(findBeingVerbsWith('It\'s cold, I\'m late, it isn\'t so.', missing).map((match) => match.text)).toEqual(['\'m', 'isn\'t']);
    expect(findBeingVerbsWith('I ain\'t got none. I ain\'t never been.', missing).map((match) => match.text)).toEqual(['ain\'t', 'been']);
  });

  it('tags a text only when it holds a \'s or an ain\'t to decide', () => {
    const calls: string[] = [];
    const tag = (text: string): TaggedToken[] => {
      calls.push(text);
      return tagTextTokens(text);
    };
    expect(findBeingVerbsWith('I’m late, you’re here, it isn’t so, she was there.', tag)).toHaveLength(4);
    expect(calls).toEqual([]);
    expect(findBeingVerbsWith('It’s late.', tag)).toHaveLength(1);
    // The tagger reads curly apostrophes straightened, at the same offsets.
    expect(calls).toEqual(['It\'s late.']);
  });

  it('finds the forms in public-domain lines', () => {
    // Lewis Carroll, "Alice's Adventures in Wonderland" (1865), ch. I.
    const line = 'Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her';
    expect(forms(line)).toEqual(['was']);
    // The same book, ch. VII, in Gutenberg's single quotes.
    expect(forms('\'There isn\'t any,\' said the March Hare.')).toEqual(['isn\'t']);
    expect(forms('\'I didn\'t know it was YOUR table,\' said Alice; \'it\'s laid for a great many more than three.\'')).toEqual(['was', '\'s']);
    expect(forms('\'Come, we shall have some fun now!\' thought Alice. \'I\'m glad they\'ve begun asking riddles.\'')).toEqual(['\'m']);
  });

  it('decides one large paragraph with one tagging, in work that grows with it', () => {
    let tagged = 0;
    const tag = (text: string): TaggedToken[] => {
      tagged += 1;
      return tagTextTokens(text);
    };
    const paragraph = Array.from({ length: 16_666 }, () => 'It’s cold, and he’s never been warm.').join(' ');
    const started = Date.now();
    const found = findBeingVerbsWith(paragraph, tag);
    expect(Date.now() - started).toBeLessThan(5_000);
    expect(tagged).toBe(1);
    // Each sentence: "It’s" (is) and "been"; "he’s never been" is has.
    expect(found).toHaveLength(33_332);
    expect(found.filter((match) => match.text === '’s')).toHaveLength(16_666);
  }, 60_000);
});
