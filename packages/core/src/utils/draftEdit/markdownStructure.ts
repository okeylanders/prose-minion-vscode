/**
 * Whether edits leave a Markdown document's structure as it was (PR #172
 * F-03). A fix may change the text of a paragraph, never what the paragraph
 * is: `< Rabbit >` → `<Rabbit>` makes an HTML tag of prose, a backtick and a
 * space become a fence opener when the space goes, `htps://` becomes a link
 * when it is spelled right, and `[Alcie]` becomes a reference link when the
 * document defines `[alice]`. Counting markup characters sees none of these.
 *
 * So each top-level block an edit touches is lexed by `marked` before and
 * after the edits, its inline content with the document's own link
 * definitions, and the two must have the same shape: the same token types,
 * nested the same way, with the same heading depths, list kinds and table
 * sizes. Text content is not compared; that is what a fix changes.
 *
 * - The edits are tried together first (two can make structure neither makes
 *   alone). When a block's shape moves, its edits are taken in order, each
 *   kept only if the block keeps its shape with it and those kept before it,
 *   so an edit that moves the shape, alone or with another, is refused, and
 *   the rest of the block's fixes still land.
 * - A block too long to lex quickly is not verified, and its edits are
 *   refused: unsure is never "unchanged".
 * - Plain text has no structure, so nothing is refused there.
 */

import { Lexer, getDefaults, type Links, type Token, type Tokens } from 'marked';

/** One edit, in offsets of `text`; edits do not overlap. */
export interface StructureEdit {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
}

/** The longest stretch of blocks verified; past it, edits are refused rather than read slowly. */
export const MAX_VERIFIED_BLOCK_LENGTH = 50_000;

/** The indices of `edits` that would change the document's Markdown structure. */
export function editsChangingStructure(text: string, languageId: string, edits: readonly StructureEdit[]): Set<number> {
  const refused = new Set<number>();
  if (languageId !== 'markdown' || edits.length === 0) {
    return refused;
  }
  const document = lexDocument(text);
  for (const span of affectedSpans(document.blocks, edits)) {
    const members = span.edits;
    if (span.end - span.start > MAX_VERIFIED_BLOCK_LENGTH) {
      members.forEach((index) => refused.add(index));
      continue;
    }
    const before = shapeOf(text.slice(span.start, span.end), document.links);
    const keeps = (indices: readonly number[]) => shapeOf(applyWithin(text, span, indices.map((index) => edits[index])), document.links) === before;
    if (keeps(members)) {
      continue;
    }
    // Some edit, or some pair, moves the shape: keep each edit, in order, that leaves it as it was with those kept before it.
    const kept: number[] = [];
    for (const index of members) {
      if (keeps([...kept, index])) {
        kept.push(index);
      } else {
        refused.add(index);
      }
    }
  }
  return refused;
}

interface Block {
  readonly start: number;
  readonly end: number;
}

interface LexedDocument {
  readonly blocks: readonly Block[];
  readonly links: Links;
}

/** The document's top-level blocks, by offset, and its link definitions. */
function lexDocument(text: string): LexedDocument {
  const lexer = new Lexer(getDefaults());
  const tokens = lexer.blockTokens(text);
  const blocks: Block[] = [];
  let at = 0;
  for (const token of tokens) {
    blocks.push({ start: at, end: at + token.raw.length });
    at += token.raw.length;
  }
  // `marked` keeps a block's raw source; if the raws do not add up to the text, read it as one block.
  return { blocks: at === text.length ? blocks : [{ start: 0, end: text.length }], links: lexer.tokens.links };
}

interface Span {
  readonly start: number;
  readonly end: number;
  readonly edits: number[];
}

/** The blocks each edit touches, joined where they meet, with the edits inside each. */
function affectedSpans(blocks: readonly Block[], edits: readonly StructureEdit[]): Span[] {
  const spans: Span[] = [];
  const order = edits.map((_, index) => index).sort((a, b) => edits[a].start - edits[b].start);
  for (const index of order) {
    const edit = edits[index];
    // Edges included: an edit at a block's end changes how that block ends.
    const touched = blocks.filter((block) => block.start <= edit.end && edit.start <= block.end);
    const start = Math.min(edit.start, ...touched.map((block) => block.start));
    const end = Math.max(edit.end, ...touched.map((block) => block.end));
    const last = spans[spans.length - 1];
    if (last && start <= last.end) {
      spans[spans.length - 1] = { start: last.start, end: Math.max(last.end, end), edits: [...last.edits, index] };
    } else {
      spans.push({ start, end, edits: [index] });
    }
  }
  return spans;
}

/** The span's text with `edits` applied. */
function applyWithin(text: string, span: Span, edits: readonly StructureEdit[]): string {
  let result = text.slice(span.start, span.end);
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start - span.start) + edit.replacement + result.slice(edit.end - span.start);
  }
  return result;
}

/** A stretch of Markdown's shape: its tokens' types and structure, never their text. */
function shapeOf(source: string, links: Links): string {
  const lexer = new Lexer(getDefaults());
  // A fresh lexer per read (tokens accumulate on one), sharing the document's definitions.
  lexer.tokens.links = { ...links };
  return describe(lexer.lex(source));
}

function describe(tokens: readonly Token[]): string {
  const parts: string[] = [];
  for (const token of tokens) {
    const part = describeToken(token);
    // Adjacent text runs are one: how `marked` splits plain text is not structure.
    if (part === 'text' && parts[parts.length - 1] === 'text') {
      continue;
    }
    parts.push(part);
  }
  return parts.join(',');
}

function describeToken(token: Token): string {
  switch (token.type) {
    case 'heading':
      return `heading${(token as Tokens.Heading).depth}(${describe((token as Tokens.Heading).tokens)})`;
    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item) => `${item.task ? (item.checked ? 'done' : 'task') : 'item'}(${describe(item.tokens)})`).join('|');
      return `list${list.ordered ? 'ol' : 'ul'}${list.loose ? 'loose' : ''}[${items}]`;
    }
    case 'table': {
      // Every cell's inline shape, header and body: a tag or a link made inside a cell keeps the table's size (PR #172 F-03 re-review).
      const table = token as Tokens.Table;
      const cells = (row: readonly Tokens.TableCell[]) => row.map((cell) => `cell(${describe(cell.tokens)})`).join('|');
      return `table[${table.align.map((align) => align ?? 'none').join('|')}](${cells(table.header)})[${table.rows.map(cells).join('/')}]`;
    }
    case 'text': {
      const text = token as Tokens.Text;
      return text.tokens && text.tokens.some((child) => child.type !== 'text') ? `text(${describe(text.tokens)})` : 'text';
    }
    default: {
      const nested = 'tokens' in token && Array.isArray(token.tokens) ? `(${describe(token.tokens as Token[])})` : '';
      return `${token.type}${nested}`;
    }
  }
}
