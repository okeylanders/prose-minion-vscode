/**
 * Folded text search: one rule for "these two pieces of text match, ignoring
 * case and accents", shared by the host and the webview so a search that runs
 * on both sides (the Dictionary history's, ADR 2026-10-14's search amendment)
 * can never disagree with itself.
 *
 * The fold works one code point at a time, so `fold(a + b)` is always
 * `fold(a) + fold(b)`:
 *
 * - any whitespace character becomes one space (runs are not collapsed, so
 *   offsets stay honest);
 * - a letter is lower-cased, decomposed (NFD) and stripped of its combining
 *   marks, so `É`, `é` and `e` + U+0301 all fold to `e`;
 * - everything else stands as written.
 *
 * Matching is plain substring search over folded text. No pattern is ever
 * built from a query, so there is nothing to escape and nothing to backtrack.
 */

/** A half-open range of UTF-16 offsets into the text as written. */
export interface TextRange {
  start: number;
  end: number;
}

const WHITESPACE = /\s/g;
/** Every code point the fold can change once whitespace is a space. */
const FOLDABLE = /[A-Z]|[^\x00-\x7f]/gu;
const COMBINING_MARKS = /\p{M}+/gu;

function foldCodePoint(codePoint: string): string {
  return codePoint.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '');
}

/** The text with case and accents folded away; see the module comment. */
export function foldSearchText(text: string): string {
  return text.replace(WHITESPACE, ' ').replace(FOLDABLE, foldCodePoint);
}

/**
 * A query as it is searched: whitespace collapsed and trimmed, kept to
 * `maxCharacters` code points, then folded. `''` means "no query".
 */
export function foldSearchQuery(query: string, maxCharacters: number): string {
  const collapsed = query.replace(/\s+/g, ' ').trim();
  const clipped = Array.from(collapsed).slice(0, Math.max(0, maxCharacters)).join('').trim();
  return foldSearchText(clipped);
}

/** Whether `text` holds the folded query. An empty query matches nothing. */
export function foldedTextIncludes(text: string, foldedQuery: string): boolean {
  return foldedQuery.length > 0 && foldSearchText(text).includes(foldedQuery);
}

/** How many folded characters one code point of the text as written becomes. */
function foldedLengthOf(codePoint: string): number {
  if (codePoint.length === 1 && (codePoint.charCodeAt(0) < 0x80 || codePoint.trim() === '')) {
    return 1;
  }
  return foldCodePoint(codePoint).length;
}

/**
 * Turn ranges of the folded text (ascending, not overlapping) back into
 * ranges of the text as written. A range that starts or ends inside one code
 * point's fold takes the whole code point, and a range's end takes in the
 * combining marks written after it, so a marked stretch never splits a letter
 * from its accent. The walk stops once the last range is placed.
 */
function unfoldRanges(text: string, folded: readonly TextRange[]): TextRange[] {
  const placed: TextRange[] = [];
  let next = 0;
  let foldedOffset = 0;
  let open: TextRange | null = null;
  let closing = false;

  for (let offset = 0; offset < text.length && (next < folded.length || open !== null);) {
    const codePoint = String.fromCodePoint(text.codePointAt(offset) as number);
    const width = foldedLengthOf(codePoint);
    const foldedEnd = foldedOffset + width;
    const writtenEnd = offset + codePoint.length;

    if (open !== null && closing) {
      if (width === 0) {
        open.end = writtenEnd;
      } else {
        placed.push(open);
        open = null;
        closing = false;
      }
    }
    if (open === null && next < folded.length && width > 0 && foldedEnd > folded[next].start) {
      open = { start: offset, end: writtenEnd };
    }
    if (open !== null && !closing && width > 0 && foldedEnd >= folded[next].end) {
      open.end = writtenEnd;
      closing = true;
      next += 1;
    }

    foldedOffset = foldedEnd;
    offset = writtenEnd;
  }
  if (open !== null) {
    placed.push(open);
  }
  return placed;
}

/**
 * Where the folded query stands in `text`, as ranges of the text as written:
 * every occurrence, left to right, none overlapping, at most `limit` of them.
 */
export function findFoldedMatches(text: string, foldedQuery: string, limit = Infinity): TextRange[] {
  if (foldedQuery.length === 0 || limit <= 0) {
    return [];
  }
  const foldedText = foldSearchText(text);
  const found: TextRange[] = [];
  for (let from = 0; found.length < limit;) {
    const start = foldedText.indexOf(foldedQuery, from);
    if (start < 0) {
      break;
    }
    found.push({ start, end: start + foldedQuery.length });
    from = start + foldedQuery.length;
  }
  return found.length === 0 ? [] : unfoldRanges(text, found);
}
