/**
 * Where speech stands (ADR 2026-10-21; Slices 3b and 3c): double-quoted
 * dialogue by the shared rule, and single-quoted speech whole, joined so
 * they never overlap. Text adapts public-domain *Alice*.
 */
import { findSpeechSpans, findSpeechSpansOutsideProtected, singleQuotedSpans } from '@/utils/draftEdit/speechSpans';
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

  it('reads as the shared rule does where nothing is protected', () => {
    const text = '“Oh dear!” said the Rabbit. Then Alice said, \'How late it is!\' and ran.';
    expect(findSpeechSpansOutsideProtected(text, [])).toEqual(findSpeechSpans(text));
  });
});

