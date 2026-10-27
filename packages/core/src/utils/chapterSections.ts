/**
 * A chapter's sections (ADR 2026-10-19 D4, D5; Slice 4C): the Lightbox's
 * Sections lane, and, since Draft Edit Slice 3c part 4, the breaks Craft
 * Flags' continuity never pairs across. Moved here from the Lightbox's
 * infrastructure unchanged, so Draft Edit takes no Lightbox infrastructure.
 * Pure: no host, no I/O, no model. It reads a chapter's blank-line
 * paragraphs (`splitBlankLineParagraphs`, each trimmed) and finds the
 * chapter's own structure, in this order; the first signal that divides the
 * chapter into two or more sections wins:
 *
 * 1. **Headings.** A paragraph that opens with a Markdown heading:
 *    - ATX: one to six `#`, a space, and text (`## The hall`), with up to
 *      three spaces before and an optional closing run of `#`;
 *    - setext: one or more lines of text directly followed, in the same
 *      paragraph, by an underline of three or more `=` (level 1) or `-`
 *      (level 2).
 *    The level used is the highest (fewest `#`) at which the headings of that
 *    level or above open two or more sections.
 * 2. **Scene breaks.** A paragraph whose first line is a break alone: three
 *    or more `*`, `-` or `_` (spaces between allowed: `***`, `* * *`,
 *    `---`), a lone `§`, or `#` alone or repeated with spaces between
 *    (`#`, `# # #`: a manuscript's break, taken before the ATX rule would
 *    read it as a heading of `#`). `---` is decided by the blank-line rule:
 *    after a blank line (the first line of its paragraph) it is a break;
 *    directly under a line of text (in the same paragraph) it is a setext
 *    underline. A break that is the last paragraph, or is followed directly
 *    by another break, opens nothing.
 * 3. **Chapter lines.** A paragraph whose first line is a chapter line:
 *    "Chapter" (any case) and a number in digits, roman numerals or words up
 *    to ninety-nine ("Chapter 12", "CHAPTER TWELVE", "Chapter XII",
 *    "chapter twenty-one"), alone or followed by a title after `.`, `:` or a
 *    spaced dash ("Chapter One: The Well"), the line at most 80 characters.
 *
 * Text before the first marker is its own opening section. With no signal
 * dividing the chapter, there are no sections, and the lane says so.
 *
 * **Markers that are not markers** (Draft Edit, PR #180 F-01). A caller may
 * name markers to leave out (`ignored`), asked with every line a marker's
 * syntax spans: its one line, or a setext heading's text lines and its
 * underline. Craft Flags leaves out a marker any of whose lines starts inside
 * protected text: a heading in a fenced code block, or prose over an
 * underline that is a fenced block's line (the re-review). A marker left out
 * marks nothing and fires nothing, and the signal and heading level are
 * chosen from the rest, so protected text never decides which of the
 * chapter's own markers divide it. Paragraph numbers do not change. The
 * Lightbox names none, and reads every marker as before.
 *
 * **Front matter** (PR #156 F-02). A leading YAML block is metadata, never
 * structure, even when blank lines split it across paragraphs: `---` as the
 * chapter's first line, then lines that read as YAML (a `key:` with no space
 * in the key, a `- ` list item, a `#` comment, or an indented continuation),
 * up to a closing `---` or `...` alone on its line. Nothing in that span is
 * a marker. Lines after the closing delimiter in its own paragraph are read
 * as that paragraph's start, so a heading there marks it. Paragraph
 * addresses do not change: the metadata's paragraphs stay in the opening
 * section. A block never closed, or holding a line that does not read as
 * YAML, is not front matter, and its `---` is read as before.
 *
 * **Limits, stated.** A break or heading inside a paragraph (no blank line
 * before it) cannot split that paragraph: the paragraph model is the
 * board's unit, so a heading or break line under prose without a blank line
 * marks the paragraph it opens only when it is that paragraph's first line
 * (a setext heading always is), or follows front matter's closing line. So
 * where a caller leaves out markers in protected text, a setext heading
 * directly under a comment or a code block, in the same paragraph, is left
 * out with it.
 * Other manuscript breaks (`⁂`, a centered `o`, blank-line runs) are not
 * detected, and neither are "Part", "Book", "Prologue" or "Epilogue" lines.
 * Setext underlines shorter than three characters, which CommonMark
 * accepts, are not taken as headings. Front matter is recognised by the
 * shape of its lines, not parsed: a YAML continuation that opens a
 * paragraph loses its indentation to the paragraph model and ends the
 * block's recognition, and a chapter that opens with `---` followed only by
 * `Word:` lines up to a later `---` is taken for front matter.
 */

