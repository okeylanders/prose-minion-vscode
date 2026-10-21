/**
 * The being-verb detector (Lightbox Slice 4B): the one detector the
 * numbers tile adds, with its stated limits pinned.
 */

import { BEING_VERB_FORMS, findBeingVerbs } from '@/tools/measure/beingVerbs';

describe('findBeingVerbs', () => {
  it('finds every form as a whole word, in any case, with its offsets', () => {
    const text = 'I am here. It IS late; they Are gone, she was and they were. To be, having been, being.';
    const found = findBeingVerbs(text);
    expect(found.map((match) => match.text.toLowerCase())).toEqual(['am', 'is', 'are', 'was', 'were', 'be', 'been', 'being']);
    for (const match of found) {
      expect(text.slice(match.start, match.end)).toBe(match.text);
    }
    expect(new Set(found.map((match) => match.text.toLowerCase()))).toEqual(new Set(BEING_VERB_FORMS));
  });

  it('counts no part of a longer word', () => {
    expect(findBeingVerbs('this island, aware, wasp, isolated, beings, beneath, Amen')).toEqual([]);
  });

  it('does not count contractions (the stated limit)', () => {
    expect(findBeingVerbs("she's, I'm, they're, isn't, wasn't, aren't, it’s")).toEqual([]);
  });

  it('finds the forms in a public-domain line', () => {
    // Lewis Carroll, "Alice's Adventures in Wonderland" (1865), ch. I.
    const line = 'Either the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her';
    expect(findBeingVerbs(line).map((match) => match.text)).toEqual(['was']);
  });
});
