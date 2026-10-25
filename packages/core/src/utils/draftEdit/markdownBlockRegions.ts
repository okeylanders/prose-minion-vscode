/**
 * Markdown's block-level protected regions (ADR 2026-10-21 D4; PR #171
 * F-02): front matter; fenced code, link reference definitions, and raw
 * `<script>` / `<style>` blocks, wherever Markdown's containers put them
 * (block quotes, list items, nested). Block structure is `marked`'s, the
 * parser `markdownFences` already uses, so a fence inside `> ` or under a
 * list marker is found as a renderer finds it.
 *
 * Offsets. `marked` gives each token's raw text, not its offset. At every
 * level a container's children's raw texts make up its content, and that
 * content keeps the container's source lines one for one: it strips prefixes
 * (`> `, a list marker, indentation), never a line. So each token's source
 * lines are exact, and each region is protected as whole source lines. The
 * prefixes those lines carry are syntax, never prose. Every protected block
 * is also checked line by line against the source. A child that does not
 * continue its container's content, or a block whose lines are not where
 * they were computed, fails closed: the whole top-level block around it is
 * protected.
 *
 * Indented code is not protected: writers indent paragraphs with a tab or
 * four spaces, which Markdown reads as code.
 *
 * Depth. `marked`'s work grows with how deeply containers nest. A document
 * nesting block quotes or list items deeper than any manuscript does (past
 * `MAX_QUOTE_DEPTH` markers, or a list marker past `MAX_LIST_INDENT`
 * columns) is not read, and is protected whole, as is one `marked` fails on.
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

const MAX_QUOTE_DEPTH = 32;
const MAX_LIST_INDENT = 64;
const QUOTE_MARKERS = /^(?:[ \t]*>)*/;
const LIST_MARKER = /^([ \t]*)(?:[-+*]|\d{1,9}[.)])(?:[ \t]|$)/;

/** Raw HTML blocks whose content is code, not text. */
const RAW_CODE_BLOCK = /^ {0,3}<(?:script|style)(?=[\s/>]|$)/i;

/** A line that looks like a link reference definition: protected even where Markdown would read it as paragraph text. */
const DEFINITION_LINE = /^ {0,3}(?:>[ \t]?)*[ \t]{0,3}\[[^\]\n]+\]:(.*)$/;

/** Front matter, then every block region `marked` finds, as source ranges. */
export function findMarkdownBlockRegions(text: string): TextRange[] {
  const lines = splitSourceLines(text);
  const regions: TextRange[] = [];
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
    return regions;
  }
  const walker = new BlockWalker(lines, protect);
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
  return regions;
}

class BlockWalker {
  constructor(
    private readonly lines: readonly SourceLine[],
    private readonly protect: (first: number, last: number) => void
  ) {}

  /** Protect what `token`, starting at source line `line`, holds; false when its lines are not where they should be. */
  visit(token: Token, line: number): boolean {
    if (isProtectedBlock(token)) {
      if (!this.matchesSource(token.raw, line)) {
        return false;
      }
      this.protect(line, line + lastLineOffset(token.raw));
      return true;
    }
    if (token.type === 'blockquote') {
      const quote = token as Tokens.Blockquote;
      return this.visitChildren(quote.tokens, quote.text, quote.raw, line);
    }
    if (token.type === 'list') {
      const list = token as Tokens.List;
      let offset = 0;
      for (const item of list.items) {
        if (!list.raw.startsWith(item.raw, offset)) {
          return false;
        }
        if (!this.visitChildren(item.tokens, item.text, item.raw, line + newlines(list.raw.slice(0, offset)))) {
          return false;
        }
        offset += item.raw.length;
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
    return raw.replace(/\n+$/, '').split('\n').every((rawLine, index) => {
      const source = this.lines[line + index];
      return source !== undefined && source.content.endsWith(rawLine.trimStart());
    });
  }
}

function nestsTooDeeply(lines: readonly SourceLine[]): boolean {
  return lines.some((line) => {
    const quotes = QUOTE_MARKERS.exec(line.content)![0];
    if (quotes.split('>').length - 1 > MAX_QUOTE_DEPTH) {
      return true;
    }
    const indent = LIST_MARKER.exec(line.content.slice(quotes.length))?.[1];
    return indent !== undefined && indent.replace(/\t/g, '    ').length > MAX_LIST_INDENT;
  });
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
