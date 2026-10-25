/**
 * Protected regions — the parts of a Markdown document no pass may change
 * (ADR 2026-10-21 D4): front matter, fenced and inline code, link and image
 * targets, autolinks and bare URLs, reference definitions, HTML comments, and
 * HTML tags.
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
import { closesFence, parseFenceOpener } from '@/utils/markdownFences';

/** What a masked region looks like to the model; the prompt says never to quote or change it. */
export const PROTECTED_PLACEHOLDER = '⟦protected⟧';

/** Languages whose syntax has protected regions. */
const MARKDOWN_LANGUAGE_IDS: ReadonlySet<string> = new Set(['markdown']);

/** Inline constructs, searched only outside front matter and fenced code. */
const INLINE_PATTERNS: readonly RegExp[] = [
  // HTML comments, possibly unclosed (CommonMark runs them to the end of the block).
  /<!--[\s\S]*?(?:-->|$)/g,
  // Inline code: a backtick run, then the same run again, never across a blank line.
  /(`+)(?!`)(?:(?!\n[ \t]*\n)[\s\S])*?(?<!`)\1(?!`)/g,
  // Reference definitions: `[label]: destination "title"`, the whole line.
  /^ {0,3}\[[^\]\n]+\]:[^\n]*$/gm,
  // Autolinks: `<https://…>`, `<mailto:…>`.
  /<(?:https?|ftp|mailto):[^>\s]*>/gi,
  // Bare URLs, which GFM links.
  /\bhttps?:\/\/[^\s<>()]+/g,
  // HTML tags (not their content).
  /<\/?[A-Za-z][A-Za-z0-9-]*(?:\s[^<>]*)?\/?>/g
];

/** A link or image destination: the `(…)` after `]`, never the visible text. */
const LINK_DESTINATION = /\]\([^)\n]*\)/g;

/** Every protected region of `text`, sorted and merged; none unless the language is Markdown. */
export function findProtectedRegions(text: string, languageId: string): TextRange[] {
  if (!MARKDOWN_LANGUAGE_IDS.has(languageId)) {
    return [];
  }
  const blocks = findBlockRegions(text);
  const regions: TextRange[] = [...blocks];
  for (const gap of gapsBetween(blocks, text.length)) {
    const segment = text.slice(gap.start, gap.end);
    for (const pattern of INLINE_PATTERNS) {
      for (const match of segment.matchAll(pattern)) {
        regions.push({ start: gap.start + match.index!, end: gap.start + match.index! + match[0].length });
      }
    }
    for (const match of segment.matchAll(LINK_DESTINATION)) {
      // Keep the `]`: it closes the link text, which is prose.
      regions.push({ start: gap.start + match.index! + 1, end: gap.start + match.index! + match[0].length });
    }
  }
  return mergeRanges(regions.filter((region) => region.end > region.start));
}

/** Front matter at the very start, and fenced code blocks (an unclosed fence runs to the end). */
function findBlockRegions(text: string): TextRange[] {
  const lines = splitLines(text);
  const regions: TextRange[] = [];
  let index = 0;

  if (lines.length > 0 && lines[0].content === '---') {
    const close = lines.findIndex((line, i) => i > 0 && (line.content === '---' || line.content === '...'));
    if (close > 0) {
      regions.push({ start: 0, end: lines[close].end });
      index = close + 1;
    }
  }

  while (index < lines.length) {
    const opener = parseFenceOpener(lines[index].content);
    if (!opener) {
      index += 1;
      continue;
    }
    let close = index + 1;
    while (close < lines.length && !closesFence(lines[close].content, opener)) {
      close += 1;
    }
    const last = Math.min(close, lines.length - 1);
    regions.push({ start: lines[index].start, end: lines[last].end });
    index = last + 1;
  }
  return regions;
}

interface Line {
  /** The line's text, without its line ending (`\r\n` or `\n`). */
  readonly content: string;
  readonly start: number;
  /** Where the line's content ends, before the line ending. */
  readonly end: number;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;
  while (start <= text.length) {
    const newline = text.indexOf('\n', start);
    const rawEnd = newline === -1 ? text.length : newline;
    const end = rawEnd > start && text[rawEnd - 1] === '\r' ? rawEnd - 1 : rawEnd;
    lines.push({ content: text.slice(start, end), start, end });
    if (newline === -1) {
      break;
    }
    start = newline + 1;
  }
  return lines;
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
