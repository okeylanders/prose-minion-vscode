/**
 * The Sections lane's detector (ADR 2026-10-19 D4, D5; Slice 4C). Pure: no
 * host, no I/O, no model. It reads the board's paragraph model (paragraphs
 * split on blank lines, each trimmed) and finds the chapter's own structure,
 * in this order; the first signal that divides the chapter into two or more
 * sections wins:
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
 * (a setext heading always is), or follows front matter's closing line.
 * Other manuscript breaks (`⁂`, a centered `o`, blank-line runs) are not
 * detected, and neither are "Part", "Book", "Prologue" or "Epilogue" lines.
 * Setext underlines shorter than three characters, which CommonMark
 * accepts, are not taken as headings. Front matter is recognised by the
 * shape of its lines, not parsed: a YAML continuation that opens a
 * paragraph loses its indentation to the paragraph model and ends the
 * block's recognition, and a chapter that opens with `---` followed only by
 * `Word:` lines up to a later `---` is taken for front matter.
 */

import type { LightboxSection, LightboxSectionSignal, LightboxSectionsMeasure } from '@messages';

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

/** The chapter's sections from its paragraphs (index 0 is ¶1), and where each signal fired. */
export function detectLightboxSections(paragraphs: readonly string[]): LightboxSectionsMeasure {
  const headings: Marker[] = [];
  const breaks: Marker[] = [];
  const chapters: Marker[] = [];
  const frontMatter = frontMatterEnd(paragraphs);
  paragraphs.forEach((text, index) => {
    const paragraph = index + 1;
    // Within front matter nothing is a marker; after its closing line, its paragraph reads on.
    const lines = !frontMatter || paragraph > frontMatter.paragraph
      ? linesOf(text)
      : paragraph === frontMatter.paragraph ? linesOf(text).slice(frontMatter.line + 1) : [];
    if (lines.length === 0) {
      return;
    }
    const heading = headingOf(lines);
    if (heading) {
      headings.push({ paragraph, ...heading });
    } else if (THEMATIC_BREAK.test(lines[0]) || LONE_MARK.test(lines[0])) {
      breaks.push({ paragraph, label: '' });
    } else if (lines[0].length <= LABEL_CHARACTERS && CHAPTER_LINE.test(lines[0])) {
      chapters.push({ paragraph, label: lines[0].trim() });
    }
  });
  /* eslint-disable @typescript-eslint/naming-convention -- signals are kebab-case protocol literals. */
  const fired: Record<LightboxSectionSignal, number[]> = {
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

/** A paragraph's opening heading: ATX on its first line, or setext text directly over an underline. */
function headingOf(lines: readonly string[]): { label: string; level: number } | undefined {
  if (LONE_MARK.test(lines[0])) {
    return undefined;
  }
  const atx = ATX.exec(lines[0]);
  if (atx && atx[2].trim().length > 0) {
    return { label: label(atx[2]), level: atx[1].length };
  }
  const underline = lines.findIndex((line, index) => index > 0 && SETEXT_UNDERLINE.test(line));
  if (underline > 0) {
    const text = lines.slice(0, underline);
    if (text.every((line) => line.trim().length > 0 && !THEMATIC_BREAK.test(line) && !ATX.test(line))) {
      return { label: label(text.map((line) => line.trim()).join(' ')), level: lines[underline].trim().startsWith('=') ? 1 : 2 };
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
function sectionsFrom(markers: readonly Marker[], count: number, openingLabel: string): LightboxSection[] {
  if (markers.length === 0 || count === 0) {
    return [];
  }
  const sections: LightboxSection[] = [];
  if (markers[0].paragraph > 1) {
    sections.push({ from: 1, to: markers[0].paragraph - 1, label: openingLabel });
  }
  markers.forEach((marker, index) => {
    const next = markers[index + 1]?.paragraph ?? count + 1;
    sections.push({ from: marker.paragraph, to: next - 1, label: marker.label, marker: marker.paragraph });
  });
  return sections;
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
