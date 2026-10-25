/**
 * Markdown's block structure for Draft Edit (ADR 2026-10-21 D4; PR #171
 * F-02 and its re-review), read by `marked`, the parser `markdownFences`
 * already uses:
 * - **Protected blocks:** front matter; fenced code, link reference
 *   definitions, and raw `<script>` / `<style>` blocks, wherever Markdown's
 *   containers put them (block quotes, list items, nested).
 * - **Inline scopes:** each leaf block whose text Markdown reads inline (a
 *   paragraph, a heading, a tight list item's text, an HTML block, and each
 *   table cell), plus indented code, read as prose. Inline constructs are
 *   found within one scope only, as a parser finds them: a backtick in one
 *   list item never pairs with one in the next, and a block quote's `>` is
 *   never read as the end of a tag.
 *
 * Offsets. `marked` gives each token's raw text, not its offset. At every
 * level a container's children's raw texts make up its content, and that
 * content keeps the container's source lines one for one: it strips prefixes
 * (`> `, a list marker, indentation), never a line, and may expand a tab. So
 * each content line ends its source line, and maps back column by column.
 * Protected blocks are whole source lines; the prefixes they take in are
 * syntax, never prose. A child that does not continue its container's
 * content, or a line that does not end its computed source line, fails
 * closed: the whole top-level block around it is protected.
 *
 * Indented code is not protected: writers indent paragraphs with a tab or
 * four spaces, which Markdown reads as code.
 *
 * Depth. `marked`'s work grows with how deeply containers nest. A document
 * nesting block quotes and list items deeper than any manuscript does (a
 * line opening more than `MAX_CONTAINER_DEPTH` of them, in any mix, or a
 * list marker indented past `MAX_LIST_INDENT` columns, inside block quotes or
 * not) is not read, and is protected whole, as is one `marked` fails on.
 */

import { Lexer, getDefaults, type Token, type Tokens } from 'marked';
import type { TextRange } from '@/domain/models/DraftEdit';

/**
 * Block tokens only: inline lexing is the inline scanner's, and skipping it
 * keeps this linear on text full of backticks. A fresh lexer on `marked`'s
 * own defaults (GFM), so it never reads or changes a renderer's options.
 */
const blockTokens = (body: string): Token[] => new Lexer(getDefaults()).blockTokens(body);

export interface SourceLine {
  /** The line's text, without its line ending. */
  readonly content: string;
  readonly start: number;
  /** Where the content ends, before the line ending. */
  readonly end: number;
}

/** The source's lines, split where `marked` splits them: at `\r\n`, `\r`, or `\n`. */
export function splitSourceLines(text: string): SourceLine[] {
  const lines: SourceLine[] = [];
  const lineEnding = /\r\n|\r|\n/g;
  let start = 0;
  for (let match = lineEnding.exec(text); match; match = lineEnding.exec(text)) {
    lines.push({ content: text.slice(start, match.index), start, end: match.index });
    start = match.index + match[0].length;
  }
  lines.push({ content: text.slice(start), start, end: text.length });
  return lines;
}

const MAX_CONTAINER_DEPTH = 32;
const MAX_LIST_INDENT = 64;
/** One container marker opening a line: a block quote's `>`, or a list item's. */
const CONTAINER_MARKER = /[ \t]*(?:>|(?:[-+*]|\d{1,9}[.)])(?=[ \t]|$))/y;
const LIST_MARKER = /^([ \t]*)(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;
const QUOTE_MARKERS = /^(?:[ \t]*>)*/;

/** Raw HTML blocks whose content is code, not text. */
const RAW_CODE_BLOCK = /^ {0,3}<(?:script|style)(?=[\s/>]|$)/i;

/** A line that looks like a link reference definition: protected even where Markdown would read it as paragraph text. */
const DEFINITION_LINE = /^ {0,3}(?:>[ \t]?)*[ \t]{0,3}\[[^\]\n]+\]:(.*)$/;

/** Where inline constructs are read: one leaf block's (or table cell's) text, as the parser reads it. */
export interface MarkdownInlineScope {
  readonly text: string;
  /** The source offset of a scope offset; a scope line's end maps to its source line's end. */
  toSource(offset: number): number;
}

export interface MarkdownBlockReading {
  /** Protected regions, as whole source lines. */
  readonly regions: TextRange[];
  readonly scopes: MarkdownInlineScope[];
}

