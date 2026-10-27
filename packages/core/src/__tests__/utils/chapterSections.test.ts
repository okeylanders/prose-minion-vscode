/**
 * A chapter's sections, shared since Draft Edit Slice 3c part 4: the
 * blank-line paragraph rule, and where each section after the first begins,
 * as offsets into the text. The detector's own rules are pinned by the
 * Lightbox's `LightboxSections.test.ts`. Text adapts public-domain *Alice*.
 */
import { splitBlankLineParagraphs } from '@/utils/blankLineParagraphs';
import { chapterSectionStarts } from '@/utils/chapterSections';
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
});
