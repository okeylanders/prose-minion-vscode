/**
 * Markdown's inline protected regions (ADR 2026-10-21 D4; PR #171 F-02):
 * code spans; link and image destinations; autolinks, URI and email; raw
 * HTML (tags with their attributes, comments, processing instructions,
 * declarations, CDATA); and GFM's bare URLs, `www.` links and email
 * addresses.
 *
 * It reads one inline scope at a time (`markdownBlockRegions`): one leaf
 * block or table cell, container prefixes stripped, so nothing pairs across
 * blocks and no `>` of a block quote is read as markup (the re-review).
 *
 * One left-to-right pass in CommonMark's precedence: the construct that
 * starts first wins, so a backtick inside a tag's quoted attribute or a
 * comment never opens a code span that would take a later span's opener.
 * - Backslash escapes are honored outside code.
 * - A code span is a maximal backtick run closed by the next run of the same
 *   length, never across a blank line (indented code, read as prose, can
 *   hold one); an unmatched run is literal.
 * - A link destination may hold balanced or escaped parentheses, at most
 *   `MAX_LINK_PAREN_DEPTH` deep, or be `<…>`, or be empty before a title. It
 *   and its title may follow a line break.
 * - A tag's attribute values may hold `>` when quoted.
 * GFM's bare links pair with nothing, so they have their own pass.
 *
 * Where it is unsure it protects more, never less: text read as protected is
 * never sent or flagged. Every step moves forward, and no attempt rescans
 * more than a bounded stretch.
 */

import type { TextRange } from '@/domain/models/DraftEdit';

const ASCII_PUNCTUATION = /[!-/:-@[-`{-~]/;
const URI_AUTOLINK = /<[A-Za-z][A-Za-z0-9+.-]{1,31}:[^\s<>\x00-\x1f]*>/y;
const EMAIL_AUTOLINK = /<[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*>/y;
const CLOSING_TAG = /<\/[A-Za-z][A-Za-z0-9-]*\s*>/y;
const BARE_LINKS: readonly RegExp[] = [
  /\b(?:https?|ftp):\/\/[^\s<>]+/gi,
  /\bwww\.[^\s<>]+/gi,
  /(?<![A-Za-z0-9._+-])[A-Za-z0-9._+-]+@[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)+/g
];
const BLANK_LINE = /^[ \t]*$/;
/** How deeply a link destination's parentheses may nest; CommonMark's reference parser stops at the same depth. */
const MAX_LINK_PAREN_DEPTH = 32;

/** Every inline protected region of `segment` (one inline scope), in segment offsets; may overlap. */
export function findMarkdownInlineRegions(segment: string): TextRange[] {
  const scan = new InlineScan(segment);
  return [...scan.run(), ...bareLinks(segment)];
}

class InlineScan {
  private readonly regions: TextRange[] = [];
  /** Starts of maximal backtick runs, by run length. */
  private readonly runsByLength = new Map<number, number[]>();
  /** Offsets nothing inline may run past: each blank line's start, ascending. */
  private readonly breaks: number[] = [];

  constructor(private readonly s: string) {
    for (let index = 0; index < s.length;) {
      if (s[index] !== '`') {
        index += 1;
        continue;
      }
      const end = runEnd(s, index);
      const starts = this.runsByLength.get(end - index) ?? [];
      starts.push(index);
      this.runsByLength.set(end - index, starts);
      index = end;
    }
    for (let start = 0; start <= s.length;) {
      const newline = s.indexOf('\n', start);
      const end = newline === -1 ? s.length : newline;
      if (start > 0 && BLANK_LINE.test(s.slice(start, end).replace(/\r$/, ''))) {
        this.breaks.push(start);
      }
      if (newline === -1) {
        break;
      }
      start = newline + 1;
    }
  }

  run(): TextRange[] {
    const s = this.s;
    let index = 0;
    while (index < s.length) {
      const char = s[index];
      let end: number | undefined;
      if (char === '\\' && ASCII_PUNCTUATION.test(s[index + 1] ?? '')) {
        // Escaped: never an opener. An escaped backtick leaves the rest of its run to open.
        index += 2;
        continue;
      }
      if (char === '`') {
        const opener = runEnd(s, index);
        const closer = this.closerOf(opener - index, opener);
        if (closer === undefined) {
          index = opener;
          continue;
        }
        end = closer;
      } else if (char === '<') {
        end = rawHtmlOrAutolinkEnd(s, index);
      } else if (char === ']' && s[index + 1] === '(') {
        // Keep the `]`: it closes the link text, which is prose.
        const destination = linkDestinationEnd(s, index + 1);
        if (destination !== undefined) {
          this.regions.push({ start: index + 1, end: destination });
          index = destination;
          continue;
        }
      }
      if (end !== undefined) {
        this.regions.push({ start: index, end });
        index = end;
      } else {
        index += 1;
      }
    }
    return this.regions;
  }

  /** The end of the code span an opener of `length` backticks, ending at `from`, closes; undefined when nothing closes it. */
  private closerOf(length: number, from: number): number | undefined {
    const starts = this.runsByLength.get(length);
    if (!starts) {
      return undefined;
    }
    const at = firstAtOrAfter(starts, from);
    if (at === starts.length) {
      return undefined;
    }
    const next = this.breaks[firstAtOrAfter(this.breaks, from)];
    return next === undefined || starts[at] < next ? starts[at] + length : undefined;
  }
}

