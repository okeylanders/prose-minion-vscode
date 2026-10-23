/**
 * A board's default name (Lightbox Slice 5A.2; epic decision 41): what a
 * board the writer has not named is called when it is first saved, "<the
 * source's file name without its extension> - <M/D/YYYY h:mm AM/PM>", in the
 * zone given (the host's own in the extension). Pinned clocks and zones; the
 * result is always a name the one rule saves.
 */
import {
  LIGHTBOX_BOARD_NAME_CHARACTERS,
  isSavedLightboxBoardName,
  lightboxBoardSourceLabel,
  lightboxDefaultBoardName
} from '@shared/constants/lightboxBoardName';

const CHAPTER = { kind: 'file', displayPath: 'Drafts/Chapter 6.md' } as const;

describe('lightboxDefaultBoardName', () => {
  it('names the writer\'s example: the file\'s name and the local time, "Chapter 6 - 10/23/2026 9:08 AM"', () => {
    expect(lightboxDefaultBoardName(CHAPTER, Date.parse('2026-10-23T14:08:41.512Z'), 'America/Chicago')).toBe('Chapter 6 - 10/23/2026 9:08 AM');
  });

  it('tells the time in the zone it is given, by the day there', () => {
    const late = Date.parse('2026-10-24T03:30:00.000Z');
    expect(lightboxDefaultBoardName(CHAPTER, late, 'UTC')).toBe('Chapter 6 - 10/24/2026 3:30 AM');
    expect(lightboxDefaultBoardName(CHAPTER, late, 'America/Chicago')).toBe('Chapter 6 - 10/23/2026 10:30 PM');
    expect(lightboxDefaultBoardName(CHAPTER, late, 'Asia/Tokyo')).toBe('Chapter 6 - 10/24/2026 12:30 PM');
  });

  it('writes midnight and noon as 12, with no leading zeros and a plain space before AM or PM', () => {
    expect(lightboxDefaultBoardName(CHAPTER, Date.parse('2026-01-05T00:04:00.000Z'), 'UTC')).toBe('Chapter 6 - 1/5/2026 12:04 AM');
    expect(lightboxDefaultBoardName(CHAPTER, Date.parse('2026-01-05T12:00:00.000Z'), 'UTC')).toBe('Chapter 6 - 1/5/2026 12:00 PM');
    expect(lightboxDefaultBoardName(CHAPTER, new Date('2026-01-05T12:00:00.000Z'), 'UTC')).toBe('Chapter 6 - 1/5/2026 12:00 PM');
  });

  it('names a selection as the source panel does: its file\'s name and its lines', () => {
    const at = Date.parse('2026-10-23T14:08:00.000Z');
    expect(lightboxDefaultBoardName({ kind: 'selection', displayPath: 'Drafts/alice-1.md', startLine: 12, endLine: 40 }, at, 'UTC'))
      .toBe('alice-1 · lines 12–40 - 10/23/2026 2:08 PM');
    expect(lightboxBoardSourceLabel({ kind: 'selection', displayPath: 'alice-1.md', startLine: 7, endLine: 7 })).toBe('alice-1 · line 7');
    expect(lightboxBoardSourceLabel({ kind: 'selection', displayPath: 'alice-1.md' })).toBe('alice-1');
  });

  it('takes only the file\'s name: no folder, the last extension only, Windows separators too', () => {
    expect(lightboxBoardSourceLabel({ kind: 'file', displayPath: 'book/part one/alice-2.draft.md' })).toBe('alice-2.draft');
    expect(lightboxBoardSourceLabel({ kind: 'file', displayPath: 'book\\alice-3.txt' })).toBe('alice-3');
    expect(lightboxBoardSourceLabel({ kind: 'file', displayPath: 'README' })).toBe('README');
    expect(lightboxBoardSourceLabel({ kind: 'file', displayPath: '.hidden' })).toBe('.hidden');
  });

  it('is always one line, trimmed, within the limit: a control character becomes a space, an empty name "Untitled", a long one is cut', () => {
    const at = Date.parse('2026-10-23T14:08:00.000Z');
    const odd = lightboxDefaultBoardName({ kind: 'file', displayPath: 'Drafts/one\ttwo\nthree.md' }, at, 'UTC');
    expect(odd).toBe('one two three - 10/23/2026 2:08 PM');
    expect(lightboxDefaultBoardName({ kind: 'file', displayPath: '' }, at, 'UTC')).toBe('Untitled - 10/23/2026 2:08 PM');
    const long = lightboxDefaultBoardName({ kind: 'file', displayPath: `${'x'.repeat(300)}.md` }, at, 'UTC');
    expect(long).toHaveLength(LIGHTBOX_BOARD_NAME_CHARACTERS);
    expect(long.endsWith('… - 10/23/2026 2:08 PM')).toBe(true);
    for (const name of [odd, long, lightboxDefaultBoardName(CHAPTER, at)]) {
      expect(isSavedLightboxBoardName(name)).toBe(true);
    }
  });
});
