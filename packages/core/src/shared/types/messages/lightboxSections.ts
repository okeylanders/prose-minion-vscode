/**
 * The Lightbox's Sections lane (ADR 2026-10-19 D4, D5; Slice 4C): the
 * chapter's own structure, detected by code from the paragraph model, never
 * read by a model. It is measured, so it is built with every board and is
 * never stale. The detector and its limits are `LightboxSections`.
 */

/** Which signal divides the chapter: headings, scene-break lines, or plain chapter lines. */
export type LightboxSectionSignal = 'headings' | 'scene-breaks' | 'chapter-lines';

/** One section: a run of paragraphs. Sections tile the chapter. */
export interface LightboxSection {
  /** 1-based, inclusive. */
  from: number;
  to: number;
  /** The heading's or chapter line's own text, or "Scene n", or "Opening" before the first marker. */
  label: string;
  /** The paragraph whose marker opens the section; absent for the opening run before the first marker. */
  marker?: number;
}

export interface LightboxSectionsMeasure {
  /** The signal the sections come from: the first, in this order, that yields two or more; else `none`. */
  signal: LightboxSectionSignal | 'none';
  /** For headings: the highest level (fewest `#`) that yields two or more sections. */
  level?: number;
  /** Empty when `signal` is `none`: the ribbon stays in paragraphs. */
  sections: LightboxSection[];
  /** Where each signal fired, whether or not it divides the chapter: paragraph numbers, ascending. */
  fired: Record<LightboxSectionSignal, number[]>;
}