function runEnd(s: string, index: number): number {
  let end = index;
  while (s[end] === '`') {
    end += 1;
  }
  return end;
}

/** The first index of `sorted` whose value is at least `value` (`sorted.length` when none is). */
function firstAtOrAfter(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < value) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }
  return low;
}

function sticky(pattern: RegExp, s: string, index: number): number | undefined {
  pattern.lastIndex = index;
  const match = pattern.exec(s);
  return match ? index + match[0].length : undefined;
}

/** The end of the autolink or raw HTML starting at `index` (a `<`), or undefined when none does. */
function rawHtmlOrAutolinkEnd(s: string, index: number): number | undefined {
  const autolink = sticky(URI_AUTOLINK, s, index) ?? sticky(EMAIL_AUTOLINK, s, index);
  if (autolink !== undefined) {
    return autolink;
  }
  if (s.startsWith('<!--', index)) {
    if (s.startsWith('<!-->', index)) {
      return index + 5;
    }
    if (s.startsWith('<!--->', index)) {
      return index + 6;
    }
    // An unclosed comment runs on, as a comment block does.
    const close = s.indexOf('-->', index + 4);
    return close === -1 ? s.length : close + 3;
  }
  if (s.startsWith('<![CDATA[', index)) {
    return closedBy(s, ']]>', index + 9);
  }
  if (s.startsWith('<?', index)) {
    return closedBy(s, '?>', index + 2);
  }
  if (s[index + 1] === '!' && /[A-Za-z]/.test(s[index + 2] ?? '')) {
    return closedBy(s, '>', index + 2);
  }
  return sticky(CLOSING_TAG, s, index) ?? openTagEnd(s, index);
}

function closedBy(s: string, closer: string, from: number): number | undefined {
  const at = s.indexOf(closer, from);
  return at === -1 ? undefined : at + closer.length;
}

const isSpace = (char: string | undefined) => char === ' ' || char === '\t' || char === '\n' || char === '\r';

function skipSpaces(s: string, index: number): number {
  let at = index;
  while (isSpace(s[at])) {
    at += 1;
  }
  return at;
}

