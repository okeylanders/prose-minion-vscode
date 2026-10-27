/**
 * A chapter's sections, shared since Draft Edit Slice 3c part 4: the
 * blank-line paragraph rule, and where each section after the first begins,
 * as offsets into the text, with markers inside protected text left out
 * before the signal is chosen (PR #180 F-01), in work linear in the text and
 * its protected regions (N-02). The detector's own rules are pinned by the
 * Lightbox's `LightboxSections.test.ts`. Text adapts public-domain *Alice*.
 */
import type { TextRange } from '@/domain/models/DraftEdit';
import { splitBlankLineParagraphs } from '@/utils/blankLineParagraphs';
import { chapterSectionStarts, detectChapterSections } from '@/utils/chapterSections';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { splitLightboxParagraphs } from '@/infrastructure/lightbox/LightboxParagraphs';

const BANK = 'Alice was beginning to get very tired of sitting by her sister on the bank.';
const HOLE = 'Down, down, down. Would the fall never come to an end?';
const HALL = 'She found herself in a long, low hall.';

describe('splitBlankLineParagraphs', () => {
  it('splits on blank lines, trims each paragraph, and bounds it by offsets in the text as read', () => {
    const text = `  ${BANK}  \n \n${HOLE}\r\n\r\n\n${HALL}\n`;
    const paragraphs = splitBlankLineParagraphs(text);
    expect(paragraphs.map((paragraph) => paragraph.text)).toEqual([BANK, HOLE, HALL]);
    for (const paragraph of paragraphs) {
      expect(text.slice(paragraph.start, paragraph.end)).toBe(paragraph.text);
    }
    expect(splitBlankLineParagraphs(' \n\n \t\n')).toEqual([]);
  });

  it('is the Lightbox\'s paragraph rule, which numbers and counts the same paragraphs', () => {
    const text = `# Chapter One\n\n${BANK}\n \n${HOLE}\n\n\n\n${HALL}`;
    expect(splitLightboxParagraphs(text).map(({ text: body, start, end }) => ({ text: body, start, end })))
      .toEqual(splitBlankLineParagraphs(text));
  });
});

describe('chapterSectionStarts', () => {
  it('gives the offset of each section after the first, where its marker\'s paragraph begins', () => {
    const text = `${BANK}\n\n* * *\n\n${HOLE}\n\n* * *\n\n${HALL}`;
    expect(chapterSectionStarts(text)).toEqual([text.indexOf('* * *'), text.lastIndexOf('* * *')]);
  });

  it('reads headings first, as the detector does, and the text before the first marker as the opening', () => {
    const text = `${BANK}\n\n## The Pool of Tears\n\n${HOLE}\n\n* * *\n\n${HALL}`;
    expect(chapterSectionStarts(text)).toEqual([text.indexOf('## The Pool')]);
  });

  it('gives nothing when nothing divides the chapter', () => {
    expect(chapterSectionStarts(`${BANK}\n\n${HOLE}`)).toEqual([]);
    expect(chapterSectionStarts('')).toEqual([]);
  });

  it('leaves out a start inside an ignored range, such as code', () => {
    const text = `${BANK}\n\n* * *\n\n${HOLE}\n\n* * *\n\n${HALL}`;
    const second = text.lastIndexOf('* * *');
    expect(chapterSectionStarts(text, [{ start: second, end: second + 5 }])).toEqual([text.indexOf('* * *')]);
  });

  it('never lets a heading in code hide the scene break that divides the chapter (PR #180 F-01)', () => {
    const text = `${BANK}\n\n\`\`\`markdown\n\n# Fake chapter\n\n\`\`\`\n\n* * *\n\n${HALL}`;
    // Read raw, the heading wins, as the Lightbox reads a chapter.
    expect(chapterSectionStarts(text)).toEqual([text.indexOf('# Fake')]);
    expect(chapterSectionStarts(text, findProtectedRegions(text, 'markdown'))).toEqual([text.indexOf('* * *')]);
  });

  it('chooses the heading level from the headings outside code alone', () => {
    const text = [BANK, '```', '# Fake chapter', '```', '## The Pool of Tears', HOLE, '## A Caucus-Race', HALL].join('\n\n');
    expect(chapterSectionStarts(text)).toEqual([text.indexOf('# Fake')]);
    expect(chapterSectionStarts(text, findProtectedRegions(text, 'markdown')))
      .toEqual([text.indexOf('## The Pool'), text.indexOf('## A Caucus')]);
  });

  it('gives the line of a marker that follows front matter\'s closing line in its paragraph, which is outside the front matter', () => {
    const text = `---\ntitle: Alice\n\nauthor: Carroll\n---\n# Down the Rabbit-Hole\n${BANK}\n\n# The Pool of Tears\n\n${HOLE}`;
    const frontMatter = { start: 0, end: text.indexOf('---', 3) + 3 };
    expect(chapterSectionStarts(text, [frontMatter])).toEqual([text.indexOf('# Down'), text.indexOf('# The Pool')]);
  });

  it('leaves the detector as it was when nothing is ignored: paragraph numbers, signal and level unchanged', () => {
    const paragraphs = [BANK, '# Fake chapter', '## The Pool of Tears', HOLE, '* * *', HALL];
    expect(detectChapterSections(paragraphs, () => false)).toEqual(detectChapterSections(paragraphs));
    expect(detectChapterSections(paragraphs, (paragraph) => paragraph === 2)).toMatchObject({
      signal: 'headings',
      level: 2,
      sections: [{ from: 1, to: 2 }, { from: 3, to: 6, marker: 3 }],
      fired: { headings: [3], 'scene-breaks': [5] }
    });
  });

  it('reads the protected regions once over, however many headings hold code (N-02)', () => {
    const reads = (headings: number): number => {
      const text = Array.from({ length: headings }, (_, index) => `## The \`hall ${index}\`\n\n${HALL}`).join('\n\n');
      let count = 0;
      const counted = findProtectedRegions(text, 'markdown').map((range): TextRange => ({
        get start() { count += 1; return range.start; },
        get end() { count += 1; return range.end; }
      }));
      expect(chapterSectionStarts(text, counted)).toHaveLength(headings - 1);
      return count;
    };
    // Four times the headings, about four times the reads: a read per region per section would be sixteen.
    const [small, large] = [reads(500), reads(2000)];
    expect(large).toBeLessThanOrEqual(4 * small + 100);
    expect(large).toBeLessThanOrEqual(4 * 2000);
  });
});
