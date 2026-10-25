/**
 * Protected regions — the parts of a Markdown document no pass may change
 * (ADR 2026-10-21 D4): front matter, fenced and inline code, link and image
 * destinations, autolinks and bare URLs and email addresses, reference
 * definitions, HTML comments, and HTML tags with their attributes.
 *
 * Block regions come first (`markdownBlockRegions`: front matter, and fences,
 * definitions and raw `<script>`/`<style>` blocks inside any container),
 * then inline regions in the text between them (`markdownInlineRegions`).
 * Both read complete constructs: a fence under `> ` or a list marker, a
 * destination with balanced parentheses or a line break, a definition on
 * several lines, an attribute holding `>` (PR #171 F-02). Where a scanner is
 * unsure, it protects more, never less.
 *
 * Indented code blocks are deliberately not protected: fiction writers
 * indent paragraphs with a tab or four spaces, which Markdown reads as code,
 * and protecting them would silently skip prose. Plain text has no
 * protected regions.
 *
 * A pass sees a masked view: each region is replaced by one placeholder, and
 * the view maps offsets back to the source so a quote the model returns can
 * be placed exactly, or refused when it touches a placeholder.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { findMarkdownBlockRegions } from '@/utils/draftEdit/markdownBlockRegions';
import { findMarkdownInlineRegions } from '@/utils/draftEdit/markdownInlineRegions';

/** What a masked region looks like to the model; the prompt says never to quote or change it. */
export const PROTECTED_PLACEHOLDER = '⟦protected⟧';

/** Languages whose syntax has protected regions. */
const MARKDOWN_LANGUAGE_IDS: ReadonlySet<string> = new Set(['markdown']);

/** Every protected region of `text`, sorted and merged; none unless the language is Markdown. */
export function findProtectedRegions(text: string, languageId: string): TextRange[] {
  if (!MARKDOWN_LANGUAGE_IDS.has(languageId)) {
    return [];
  }
  const blocks = mergeRanges(findMarkdownBlockRegions(text));
  const regions: TextRange[] = [...blocks];
  for (const gap of gapsBetween(blocks, text.length)) {
    for (const range of findMarkdownInlineRegions(text.slice(gap.start, gap.end))) {
      regions.push({ start: gap.start + range.start, end: gap.start + range.end });
    }
  }
  return mergeRanges(regions.filter((region) => region.end > region.start));
}

function gapsBetween(sorted: readonly TextRange[], length: number): TextRange[] {
  const gaps: TextRange[] = [];
  let cursor = 0;
  for (const range of sorted) {
    if (range.start > cursor) {
      gaps.push({ start: cursor, end: range.start });
    }
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < length) {
    gaps.push({ start: cursor, end: length });
  }
  return gaps;
}

/** Sort, and merge ranges that overlap or touch. */
export function mergeRanges(ranges: readonly TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) {
      merged[merged.length - 1] = { start: last.start, end: Math.max(last.end, range.end) };
    } else {
      merged.push(range);
    }
  }
  return merged;
}

/** A source text with its protected regions replaced by placeholders, and the way back. */
export interface MaskedText {
  readonly text: string;
  /** Each placeholder's span in the masked text, in order. */
  readonly placeholders: readonly TextRange[];
  /** The source offset of a masked offset that is not inside a placeholder; undefined when it is. */
  toSource(maskedOffset: number): number | undefined;
  /** True when a masked range shares any character with a placeholder. */
  touchesPlaceholder(range: TextRange): boolean;
}

/** Replace each (sorted, merged) region of `text` with `PROTECTED_PLACEHOLDER`. */
export function maskProtectedRegions(text: string, regions: readonly TextRange[]): MaskedText {
  const segments: Array<{ masked: TextRange; source: TextRange }> = [];
  let masked = '';
  let cursor = 0;
  for (const region of regions) {
    masked += text.slice(cursor, region.start);
    const start = masked.length;
    masked += PROTECTED_PLACEHOLDER;
    segments.push({ masked: { start, end: masked.length }, source: region });
    cursor = region.end;
  }
  masked += text.slice(cursor);

  const placeholders = segments.map((segment) => segment.masked);
  return {
    text: masked,
    placeholders,
    toSource(maskedOffset: number): number | undefined {
      let shift = 0;
      for (const segment of segments) {
        if (maskedOffset <= segment.masked.start) {
          break;
        }
        if (maskedOffset < segment.masked.end) {
          return undefined;
        }
        shift = segment.source.end - segment.masked.end;
      }
      return maskedOffset + shift;
    },
    touchesPlaceholder(range: TextRange): boolean {
      return placeholders.some((placeholder) => range.start < placeholder.end && placeholder.start < range.end);
    }
  };
}