/** An open tag (`<name attr="v" …>` or `…/>`), read by CommonMark's grammar; its end, or undefined. */
function openTagEnd(s: string, index: number): number | undefined {
  let at = index + 1;
  if (!/[A-Za-z]/.test(s[at] ?? '')) {
    return undefined;
  }
  while (/[A-Za-z0-9-]/.test(s[at] ?? '')) {
    at += 1;
  }
  for (;;) {
    const spaced = skipSpaces(s, at);
    if (s[spaced] === '>') {
      return spaced + 1;
    }
    if (s[spaced] === '/' && s[spaced + 1] === '>') {
      return spaced + 2;
    }
    // An attribute: whitespace, then a name.
    if (spaced === at || !/[A-Za-z_:]/.test(s[spaced] ?? '')) {
      return undefined;
    }
    at = spaced + 1;
    while (/[A-Za-z0-9_.:-]/.test(s[at] ?? '')) {
      at += 1;
    }
    const equals = skipSpaces(s, at);
    if (s[equals] !== '=') {
      continue;
    }
    const value = skipSpaces(s, equals + 1);
    const quote = s[value];
    if (quote === '"' || quote === "'") {
      const close = s.indexOf(quote, value + 1);
      if (close === -1) {
        return undefined;
      }
      at = close + 1;
    } else {
      at = value;
      while (at < s.length && !/[\s"'=<>`]/.test(s[at])) {
        at += 1;
      }
      if (at === value) {
        return undefined;
      }
    }
  }
}

/**
 * Spaces and tabs, then at most one line ending, then the next line's
 * container prefix and indentation. Undefined when that next line is blank:
 * nothing inline crosses a paragraph break.
 */
function skipLinkSpacing(s: string, index: number): number | undefined {
  let at = index;
  while (s[at] === ' ' || s[at] === '\t') {
    at += 1;
  }
  if (s[at] === '\r' && s[at + 1] === '\n') {
    at += 1;
  }
  if (s[at] !== '\n' && s[at] !== '\r') {
    return at;
  }
  at += 1;
  while (s[at] === ' ' || s[at] === '\t') {
    at += 1;
  }
  return at >= s.length || s[at] === '\n' || s[at] === '\r' ? undefined : at;
}

/** The end of a link destination and optional title, `(` at `open` through its `)`; undefined when it is not one. */
function linkDestinationEnd(s: string, open: number): number | undefined {
  const start = skipLinkSpacing(s, open + 1);
  if (start === undefined) {
    return undefined;
  }
  const destination = linkDestination(s, start);
  return (destination !== undefined ? linkTail(s, destination, false) : undefined)
    // `marked` also reads an empty destination before a title, `[label]( "title")`: protect that reading too.
    ?? linkTail(s, start, true);
}

/** Where a destination starting at `at` ends, `<…>` or bare; undefined when none does. */
function linkDestination(s: string, start: number): number | undefined {
  let at = start;
  if (s[at] === '<') {
    at += 1;
    while (at < s.length && s[at] !== '>') {
      if (s[at] === '\n' || s[at] === '\r' || s[at] === '<') {
        return undefined;
      }
      at += s[at] === '\\' ? 2 : 1;
    }
    return s[at] === '>' ? at + 1 : undefined;
  }
  let depth = 0;
  while (at < s.length) {
    const char = s[at];
    if (char === '\\' && ASCII_PUNCTUATION.test(s[at + 1] ?? '')) {
      at += 2;
      continue;
    }
    if (char === '(') {
      if (++depth > MAX_LINK_PAREN_DEPTH) {
        return undefined;
      }
    } else if (char === ')') {
      if (depth === 0) {
        break;
      }
      depth -= 1;
    } else if (char <= ' ' || char === '\x7f') {
      break;
    }
    at += 1;
  }
  return depth === 0 ? at : undefined;
}

/** An optional title, then `)`, after a destination ending at `at`; `titleHere`: the title may open at `at` itself. */
function linkTail(s: string, at: number, titleHere: boolean): number | undefined {
  let end = at;
  const titleStart = skipLinkSpacing(s, at);
  if (titleStart !== undefined && (titleHere || titleStart > at) && `"'(`.includes(s[titleStart] ?? '\0')) {
    const titleEnd = linkTitleEnd(s, titleStart);
    if (titleEnd === undefined) {
      return undefined;
    }
    end = titleEnd;
  }
  const close = skipLinkSpacing(s, end);
  return close !== undefined && s[close] === ')' ? close + 1 : undefined;
}

/** The end of a link title opened at `open` (`"`, `'`, or `(`), never across a blank line. */
function linkTitleEnd(s: string, open: number): number | undefined {
  const closer = s[open] === '(' ? ')' : s[open];
  let at = open + 1;
  while (at < s.length) {
    const char = s[at];
    if (char === '\\') {
      at += 2;
      continue;
    }
    if (char === closer) {
      return at + 1;
    }
    if (closer === ')' && char === '(') {
      return undefined;
    }
    if (char === '\n' && skipLinkSpacing(s, at) === undefined) {
      return undefined;
    }
    at += 1;
  }
  return undefined;
}

function bareLinks(segment: string): TextRange[] {
  const regions: TextRange[] = [];
  for (const pattern of BARE_LINKS) {
    pattern.lastIndex = 0;
    for (let match = pattern.exec(segment); match; match = pattern.exec(segment)) {
      regions.push({ start: match.index, end: match.index + match[0].length });
    }
  }
  return regions;
}
