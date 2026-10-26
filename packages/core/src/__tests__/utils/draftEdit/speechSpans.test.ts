/**
 * Where speech stands (ADR 2026-10-21; Slices 3b and 3c): double-quoted
 * dialogue by the shared rule, and single-quoted speech whole, joined so
 * they never overlap. Text adapts public-domain *Alice*.
 */
import { findSpeechSpans, findSpeechSpansOutsideProtected, singleQuotedSpans } from '@/utils/draftEdit/speechSpans';
import type { TextRange } from '@/domain/models/DraftEdit';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';

const spoken = (text: string) => findSpeechSpans(text).map(({ start, end }) => text.slice(start, end));

describe('findSpeechSpans', () => {
  it('finds double- and single-quoted speech, in order', () => {
    const text = '“Oh dear!” said the Rabbit. Then Alice said, \'How late it is!\' and ran.';
    expect(spoken(text)).toEqual(['“Oh dear!”', '\'How late it is!\'']);
  });

  it('joins a single-quoted line inside double-quoted speech into one span, so spans never overlap', () => {
    const text = '“She said, ‘I shall be late!’ and ran,” Alice told her sister. The bank was warm.';
    expect(spoken(text)).toEqual(['“She said, ‘I shall be late!’ and ran,”']);
    const spans = findSpeechSpans(text);
    spans.slice(1).forEach((span, index) => expect(span.start).toBeGreaterThan(spans[index].end));
  });

  it('keeps a possessive or an elision inside single-quoted speech from ending it (PR #174 F-01)', () => {
    const text = '‘The sisters’ bank is warm,’ said Alice. The Rabbit ran on.';
    expect(singleQuotedSpans(text).map(({ start, end }) => text.slice(start, end))).toEqual(['‘The sisters’ bank is warm,’']);
  });

  it('finds no speech in plain narration, apostrophes and all', () => {
    expect(findSpeechSpans('Alice didn’t think it so very remarkable.')).toEqual([]);
  });
});

describe('findSpeechSpansOutsideProtected (PR #177 F-03)', () => {
  const spoken = (text: string) => findSpeechSpansOutsideProtected(text, findProtectedRegions(text, 'markdown')).map(({ start, end }) => text.slice(start, end));

  it('never lets a quotation mark inside protected syntax open or close speech', () => {
    const text = '“She typed `"` and time stood still,” said Alice. The bank was warm.';
    expect(findSpeechSpans(text).map(({ start, end }) => text.slice(start, end))).not.toEqual(['“She typed `"` and time stood still,”']);
    expect(spoken(text)).toEqual(['“She typed `"` and time stood still,”']);
    expect(spoken('She typed `"` and time stood still. Then she left.')).toEqual([]);
  });

  it('keeps the text\'s own offsets, and its paragraphs, across a fence', () => {
    const text = '```\n"code\n\nstill code"\n```\n\n“Oh dear!” said the Rabbit.';
    const [span] = findSpeechSpansOutsideProtected(text, findProtectedRegions(text, 'markdown'));
    expect(text.slice(span.start, span.end)).toBe('“Oh dear!”');
  });

  // The re-review's case: markup right before a single opener read as a letter hid the speech.
  it.each([
    ['a tag, curly', '<em>‘time stood still,’</em> said Alice.'],
    ['a tag, straight', "<em>'time stood still,'</em> said Alice."],
    ['nested tags with attributes', '<span class="aside"><em>‘time stood still,’</em></span> said Alice.'],
    ['a comment', '<!--note-->‘time stood still,’ said Alice.'],
    ['inline code', '`x`‘time stood still,’ said Alice.'],
    ['a tag in a list item', '- <em>‘time stood still,’</em> said Alice.'],
    ['a comment in a block quote', '> <!--note-->‘time stood still,’ said Alice.'],
    ['a comment after the closing mark', '‘time stood still,’<!--note--> said Alice.']
  ])('reads single-quoted speech beside %s as it reads it without the markup', (_case, text) => {
    expect(spoken(text)).toEqual([text.match(/[‘'][^’']+[’']/u)?.[0]]);
  });

  it('closes speech before markup by the prose before it, and leaves a word\'s mark beside markup a mark', () => {
    expect(spoken('‘Late,</em>’ said Alice. Then she left.')).toEqual(['‘Late,</em>’']);
    expect(spoken('Ali<b>ce</b>’s watch stopped, and time stood still.')).toEqual([]);
  });

  it('reads the regions it is given as one where they touch, and never looks past a paragraph for a neighbour', () => {
    const spokenWith = (text: string, regions: TextRange[]) => findSpeechSpansOutsideProtected(text, regions).map(({ start, end }) => text.slice(start, end));
    const regionOf = (text: string, part: string) => ({ start: text.indexOf(part), end: text.indexOf(part) + part.length });
    const tagged = '<em><b>‘Late,’</b></em> said Alice.';
    expect(spokenWith(tagged, ['<em>', '<b>', '</b>', '</em>'].map((part) => regionOf(tagged, part)))).toEqual(['‘Late,’']);
    // A region holding a paragraph break: the opener starts its paragraph's prose, whatever ends the one before.
    const crossing = 'Alice<x>\n\n</x>‘Late,’ said she.';
    expect(spokenWith(crossing, [regionOf(crossing, '<x>\n\n</x>')])).toEqual(['‘Late,’']);
  });

  it('keeps the paragraphs the raw text has, white space inside protected syntax and all', () => {
    // The fence's blank line holds spaces: the raw text breaks the paragraph there, so the open speech ends there.
    const text = '‘Late, said Alice\n```\nx\n   \ny\n```\nand on.';
    const [span] = findSpeechSpansOutsideProtected(text, findProtectedRegions(text, 'markdown'));
    expect(span).toEqual({ start: 0, end: text.indexOf('\n   \n') });
  });

  it('reads as the shared rule does where nothing is protected', () => {
    const text = '“Oh dear!” said the Rabbit. Then Alice said, \'How late it is!\' and ran.';
    expect(findSpeechSpansOutsideProtected(text, [])).toEqual(findSpeechSpans(text));
  });
});
