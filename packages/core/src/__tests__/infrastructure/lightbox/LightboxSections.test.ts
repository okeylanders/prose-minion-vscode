/**
 * The Sections lane's detector (ADR 2026-10-19 D4, D5; Slice 4C): code only,
 * from the paragraph model. Headings at the highest level that divides the
 * chapter, then scene breaks (`---` decided by the blank-line rule), then
 * chapter lines in digits, roman numerals or words; none found says so. The
 * paragraphs are synthetic lines and sentences from "Alice's Adventures in
 * Wonderland" (1865, public domain); one board is built from the worked
 * example by the production service, so every board measures its sections.
 */
import { detectLightboxSections } from '@/infrastructure/lightbox/LightboxSections';
import { splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';
import { lightboxSectionsNote } from '@hooks/domain/lightbox/lightboxPlot';
import { boardWithNumbers } from './lightboxCraftFixtures';
import { ALICE } from './lightboxPlotFixtures';

/* eslint-disable @typescript-eslint/naming-convention -- the Sections signals are kebab-case protocol literals. */

const PROSE = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
const sections = (text: string) => detectLightboxSections(splitLightboxParagraphs(text).map((paragraph) => paragraph.text));
const ranges = (text: string) => sections(text).sections.map((section) => [section.from, section.to, section.label]);

describe('the Sections detector (Slice 4C)', () => {
  it('uses the highest heading level that divides the chapter in two or more', () => {
    const text = ['# Chapter One', PROSE, '## The bank', PROSE, '## The well', PROSE, '### A shelf', PROSE].join('\n\n');
    const found = sections(text);
    // One h1 divides nothing; with the h2s it opens the first of three sections. The h3 is below the level used.
    expect(found).toMatchObject({ signal: 'headings', level: 2 });
    expect(ranges(text)).toEqual([[1, 2, 'Chapter One'], [3, 4, 'The bank'], [5, 8, 'The well']]);
    expect(found.fired.headings).toEqual([1, 3, 5, 7]);
    expect(found.sections[1].marker).toBe(3);
  });

  it('keeps text before the first heading as its own opening section, and reads closing hashes off', () => {
    const text = [PROSE, '## The bank ##', PROSE, '## The well', PROSE].join('\n\n');
    expect(ranges(text)).toEqual([[1, 1, 'Opening'], [2, 3, 'The bank'], [4, 5, 'The well']]);
  });

  it('reads setext headings, with = as level 1 and --- under a line of text as level 2', () => {
    const text = ['The bank\n========', PROSE, 'The well\n---', PROSE].join('\n\n');
    const found = sections(text);
    expect(found).toMatchObject({ signal: 'headings', level: 2 });
    expect(ranges(text)).toEqual([[1, 2, 'The bank'], [3, 4, 'The well']]);
    // A setext heading needs an underline of three: "Down\n--" is a line of prose to the board.
    expect(sections(['Down\n--', PROSE, 'Down\n--', PROSE].join('\n\n')).signal).toBe('none');
  });

  it('takes --- after a blank line as a scene break, and *** · * * * · # · § the same', () => {
    for (const mark of ['---', '***', '* * *', '#', '§', '___']) {
      const text = [PROSE, PROSE, mark, PROSE, mark, PROSE].join('\n\n');
      const found = sections(text);
      expect({ mark, signal: found.signal }).toEqual({ mark, signal: 'scene-breaks' });
      expect(ranges(text)).toEqual([[1, 2, 'Scene 1'], [3, 4, 'Scene 2'], [5, 6, 'Scene 3']]);
    }
  });

  it('opens nothing with a break that ends the chapter or follows another break', () => {
    const text = [PROSE, '***', '***', PROSE, PROSE, '***'].join('\n\n');
    const found = sections(text);
    expect(found.fired['scene-breaks']).toEqual([2, 3, 6]);
    expect(ranges(text)).toEqual([[1, 2, 'Scene 1'], [3, 6, 'Scene 2']]);
  });

  it('finds chapter lines in digits, roman numerals and words, alone or with a title after a separator', () => {
    const text = [
      'Chapter 12', PROSE, 'CHAPTER TWELVE', PROSE, 'Chapter XII.', PROSE, 'chapter twenty-one', PROSE,
      'Chapter One: The Well', PROSE, 'Chapter 3 — The Hall', PROSE
    ].join('\n\n');
    const found = sections(text);
    expect(found.signal).toBe('chapter-lines');
    expect(found.sections.map((section) => section.label)).toEqual([
      'Chapter 12', 'CHAPTER TWELVE', 'Chapter XII.', 'chapter twenty-one', 'Chapter One: The Well', 'Chapter 3 — The Hall'
    ]);
  });

  it('never takes a sentence that starts with "Chapter" for a chapter line', () => {
    const text = ['Chapter 12 was where it all went wrong.', PROSE, 'Chapter Mixed feelings, she thought.', PROSE].join('\n\n');
    expect(sections(text)).toMatchObject({ signal: 'none', fired: { 'chapter-lines': [] } });
  });

  it('tries headings first, then scene breaks, then chapter lines', () => {
    const all = ['# One', PROSE, '***', PROSE, '# Two', PROSE, 'Chapter 3', PROSE].join('\n\n');
    expect(sections(all).signal).toBe('headings');
    const breaks = ['Chapter 1', PROSE, '***', PROSE, 'Chapter 2', PROSE, '***', PROSE].join('\n\n');
    expect(sections(breaks).signal).toBe('scene-breaks');
    expect(sections(breaks).fired['chapter-lines']).toEqual([1, 5]);
  });

  it('reads a front-matter block as neither a heading nor a break', () => {
    const text = ['---\ntitle: Down the Rabbit-Hole\n---', PROSE, '---', PROSE].join('\n\n');
    const found = sections(text);
    expect(found.fired).toEqual({ headings: [], 'scene-breaks': [3], 'chapter-lines': [] });
    expect(found.signal).toBe('scene-breaks');
    expect(ranges(text)).toEqual([[1, 2, 'Scene 1'], [3, 4, 'Scene 2']]);
  });

  describe('leading front matter across paragraphs (PR #156 F-02)', () => {
    const NONE = { headings: [], 'scene-breaks': [], 'chapter-lines': [] };
    const OPEN = '---\ntitle: Chapter One';

    it('reads YAML with a blank line in it as metadata, never as a heading or a break, keeping every paragraph address', () => {
      const text = [OPEN, 'author: Alice\n---', 'The chapter begins.'].join('\n\n');
      expect(splitLightboxParagraphs(text).map((paragraph) => paragraph.text)).toEqual([OPEN, 'author: Alice\n---', 'The chapter begins.']);
      expect(sections(text)).toEqual({ signal: 'none', sections: [], fired: NONE });
      // The same block closed by `...`, and with a comment and a list inside.
      expect(sections([OPEN, '# a comment\ntags:\n  - fall\n  - rabbit', 'author: Alice\n...', PROSE].join('\n\n')).fired).toEqual(NONE);
    });

    it('reads prose directly after the closing delimiter as the chapter, not as a break', () => {
      expect(sections(['---\ntitle: Chapter One\n---\nThe chapter begins.', PROSE].join('\n\n')).fired).toEqual(NONE);
      expect(sections([OPEN, 'author: Alice\n---\nThe chapter begins.', PROSE].join('\n\n')).fired).toEqual(NONE);
    });

    it('finds the body\'s own headings after the metadata, in their own paragraphs or right after the delimiter', () => {
      const own = [OPEN, 'author: Alice\n---', '# The bank', PROSE, '# The well', PROSE].join('\n\n');
      expect(sections(own).fired.headings).toEqual([3, 5]);
      expect(ranges(own)).toEqual([[1, 2, 'Opening'], [3, 4, 'The bank'], [5, 6, 'The well']]);
      const after = [OPEN, 'author: Alice\n---\n# The bank', PROSE, '# The well', PROSE].join('\n\n');
      expect(ranges(after)).toEqual([[1, 1, 'Opening'], [2, 3, 'The bank'], [4, 5, 'The well']]);
    });

    it('keeps the body\'s scene breaks', () => {
      const text = [OPEN, 'author: Alice\n---', PROSE, '***', PROSE].join('\n\n');
      expect(sections(text).fired['scene-breaks']).toEqual([4]);
      expect(ranges(text)).toEqual([[1, 3, 'Scene 1'], [4, 5, 'Scene 2']]);
    });

    it('takes a chapter that opens with a break, or a block never closed, for prose and breaks as before (controls)', () => {
      expect(sections(['---', PROSE, '---', PROSE].join('\n\n')).fired['scene-breaks']).toEqual([1, 3]);
      expect(sections(['---\nShe ran down the lane.', PROSE, '---', PROSE].join('\n\n')).fired['scene-breaks']).toEqual([1, 3]);
      expect(sections([OPEN, PROSE, '***', PROSE].join('\n\n')).fired['scene-breaks']).toEqual([1, 3]);
    });

    it('measures no sections on a board whose chapter opens with such metadata', async () => {
      const board = await boardWithNumbers([OPEN, 'author: Alice\n---', ...ALICE.slice(1)]);
      expect(board.measured.sections).toEqual({ signal: 'none', sections: [], fired: NONE });
    });
  });

  it('takes `# # #` for a scene break, as manuscripts use it, never a heading of "#"', () => {
    const text = [PROSE, '# # #', PROSE, '# # #', PROSE].join('\n\n');
    expect(sections(text)).toMatchObject({ signal: 'scene-breaks', fired: { headings: [], 'scene-breaks': [2, 4] } });
    expect(sections(['# The bank', PROSE, '# # #', PROSE, '# The well', PROSE].join('\n\n')))
      .toMatchObject({ signal: 'headings', fired: { headings: [1, 5], 'scene-breaks': [3] } });
  });

  it('finds nothing in plain prose, and says so', () => {
    const found = sections([PROSE, PROSE, PROSE].join('\n\n'));
    expect(found).toEqual({ signal: 'none', sections: [], fired: { headings: [], 'scene-breaks': [], 'chapter-lines': [] } });
    expect(lightboxSectionsNote(found)).toBe('No headings, scene breaks or chapter lines found, so the ribbon stays in paragraphs.');
  });

  it('measures every board\'s sections: the worked example\'s one heading opens the chapter but divides nothing', async () => {
    const board = await boardWithNumbers(ALICE);
    expect(board.measured.sections).toEqual({
      signal: 'none',
      sections: [],
      fired: { headings: [1], 'scene-breaks': [], 'chapter-lines': [] }
    });
    expect(lightboxSectionsNote(board.measured.sections))
      .toBe('Found one heading (¶1), which does not divide the chapter into two or more sections, so the ribbon stays in paragraphs.');
    const divided = await boardWithNumbers([...ALICE.slice(0, 5), '***', ...ALICE.slice(5)]);
    expect(divided.measured.sections.signal).toBe('scene-breaks');
    expect(divided.measured.sections.sections.map((section) => [section.from, section.to])).toEqual([[1, 5], [6, 9]]);
  });
});