/** Front matter, then the protected blocks and inline scopes `marked` finds. */
export function readMarkdownBlocks(text: string): MarkdownBlockReading {
  const lines = splitSourceLines(text);
  const regions: TextRange[] = [];
  const scopes: MarkdownInlineScope[] = [];
  const protect = (first: number, last: number): void => {
    const from = Math.max(0, first);
    const to = Math.min(lines.length - 1, last);
    if (from <= to) {
      regions.push({ start: lines[from].start, end: lines[to].end });
    }
  };

  let bodyLine = 0;
  if (lines[0].content === '---') {
    const close = lines.findIndex((line, index) => index > 0 && (line.content === '---' || line.content === '...'));
    if (close > 0) {
      protect(0, close);
      bodyLine = close + 1;
    }
  }

  const body = lines.slice(bodyLine).map((line) => line.content).join('\n');
  let tokens: Token[];
  try {
    tokens = nestsTooDeeply(lines) ? [] : blockTokens(body);
  } catch {
    tokens = [];
  }
  if (tokens.length === 0 && body.trim() !== '') {
    protect(bodyLine, lines.length - 1);
    return { regions, scopes };
  }
  const walker = new BlockWalker(lines, protect, scopes);
  let line = bodyLine;
  let offset = 0;
  for (const token of tokens) {
    const last = line + lastLineOffset(token.raw);
    if (!body.startsWith(token.raw, offset)) {
      // `marked` always consumes its source in order; if it ever did not, protect the rest.
      protect(line, lines.length - 1);
      break;
    }
    if (!walker.visit(token, line)) {
      protect(line, last);
    }
    line += newlines(token.raw);
    offset += token.raw.length;
  }

  lines.forEach((sourceLine, index) => {
    const definition = DEFINITION_LINE.exec(sourceLine.content);
    if (definition && index >= bodyLine) {
      // `[label]:` alone on its line: its destination is on the next.
      protect(index, definition[1].trim() === '' ? index + 1 : index);
    }
  });
  return { regions, scopes };
}

class BlockWalker {
  constructor(
    private readonly lines: readonly SourceLine[],
    private readonly protect: (first: number, last: number) => void,
    private readonly scopes: MarkdownInlineScope[]
  ) {}

  /** Protect or scope what `token`, starting at source line `line`, holds; false when its lines are not where they should be. */
  visit(token: Token, line: number): boolean {
    if (isProtectedBlock(token)) {
      if (!this.matchesSource(token.raw, line)) {
        return false;
      }
      this.protect(line, line + lastLineOffset(token.raw));
      return true;
    }
    if (INLINE_SCOPE_TYPES.has(token.type)) {
      return this.scope(contentLines(token.raw).map((text, index) => ({ text, line: line + index, from: 0, to: text.length })));
    }
    if (token.type === 'table') {
      return this.tableCells(token.raw, line);
    }
    if (token.type === 'blockquote') {
      const quote = token as Tokens.Blockquote;
      return this.visitChildren(quote.tokens, quote.text, quote.raw, line);
    }
    if (token.type === 'list') {
      const list = token as Tokens.List;
      let offset = 0;
      let itemLine = line;
      for (const item of list.items) {
        if (!list.raw.startsWith(item.raw, offset)) {
          return false;
        }
        if (!this.visitChildren(item.tokens, item.text, item.raw, itemLine)) {
          return false;
        }
        offset += item.raw.length;
        itemLine += newlines(item.raw);
      }
    }
    return true;
  }

  /** A container's children: their raw texts make up `content`, whose lines are `raw`'s, one for one. */
  private visitChildren(children: readonly Token[], content: string, raw: string, line: number): boolean {
    if (newlines(content) > newlines(raw)) {
      return false;
    }
    let offset = 0;
    let current = line;
    for (const child of children) {
      if (!content.startsWith(child.raw, offset) || !this.visit(child, current)) {
        return false;
      }
      current += newlines(child.raw);
      offset += child.raw.length;
    }
    return true;
  }

  /** True when each of the block's lines ends its computed source line (prefixes stripped, tabs perhaps expanded). */
  private matchesSource(raw: string, line: number): boolean {
    return contentLines(raw).every((text, index) => this.align(text, line + index) !== undefined);
  }

