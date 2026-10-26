/**
 * The ribbon's focus line (Slice 4M): the item's title and the paragraphs it
 * touches, written as ranges and clipped to one line by CSS, then a tail that
 * never clips and always says how many paragraphs that is. The line used to
 * spell out 14 references and wrap onto a second row, which moved the board
 * under the pointer; these pin what it says, the ribbon test pins its shape.
 */
import {
  LIGHTBOX_FOCUS_IDLE,
  LIGHTBOX_FOCUS_NO_PARAGRAPH,
  LIGHTBOX_FOCUS_RANGES,
  lightboxFocusLine,
  lightboxParagraphRangeLabel,
  lightboxParagraphRanges
} from '@hooks/domain/lightbox/lightboxFocusLine';

const item = (paragraphs: number[], title = '“alice”') => ({ title, paragraphs });

describe('the ribbon\'s focus line', () => {
  it('says the idle hint, with no tail, while nothing is hovered or pinned', () => {
    expect(lightboxFocusLine(null)).toEqual({ text: LIGHTBOX_FOCUS_IDLE });
    expect(LIGHTBOX_FOCUS_IDLE).toBe('Hover anything on the board to light the paragraphs it touches.');
  });

  it('writes consecutive paragraphs as ranges, in the board\'s range form, and singletons alone', () => {
    expect(lightboxFocusLine(item([3, 4, 5, 6, 7, 12, 40, 41, 42, 43, 44]))).toEqual({
      text: '“alice” · ¶3–¶7 ¶12 ¶40–¶44',
      tail: '· 11 ¶'
    });
    expect(lightboxFocusLine(item([9]))).toEqual({ text: '“alice” · ¶9', tail: '· 1 ¶' });
    expect(lightboxFocusLine(item([1, 2]))).toEqual({ text: '“alice” · ¶1–¶2', tail: '· 2 ¶' });
  });

  it('counts each paragraph once, whatever order or repeats the item gives', () => {
    expect(lightboxParagraphRanges([7, 3, 4, 3, 5, 12, 6])).toEqual([{ from: 3, to: 7 }, { from: 12, to: 12 }]);
    expect(lightboxFocusLine(item([7, 3, 4, 3, 5, 12, 6])).tail).toBe('· 6 ¶');
  });

  it('says an item that stands in no single paragraph in its tail, which never clips', () => {
    expect(lightboxFocusLine(item([], 'Rhythm'))).toEqual({ text: 'Rhythm', tail: LIGHTBOX_FOCUS_NO_PARAGRAPH });
    expect(LIGHTBOX_FOCUS_NO_PARAGRAPH).toBe('· in no single paragraph');
  });

  it('keeps the DOM small: at most 60 ranges, then an ellipsis, with the whole count in the tail', () => {
    expect(LIGHTBOX_FOCUS_RANGES).toBe(60);
    // Every other paragraph of a 300-paragraph text: 150 ranges of one.
    const odd = Array.from({ length: 150 }, (_unused, index) => index * 2 + 1);
    const line = lightboxFocusLine(item(odd));
    const written = line.text.split(' · ')[1].split(' ');
    expect(written).toHaveLength(LIGHTBOX_FOCUS_RANGES + 1);
    expect(written.slice(0, 3)).toEqual(['¶1', '¶3', '¶5']);
    expect(written[LIGHTBOX_FOCUS_RANGES - 1]).toBe('¶119');
    expect(written[LIGHTBOX_FOCUS_RANGES]).toBe('…');
    expect(line.tail).toBe('· 150 ¶');
    // Exactly at the cap, nothing is left out, so no ellipsis.
    expect(lightboxFocusLine(item(odd.slice(0, LIGHTBOX_FOCUS_RANGES))).text.endsWith('¶119')).toBe(true);
  });

  it('writes a long run as one range however many paragraphs it holds, with thousands grouped', () => {
    const run = Array.from({ length: 1_204 }, (_unused, index) => index + 1);
    expect(lightboxFocusLine(item(run, 'Dialogue'))).toEqual({ text: 'Dialogue · ¶1–¶1,204', tail: '· 1,204 ¶' });
    expect(lightboxParagraphRangeLabel({ from: 1_000, to: 1_000 })).toBe('¶1,000');
  });
});
