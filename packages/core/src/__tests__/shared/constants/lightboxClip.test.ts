/**
 * Clipping at a surface (Slice 4H): a text longer than its bound keeps its
 * start and an ellipsis, at a word boundary when one is near, and is never
 * longer than the bound.
 */
import { LIGHTBOX_ELLIPSIS, clipLightboxText } from '@shared/constants/lightboxClip';

describe('clipLightboxText', () => {
  it('leaves a text that fits as it is', () => {
    expect(clipLightboxText('Down the rabbit-hole', 20)).toBe('Down the rabbit-hole');
    expect(clipLightboxText('', 5)).toBe('');
  });

  it('cuts at the word boundary nearest the bound, then adds an ellipsis', () => {
    expect(clipLightboxText('Alice was beginning to get very tired of sitting by her sister', 30)).toBe('Alice was beginning to get…');
  });

  it('cuts inside a word only when no boundary is near, and never past the bound', () => {
    const clipped = clipLightboxText('Antidisestablishmentarianism and more', 12);
    expect(clipped).toBe('Antidisesta…');
    expect(clipped).toHaveLength(12);
  });

  it('keeps a word whole when the bound falls just after it', () => {
    expect(clipLightboxText('a very deep well indeed', 12)).toBe('a very deep…');
  });

  it('never leaves half of a surrogate pair', () => {
    const clipped = clipLightboxText(`${'a'.repeat(9)}\u{1F407}rabbit`, 11);
    expect(clipped).toBe(`${'a'.repeat(9)}${LIGHTBOX_ELLIPSIS}`);
  });

  it('drops the space before the ellipsis', () => {
    expect(clipLightboxText('one two three four', 9)).toBe('one two…');
  });
});
