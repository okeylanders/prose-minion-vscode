/**
 * The ribbon's focus line (ADR 2026-10-19 D4; Slice 4M): what the hovered or
 * pinned item touches, in a line that never changes the ribbon's height.
 * Pure: no React, no transport.
 *
 * The line has two parts. Its **text** names the item and the paragraphs it
 * touches, written as ranges ("¶3–¶7 ¶12 ¶40–¶44", the board's own range
 * form), and CSS clips it to one line. Its **tail** never clips: it says how
 * many paragraphs the item touches ("· 23 ¶"), or that it stands in no single
 * paragraph. So clipping can hide where an item stands, never how much of the
 * text it touches; the inspector lists every paragraph of a pinned item.
 *
 * Before this slice the line spelled out 14 references and wrapped onto a
 * second row when it did not fit beside the eyebrow: the ribbon grew, the
 * board moved, the pointer left the item, and the line shrank back, over and
 * over (the writer's report).
 */

/** What the line says while nothing is hovered or pinned. */
export const LIGHTBOX_FOCUS_IDLE = 'Hover anything on the board to light the paragraphs it touches.';

/** The tail of an item that stands in no single paragraph. */
export const LIGHTBOX_FOCUS_NO_PARAGRAPH = '· in no single paragraph';

/**
 * How many ranges the line writes. CSS clips the line long before this; the
 * cap only keeps the DOM small for an item that touches much of a long text.
 */
export const LIGHTBOX_FOCUS_RANGES = 60;

/** A run of consecutive paragraphs, 1-based and inclusive. */
export interface LightboxParagraphRange {
  from: number;
  to: number;
}

export interface LightboxFocusLine {
  /** The item's title and its paragraphs as ranges, or the idle hint: clipped to one line. */
  text: string;
  /** How many paragraphs the item touches, or that it is in none: never clipped. Absent while idle. */
  tail?: string;
}

/** The item as the line needs it: its title and the paragraphs it touches. */
export interface LightboxFocusSubject {
  title: string;
  paragraphs: readonly number[];
}

/** Paragraph numbers as runs of consecutive paragraphs, in order, each paragraph once. */
export function lightboxParagraphRanges(paragraphs: readonly number[]): LightboxParagraphRange[] {
  const sorted = [...new Set(paragraphs)].sort((a, b) => a - b);
  const ranges: LightboxParagraphRange[] = [];
  for (const index of sorted) {
    const last = ranges[ranges.length - 1];
    if (last && index === last.to + 1) {
      last.to = index;
    } else {
      ranges.push({ from: index, to: index });
    }
  }
  return ranges;
}

/** "¶12", or "¶3–¶7" for a run. */
export function lightboxParagraphRangeLabel(range: LightboxParagraphRange): string {
  const at = (index: number) => `¶${index.toLocaleString('en-US')}`;
  return range.from === range.to ? at(range.from) : `${at(range.from)}–${at(range.to)}`;
}

/** The focus line for the hovered or pinned item, or the idle hint when there is none. */
export function lightboxFocusLine(item: LightboxFocusSubject | null): LightboxFocusLine {
  if (!item) {
    return { text: LIGHTBOX_FOCUS_IDLE };
  }
  const ranges = lightboxParagraphRanges(item.paragraphs);
  if (ranges.length === 0) {
    return { text: item.title, tail: LIGHTBOX_FOCUS_NO_PARAGRAPH };
  }
  const shown = ranges.slice(0, LIGHTBOX_FOCUS_RANGES).map(lightboxParagraphRangeLabel).join(' ');
  const more = ranges.length > LIGHTBOX_FOCUS_RANGES ? ' …' : '';
  const count = ranges.reduce((sum, range) => sum + range.to - range.from + 1, 0);
  return { text: `${item.title} · ${shown}${more}`, tail: `· ${count.toLocaleString('en-US')} ¶` };
}