import type { ChapterSection, ChapterSectionSignal, ChapterSectionsMeasure } from '@shared/types/chapterSections';
import type { TextRange } from '@/domain/models/DraftEdit';
import { splitBlankLineParagraphs, type BlankLineParagraph } from '@/utils/blankLineParagraphs';

const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(={3,}|-{3,})[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LONE_MARK = /^ {0,3}(?:#(?:[ \t]+#)*|§)[ \t]*$/;
/** A line of YAML front matter: a `key:` (no space in the key), a list item, a comment, or an indented continuation. */
const FRONT_MATTER_LINE = /^(?:\s*["']?[\w-]+["']?\s*:(?:\s.*)?|\s*-(?:\s.*)?|\s*#.*|\s+\S.*)$/;
const FRONT_MATTER_CLOSE = /^(?:---|\.\.\.)$/;
const ROMAN = '(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
const UNITS = 'one|two|three|four|five|six|seven|eight|nine';
const TEENS = 'ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen';
const TENS = 'twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety';
const SPELLED = `(?:(?:${TENS})(?:[- ](?:${UNITS}))?|${TEENS}|${UNITS})`;
const CHAPTER_LINE = new RegExp(
  `^ {0,3}chapter[ \\t]+(?:\\d{1,4}|${ROMAN}|${SPELLED})\\b(?:[ \\t]*[.:][ \\t]*.*|[ \\t]+[—–-][ \\t]+.*|[ \\t]*)$`,
  'i'
);
/** A chapter line or heading label longer than this is cut, whole words kept. */
const LABEL_CHARACTERS = 80;

interface Marker {
  paragraph: number;
  label: string;
  level?: number;
}

/**
 * The chapter's sections from its paragraphs (index 0 is ¶1), and where each
 * signal fired. `ignored`, when given, is asked of each paragraph that would
 * mark a section, in paragraph order, with the paragraph's number and the
 * indexes of the first and last lines its marker's syntax spans (the same
 * line but for a setext heading, whose last is its underline); a marker it
 * answers true for is left out (F-01).
 */
export function detectChapterSections(
  paragraphs: readonly string[],
  ignored?: (paragraph: number, firstLine: number, lastLine: number) => boolean
): ChapterSectionsMeasure {
  const headings: Marker[] = [];
  const breaks: Marker[] = [];
  const chapters: Marker[] = [];
  const frontMatter = frontMatterEnd(paragraphs);
  paragraphs.forEach((text, index) => {
    const paragraph = index + 1;
    // Within front matter nothing is a marker; after its closing line, its paragraph reads on.
    const first = !frontMatter || paragraph > frontMatter.paragraph
      ? 0
      : paragraph === frontMatter.paragraph ? frontMatter.line + 1 : undefined;
    const lines = first === undefined ? [] : linesOf(text).slice(first);
    if (lines.length === 0) {
      return;
    }
    const heading = headingOf(lines);
    const isBreak = !heading && (THEMATIC_BREAK.test(lines[0]) || LONE_MARK.test(lines[0]));
    const isChapter = !heading && !isBreak && lines[0].length <= LABEL_CHARACTERS && CHAPTER_LINE.test(lines[0]);
    const from = first ?? 0;
    if ((!heading && !isBreak && !isChapter) || ignored?.(paragraph, from, from + (heading?.lines ?? 1) - 1)) {
      return;
    }
    if (heading) {
      headings.push({ paragraph, label: heading.label, level: heading.level });
    } else if (isBreak) {
      breaks.push({ paragraph, label: '' });
    } else {
      chapters.push({ paragraph, label: lines[0].trim() });
    }
  });
  /* eslint-disable @typescript-eslint/naming-convention -- signals are kebab-case protocol literals. */
  const fired: Record<ChapterSectionSignal, number[]> = {
    headings: headings.map((marker) => marker.paragraph),
    'scene-breaks': breaks.map((marker) => marker.paragraph),
    'chapter-lines': chapters.map((marker) => marker.paragraph)
  };
  /* eslint-enable @typescript-eslint/naming-convention */
  const count = paragraphs.length;
  for (let level = 1; level <= 6; level++) {
    const sections = sectionsFrom(headings.filter((marker) => (marker.level ?? 1) <= level), count, 'Opening');
    if (sections.length >= 2) {
      return { signal: 'headings', level, sections, fired };
    }
  }
  const opening = breaks.filter((marker, index) =>
    marker.paragraph < count && breaks[index + 1]?.paragraph !== marker.paragraph + 1);
  const scenes = sectionsFrom(opening, count, '').map((section, index) => ({ ...section, label: `Scene ${index + 1}` }));
  if (scenes.length >= 2) {
    return { signal: 'scene-breaks', sections: scenes, fired };
  }
  const chapterSections = sectionsFrom(chapters, count, 'Opening');
  if (chapterSections.length >= 2) {
    return { signal: 'chapter-lines', sections: chapterSections, fired };
  }
  return { signal: 'none', sections: [], fired };
}

/**
 * A paragraph's opening heading: ATX on its first line, or setext text
 * directly over an underline; `lines` is how many lines its syntax spans.
 */
function headingOf(lines: readonly string[]): { label: string; level: number; lines: number } | undefined {
  if (LONE_MARK.test(lines[0])) {
    return undefined;
  }
  const atx = ATX.exec(lines[0]);
  if (atx && atx[2].trim().length > 0) {
    return { label: label(atx[2]), level: atx[1].length, lines: 1 };
  }
  const underline = lines.findIndex((line, index) => index > 0 && SETEXT_UNDERLINE.test(line));
  if (underline > 0) {
    const text = lines.slice(0, underline);
    if (text.every((line) => line.trim().length > 0 && !THEMATIC_BREAK.test(line) && !ATX.test(line))) {
      return {
        label: label(text.map((line) => line.trim()).join(' ')),
        level: lines[underline].trim().startsWith('=') ? 1 : 2,
        lines: underline + 1
      };
    }
  }
  return undefined;
}

function linesOf(text: string): string[] {
  // `trimEnd` removes exactly what `/\s+$/` did, read from the end: the pattern was tried from every start in a long
  // run of spaces inside a line, work that grew with the square of the run (PR #165 F-05).
  return text.split('\n').map((line) => line.trimEnd());
}

/**
 * Where leading YAML front matter closes, across the paragraphs blank lines
 * split it into: the paragraph (from 1) and the index of its closing line;
 * undefined when the chapter opens with none.
 */
function frontMatterEnd(paragraphs: readonly string[]): { paragraph: number; line: number } | undefined {
  if (paragraphs.length === 0 || linesOf(paragraphs[0])[0].trim() !== '---') {
    return undefined;
  }
  for (let index = 0; index < paragraphs.length; index++) {
    const lines = linesOf(paragraphs[index]);
    for (let line = index === 0 ? 1 : 0; line < lines.length; line++) {
      if (FRONT_MATTER_CLOSE.test(lines[line].trim())) {
        return { paragraph: index + 1, line };
      }
      if (!FRONT_MATTER_LINE.test(lines[line])) {
        return undefined;
      }
    }
  }
  return undefined;
}

/** Sections opened by `markers` (ascending), with text before the first as its own opening section. */
function sectionsFrom(markers: readonly Marker[], count: number, openingLabel: string): ChapterSection[] {
  if (markers.length === 0 || count === 0) {
    return [];
  }
  const sections: ChapterSection[] = [];
  if (markers[0].paragraph > 1) {
    sections.push({ from: 1, to: markers[0].paragraph - 1, label: openingLabel });
  }
  markers.forEach((marker, index) => {
    const next = markers[index + 1]?.paragraph ?? count + 1;
    sections.push({ from: marker.paragraph, to: next - 1, label: marker.label, marker: marker.paragraph });
  });
  return sections;
}

/**
 * Where each section after the first begins in `text`, in order: the offset
 * of the line its marker starts on (its paragraph's first, or, after front
 * matter's closing line in the same paragraph, the next); empty when nothing
 * divides the chapter. A marker any line of whose syntax starts inside one of
 * `ignored` (protected regions: code, comments, front matter), which must be
 * sorted and never overlap, is left out before the signal is chosen (F-01):
 * a heading written inside code, or prose over an underline that is a fenced
 * block's line, neither divides the chapter nor hides a break that does. A
 * line's syntax starts past its indentation, so an indented comment is as
 * protected as one at the margin. A heading whose title holds code past its
 * first character keeps its place.
 * Linear in the text and in `ignored` (PR #180 N-02).
 */
export function chapterSectionStarts(text: string, ignored: readonly TextRange[] = []): number[] {
  const paragraphs = splitBlankLineParagraphs(text);
  const inside = insideAscending(ignored);
  const markerStarts = new Map<number, number>();
  const measure = detectChapterSections(paragraphs.map((paragraph) => paragraph.text), (paragraph, firstLine, lastLine) => {
    const lines = syntaxLines(paragraphs[paragraph - 1], firstLine, lastLine);
    markerStarts.set(paragraph, lines[0].start);
    // In order, so the walk over `ignored` only moves forward.
    return lines.some((line) => inside(line.syntax));
  });
  return measure.sections.flatMap((section) =>
    (section.from > 1 ? [markerStarts.get(section.from) ?? paragraphs[section.from - 1].start] : []));
}

/**
 * Lines `firstLine` to `lastLine` of a blank-line paragraph, in order, each
 * with where it starts in the text it was read from and where its syntax
 * starts: past its indentation, so an indented line whose text is protected
 * is read as protected (the second re-review). A line of only space has its
 * syntax at its end.
 */
function syntaxLines(paragraph: BlankLineParagraph, firstLine: number, lastLine: number): { start: number; syntax: number }[] {
  const lines: { start: number; syntax: number }[] = [];
  let offset = 0;
  for (let line = 0; line <= lastLine; line++) {
    if (line >= firstLine) {
      let syntax = offset;
      while (paragraph.text[syntax] === ' ' || paragraph.text[syntax] === '\t') {
        syntax++;
      }
      lines.push({ start: paragraph.start + offset, syntax: paragraph.start + syntax });
    }
    offset = paragraph.text.indexOf('\n', offset) + 1;
  }
  return lines;
}

/**
 * Whether each offset, asked in ascending order, lies inside one of `ranges`
 * (sorted, never overlapping): one walk over them, however many are asked.
 */
function insideAscending(ranges: readonly TextRange[]): (offset: number) => boolean {
  let next = 0;
  return (offset) => {
    while (next < ranges.length && ranges[next].end <= offset) {
      next++;
    }
    return next < ranges.length && ranges[next].start <= offset;
  };
}

function label(text: string): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (trimmed.length <= LABEL_CHARACTERS) {
    return trimmed;
  }
  const cut = trimmed.slice(0, LABEL_CHARACTERS);
  const space = cut.lastIndexOf(' ');
  return `${(space > LABEL_CHARACTERS / 2 ? cut.slice(0, space) : cut).trimEnd()}…`;
}
