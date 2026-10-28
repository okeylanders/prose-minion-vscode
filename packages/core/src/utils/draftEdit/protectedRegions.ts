/**
 * Protected regions — the parts of a Markdown document no pass may change
 * (ADR 2026-10-21 D4): front matter, fenced and inline code, link and image
 * destinations, a full reference's label (PR #183 F-01), autolinks and bare
 * URLs and email addresses, reference definitions, HTML comments, and HTML
 * tags with their attributes.
 *
 * `markdownBlockRegions` reads the block structure: the protected blocks
 * (front matter, and fences, definitions and raw `<script>`/`<style>` blocks
 * inside any container), and the inline scopes (each leaf block or table
 * cell, container prefixes stripped, mapped back to the source column by
 * column). `markdownInlineRegions` then reads each scope alone, so an inline
 * construct never runs from one block into the next (PR #171 F-02 and its
 * re-review). Where either is unsure, it protects more, never less.
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
import { readMarkdownBlocks } from '@/utils/draftEdit/markdownBlockRegions';
import { findMarkdownInlineRegions } from '@/utils/draftEdit/markdownInlineRegions';

/** What a masked region looks like to the model; the prompt says never to quote or change it. */
export const PROTECTED_PLACEHOLDER = '⟦protected⟧';

/** Languages whose syntax has protected regions. */
const MARKDOWN_LANGUAGE_IDS: ReadonlySet<string> = new Set(['markdown']);

/** Every protected region of `text`, sorted and merged; none unless the language is Markdown. */
export function findProtectedRegions(text: string, languageId: string): TextRange[] {
  return readDocumentRegions(text, languageId).protected;
}

/** What one reading of a document's structure finds: its protected regions, and its headings (Slice 3b's name check). */
export interface DocumentRegions {
  readonly protected: TextRange[];
  /** Heading blocks, as whole source lines, sorted and merged; none unless the language is Markdown. */
  readonly headings: TextRange[];
}

/** The protected regions and headings of `text`, from one reading of its blocks. */
export function readDocumentRegions(text: string, languageId: string): DocumentRegions {
  if (!MARKDOWN_LANGUAGE_IDS.has(languageId)) {
    return { protected: [], headings: [] };
  }
  const blocks = readMarkdownBlocks(text);
  const regions: TextRange[] = [...blocks.regions];
  for (const scope of blocks.scopes) {
    for (const range of findMarkdownInlineRegions(scope.text)) {
      regions.push({ start: scope.toSource(range.start), end: scope.toSource(range.end) });
    }
  }
  return {
    protected: mergeRanges(regions.filter((region) => region.end > region.start)),
    headings: mergeRanges(blocks.headings)
  };
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
