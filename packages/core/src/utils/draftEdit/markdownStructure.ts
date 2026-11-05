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
 * sizes, and every link and image going where it went, by its resolved
 * destination and title (PR #183 F-01: `[teh]` → `[the]` is still a link, to
 * another definition). Text content is not compared; that is what a fix
 * changes.
 *
 * - The edits are tried together first (two can make structure neither makes
 *   alone). When a block's shape moves, its edits are taken in order, each
 *   kept only if the block keeps its shape with it and those kept before it,
 *   so an edit that moves the shape, alone or with another, is refused, and
 *   the rest of the block's fixes still land.
 * - A block too long to lex quickly is not verified, and its edits are
 *   refused: unsure is never "unchanged".
 * - Plain text has no structure, so nothing is refused there.
 * - **`prose-paragraphs`** (persona edits to prose, ADR 2026-11-05 D5): a
 *   run of top-level paragraphs, blank lines between, reads as one paragraph
 *   whose inline shape is theirs in order, and emphasis and strong read as
 *   their text, so plain paragraphs may split, merge, appear or go and prose
 *   may take italics, while a heading, list, quote, fence, table, break,
 *   HTML block, or a link, image, code span, autolink or inline HTML (as
 *   `strict` reads them) still moves it. Proofread and Craft Flags read
 *   `strict`, the default.
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
export interface StructureOptions {
  readonly mode?: 'strict' | 'prose-paragraphs';
}

export function editsChangingStructure(
  text: string,
  languageId: string,
  edits: readonly StructureEdit[],
  options: StructureOptions = {}
): Set<number> {
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
    const before = shapeOf(text.slice(span.start, span.end), document.links, options);
    const keeps = (indices: readonly number[]) =>
      shapeOf(applyWithin(text, span, indices.map((index) => edits[index])), document.links, options) === before;
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
function shapeOf(source: string, links: Links, options: StructureOptions): string {
  const lexer = new Lexer(getDefaults());
  // A fresh lexer per read (tokens accumulate on one), sharing the document's definitions.
  lexer.tokens.links = { ...links };
  const tokens = lexer.lex(source);
  return options.mode === 'prose-paragraphs' ? describe(joinParagraphRuns(tokens), true) : describe(tokens);
}

/** Top-level runs of paragraphs, blank lines between, as one paragraph holding their inline tokens in order. */
function joinParagraphRuns(tokens: readonly Token[]): Token[] {
  const joined: Token[] = [];
  let run: Token[] | undefined;
  for (const token of tokens) {
    if (token.type === 'space') {
      continue;
    }
    if (token.type === 'paragraph') {
      if (!run) {
        run = [];
        joined.push({ type: 'paragraph', raw: '', text: '', tokens: run } as Tokens.Paragraph);
      }
      run.push(...((token as Tokens.Paragraph).tokens ?? []));
      continue;
    }
    run = undefined;
    joined.push(token);
  }
  return joined;
}

/** `prose`: emphasis and strong are their text (`prose-paragraphs`). */
function describe(tokens: readonly Token[], prose = false): string {
  return describeParts(tokens, prose).join(',');
}

function describeParts(tokens: readonly Token[], prose: boolean): string[] {
  const parts: string[] = [];
  for (const token of tokens) {
    const own = prose && (token.type === 'em' || token.type === 'strong')
      ? describeParts((token as Tokens.Em | Tokens.Strong).tokens ?? [], prose)
      : [describeToken(token, prose)];
    for (const part of own) {
      // Adjacent text runs are one: how `marked` splits plain text is not structure.
      if (part === 'text' && parts[parts.length - 1] === 'text') {
        continue;
      }
      parts.push(part);
    }
  }
  return parts;
}

function describeToken(token: Token, prose = false): string {
  switch (token.type) {
    case 'heading':
      return `heading${(token as Tokens.Heading).depth}(${describe((token as Tokens.Heading).tokens, prose)})`;
    case 'list': {
      const list = token as Tokens.List;
      const items = list.items.map((item) => `${item.task ? (item.checked ? 'done' : 'task') : 'item'}(${describe(item.tokens, prose)})`).join('|');
      return `list${list.ordered ? 'ol' : 'ul'}${list.loose ? 'loose' : ''}[${items}]`;
    }
    case 'table': {
      // Every cell's inline shape, header and body: a tag or a link made inside a cell keeps the table's size (PR #172 F-03 re-review).
      const table = token as Tokens.Table;
      const cells = (row: readonly Tokens.TableCell[]) => row.map((cell) => `cell(${describe(cell.tokens, prose)})`).join('|');
      return `table[${table.align.map((align) => align ?? 'none').join('|')}](${cells(table.header)})[${table.rows.map(cells).join('/')}]`;
    }
    case 'link':
    case 'image': {
      // Where it goes is not prose: a fix to a reference's label can resolve it to another definition (PR #183 F-01).
      const link = token as Tokens.Link | Tokens.Image;
      const target = JSON.stringify([link.href, link.title ?? null]);
      const nested = Array.isArray(link.tokens) ? `(${describe(link.tokens, prose)})` : '';
      return `${token.type}${target}${nested}`;
    }
    case 'text': {
      const text = token as Tokens.Text;
      if (!text.tokens || !text.tokens.some((child) => child.type !== 'text')) {
        return 'text';
      }
      // In prose, emphasis inside a text run is its text: a run that reads as plain is plain.
      const inner = describe(text.tokens, prose);
      return inner === 'text' ? 'text' : `text(${inner})`;
    }
    default: {
      const nested = 'tokens' in token && Array.isArray(token.tokens) ? `(${describe(token.tokens as Token[], prose)})` : '';
      return `${token.type}${nested}`;
    }
  }
}