  /** A scope over these stretches of content lines; false when one does not end its source line. */
  private scope(stretches: ReadonlyArray<{ text: string; line: number; from: number; to: number }>): boolean {
    const maps: Array<{ scopeStart: number; base: number; lead: number; from: number }> = [];
    let scopeText = '';
    for (const stretch of stretches) {
      const aligned = this.align(stretch.text, stretch.line);
      if (!aligned) {
        return false;
      }
      if (maps.length > 0) {
        scopeText += '\n';
      }
      maps.push({ scopeStart: scopeText.length, base: aligned.base, lead: aligned.lead, from: stretch.from });
      scopeText += stretch.text.slice(stretch.from, stretch.to);
    }
    const starts = maps.map((map) => map.scopeStart);
    this.scopes.push({
      text: scopeText,
      toSource: (offset) => {
        const map = maps[lastAtOrBefore(starts, offset)];
        return map.base + Math.max(0, map.from + offset - map.scopeStart - map.lead);
      }
    });
    return true;
  }

  /** Each cell of each row its own scope: GFM splits a row on unescaped pipes, code spans included. */
  private tableCells(raw: string, line: number): boolean {
    return contentLines(raw).every((text, row) => {
      if (row === 1) {
        // The delimiter row holds no text.
        return this.align(text, line + row) !== undefined;
      }
      return tableCellStretches(text).every(({ from, to }) => this.scope([{ text, line: line + row, from, to }]));
    });
  }

  /**
   * How content line `text` stands in source line `line`: it ends it,
   * exactly or once the spaces a tab became are set aside. Column `c` of the
   * content is source offset `base + max(0, c - lead)`.
   */
  private align(text: string, line: number): { base: number; lead: number } | undefined {
    const source = this.lines[line];
    if (!source) {
      return undefined;
    }
    if (source.content.endsWith(text)) {
      return { base: source.end - text.length, lead: 0 };
    }
    const trimmed = text.trimStart();
    return source.content.endsWith(trimmed) ? { base: source.end - trimmed.length, lead: text.length - trimmed.length } : undefined;
  }
}

/** Leaf blocks whose text is read inline; indented code too, read as prose (D4). */
const INLINE_SCOPE_TYPES: ReadonlySet<string> = new Set(['paragraph', 'heading', 'text', 'html', 'code']);

function contentLines(raw: string): string[] {
  return raw.replace(/\n+$/, '').split('\n');
}

/**
 * A table row's cells, as column ranges, split on pipes no backslash
 * escapes; empty edge cells are dropped. The last cell is taken however the
 * row ends, a trailing backslash included (the second re-review).
 */
function tableCellStretches(row: string): Array<{ from: number; to: number }> {
  const cells: Array<{ from: number; to: number }> = [];
  const take = (from: number, to: number) => {
    if (row.slice(from, to).trim() !== '') {
      cells.push({ from, to });
    }
  };
  let from = 0;
  for (let index = 0; index < row.length; index++) {
    if (row[index] === '\\') {
      index += 1;
    } else if (row[index] === '|') {
      take(from, index);
      from = index + 1;
    }
  }
  take(from, row.length);
  return cells;
}

/** The last index of `sorted` whose value is at most `value`. */
function lastAtOrBefore(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (sorted[middle] <= value) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

function nestsTooDeeply(lines: readonly SourceLine[]): boolean {
  return lines.some((line) => {
    // A list's indentation counts inside block quotes too (the second re-review).
    const quotes = QUOTE_MARKERS.exec(line.content)![0];
    const indent = LIST_MARKER.exec(line.content.slice(quotes.length))?.[1];
    return containerMarkers(line.content) > MAX_CONTAINER_DEPTH
      || (indent !== undefined && indent.replace(/\t/g, '    ').length > MAX_LIST_INDENT);
  });
}

/** How many container markers open `line`, quotes and list items alike, counting no further than one past the limit. */
function containerMarkers(line: string): number {
  CONTAINER_MARKER.lastIndex = 0;
  let count = 0;
  while (count <= MAX_CONTAINER_DEPTH && CONTAINER_MARKER.exec(line)) {
    count += 1;
  }
  return count;
}

function isProtectedBlock(token: Token): boolean {
  if (token.type === 'code') {
    return (token as Tokens.Code).codeBlockStyle !== 'indented';
  }
  if (token.type === 'def') {
    return true;
  }
  return token.type === 'html' && (token as Tokens.HTML).block && RAW_CODE_BLOCK.test(token.raw);
}

function newlines(text: string): number {
  let count = 0;
  for (let index = text.indexOf('\n'); index !== -1; index = text.indexOf('\n', index + 1)) {
    count += 1;
  }
  return count;
}

/** The line, counted from a token's first, on which its text ends (its trailing line endings aside). */
function lastLineOffset(raw: string): number {
  return newlines(raw.replace(/\n+$/, ''));
}
