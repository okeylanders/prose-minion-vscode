/**
 * A chapter's own structure: the sections its headings, scene breaks or
 * chapter lines divide it into (ADR 2026-10-19 D4, D5; ADR 2026-10-21,
 * Slice 3c part 4). Detected by code from its blank-line paragraphs, never
 * read by a model (`detectChapterSections`). The Lightbox's Sections lane
 * shows them; Craft Flags' continuity never pairs two places across them.
 */

/** Which signal divides the chapter: headings, scene-break lines, or plain chapter lines. */
export type ChapterSectionSignal = 'headings' | 'scene-breaks' | 'chapter-lines';

/** One section: a run of paragraphs. Sections tile the chapter. */
export interface ChapterSection {
  /** 1-based, inclusive. */
  from: number;
  to: number;
  /** The heading's or chapter line's own text, or "Scene n", or "Opening" before the first marker. */
  label: string;
  /** The paragraph whose marker opens the section; absent for the opening run before the first marker. */
  marker?: number;
}

export interface ChapterSectionsMeasure {
  /** The signal the sections come from: the first, in this order, that yields two or more; else `none`. */
  signal: ChapterSectionSignal | 'none';
  /** For headings: the highest level (fewest `#`) that yields two or more sections. */
  level?: number;
  /** Empty when `signal` is `none`. */
  sections: ChapterSection[];
  /** Where each signal fired, whether or not it divides the chapter: paragraph numbers, ascending. */
  fired: Record<ChapterSectionSignal, number[]>;
}
