/**
 * Where speech stands (ADR 2026-10-21; Slices 3b and 3c): double-quoted
 * dialogue by the shared rule, and single-quoted speech whole, joined so
 * they never overlap. Text adapts public-domain *Alice*.
 */
import { findSpeechSpans, singleQuotedSpans } from '@/utils/draftEdit/speechSpans';

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
