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
 *    `---`), or a lone `#` or `§`. `---` is decided by the blank-line rule:
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
 * dividing the chapter, there are no sections, and the lane says so. A
 * leading YAML front-matter block (`---` … `---` as the first paragraph) is
 * neither a heading nor a break.
 *
 * **Limits, stated.** A break or heading inside a paragraph (no blank line
 * before it) cannot split that paragraph: the paragraph model is the
 * board's unit, so a heading or break line under prose without a blank line
 * marks the paragraph it opens only when it is that paragraph's first line
 * (a setext heading always is). Other manuscript breaks (`# # #`, `⁂`, a
 * centered `o`, blank-line runs) are not detected, and neither are "Part",
 * "Book", "Prologue" or "Epilogue" lines. Setext underlines shorter than
 * three characters, which CommonMark accepts, are not taken as headings.
 */

import type { LightboxSection, LightboxSectionSignal, LightboxSectionsMeasure } from '@messages';

const ATX = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(={3,}|-{3,})[ \t]*$/;
const THEMATIC_BREAK = /^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const LONE_MARK = /^ {0,3}[#§][ \t]*$/;
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
  paragraphs.forEach((text, index) => {
    const paragraph = index + 1;
    const lines = text.split('\n').map((line) => line.replace(/\s+$/, ''));
    if (paragraph === 1 && isFrontMatter(lines)) {
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

/** A first paragraph of YAML front matter: `---`, its fields, and a closing `---` or `...`. */
function isFrontMatter(lines: readonly string[]): boolean {
  return lines.length >= 2 && lines[0].trim() === '---' && ['---', '...'].includes(lines[lines.length - 1].trim());
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
