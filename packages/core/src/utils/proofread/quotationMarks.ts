/**
 * Quotation marks (Draft Edit Slice 3b, part 3; ADR 2026-10-21, Amendment
 * 2026-10-26): a double quotation mark its paragraph leaves unpaired, found
 * by host code over the whole document, never by a model. Pure, and linear
 * in the text.
 *
 * Read paragraph by paragraph (the blank-line rule,
 * `splitBlankLineParagraphs`), with marks inside the skipped regions
 * (protected text) set aside:
 * - **A mark's role.** Its place decides when it is plain: nothing written
 *   before it (a paragraph's start, a space, an opening bracket or a dash)
 *   and something after, it opens; something before and nothing after (a
 *   space, the paragraph's end, a closing bracket or punctuation), it
 *   closes. Otherwise “ opens, ” closes, and a straight " closes an open
 *   quotation or opens one. The two styles close each other (“Hello," she
 *   said), as the dialogue rule reads them.
 * - **Emphasis is read past** (PR #182 F-03). A place is read beyond the
 *   `*` and `_` written beside a mark, so `*“...and then?”*` places its
 *   marks as `“...and then?”` does, and a paragraph's first mark is placed
 *   by the same rule when it decides whether speech goes on.
 * - **A curly mark of the wrong shape** (a ” where a quotation opens, a “
 *   where one closes) is flagged, and read as the mark its place calls for,
 *   so one slip makes one flag and the paragraph's later quotations read
 *   true.
 * - **Unpaired:** a quotation that opens while another is open (the earlier
 *   one is flagged); a closing mark with nothing open; a quotation still open
 *   at its paragraph's end, unless the next paragraph opens with a quotation
 *   mark, as speech running over several paragraphs does.
 *
 * Each mark is flagged at most once. Not read: single quotation marks, which
 * apostrophes outnumber with no character rule to tell them apart (the
 * dialogue rule's reason); guillemets and low-9 marks. A straight " after a
 * number (an inch mark) is read as a quotation mark: the stated limit.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import { splitBlankLineParagraphs, type BlankLineParagraph } from '@/utils/blankLineParagraphs';

export type QuotationSlipKind =
  /** Still open where its paragraph ends, and the next paragraph does not open with a quotation mark. */
  | 'unclosed'
  /** Still open where the next quotation opens. */
  | 'unclosed-before-next'
  /** A closing mark with nothing open. */
  | 'unopened'
  /** A ” where a quotation opens. */
  | 'closing-mark-opens'
  /** A “ where a quotation closes. */
  | 'opening-mark-closes';

/** One mark a paragraph leaves unpaired or misshapes. */
export interface QuotationSlip {
  readonly start: number;
  /** `start + 1`: a mark is one character. */
  readonly end: number;
  readonly mark: string;
  readonly kind: QuotationSlipKind;
}

type Role = 'open' | 'close';

const OPENING = '“';
const CLOSING = '”';
const STRAIGHT = '"';
/** Nothing written before a mark here. */
const OPENS_AFTER = /[\s([{>—–]/u;
/** Nothing written after a mark here. */
const CLOSES_BEFORE = /[\s.,;:!?)\]}…—–]/u;
/** What may stand before a paragraph's first quotation mark: a block quote's marker, emphasis. */
const LEADING_MARKUP = /[\s>*_]/u;

/** The marks `text`'s paragraphs leave unpaired or misshape, in order. `skippedRegions` are never read. */
export function findQuotationSlips(text: string, skippedRegions: readonly TextRange[]): QuotationSlip[] {
  const paragraphs = splitBlankLineParagraphs(text);
  // Each walk asks its regions in ascending order, so each has its own.
  const atStarts = new SkippedRegions(skippedRegions);
  const opensQuoting = paragraphs.map((paragraph) => opensWithQuotation(text, paragraph, atStarts));
  const skipped = new SkippedRegions(skippedRegions);
  return paragraphs.flatMap((paragraph, index) => readParagraph(text, paragraph, skipped, opensQuoting[index + 1] ?? false));
}

/** One paragraph's slips, in order. `continues`: the next paragraph opens with a quotation mark. */
function readParagraph(text: string, paragraph: BlankLineParagraph, skipped: SkippedRegions, continues: boolean): QuotationSlip[] {
  const slips: QuotationSlip[] = [];
  const flagged = new Set<number>();
  const flag = (at: number, kind: QuotationSlipKind): void => {
    if (!flagged.has(at)) {
      flagged.add(at);
      slips.push({ start: at, end: at + 1, mark: text[at], kind });
    }
  };
  let open: number | undefined;
  // Character by character within the paragraph: a search for the next mark could run on past its end.
  for (let at = paragraph.start; at < paragraph.end; at += 1) {
    const mark = text[at];
    if ((mark !== STRAIGHT && mark !== OPENING && mark !== CLOSING) || skipped.contains(at)) {
      continue;
    }
    const place = placeOf(text, at, paragraph);
    let role: Role;
    if (mark === OPENING) {
      role = place === 'close' ? 'close' : 'open';
      if (place === 'close') {
        flag(at, 'opening-mark-closes');
      }
    } else if (mark === CLOSING) {
      role = place === 'open' ? 'open' : 'close';
      if (place === 'open') {
        flag(at, 'closing-mark-opens');
      }
    } else {
      role = place ?? (open === undefined ? 'open' : 'close');
    }
    if (role === 'open') {
      if (open !== undefined) {
        flag(open, 'unclosed-before-next');
      }
      open = at;
    } else if (open === undefined) {
      flag(at, 'unopened');
    } else {
      open = undefined;
    }
  }
  if (open !== undefined && !continues) {
    flag(open, 'unclosed');
  }
  // An earlier mark is flagged once a later one shows it never closed.
  return slips.sort((a, b) => a.start - b.start);
}

/** What a mark's place says of it, when it says anything, read past the emphasis beside it. */
function placeOf(text: string, at: number, paragraph: BlankLineParagraph): Role | undefined {
  let before = at - 1;
  while (before >= paragraph.start && isEmphasis(text[before])) {
    before -= 1;
  }
  let after = at + 1;
  while (after < paragraph.end && isEmphasis(text[after])) {
    after += 1;
  }
  const opens = before < paragraph.start || OPENS_AFTER.test(text[before]);
  const closes = after >= paragraph.end || CLOSES_BEFORE.test(text[after]);
  return opens && !closes ? 'open' : closes && !opens ? 'close' : undefined;
}

/**
 * Emphasis's markers. A run of them is read only by the marks beside it,
 * each placed at most twice (a paragraph's first mark by the continuation
 * check too), so the walk stays linear.
 */
function isEmphasis(character: string): boolean {
  return character === '*' || character === '_';
}

/** Whether `paragraph` opens with a quotation mark that opens a quotation: speech going on from the paragraph before. */
function opensWithQuotation(text: string, paragraph: BlankLineParagraph, skipped: SkippedRegions): boolean {
  let at = paragraph.start;
  while (at < paragraph.end && LEADING_MARKUP.test(text[at])) {
    at += 1;
  }
  const mark = text[at];
  if (at >= paragraph.end || skipped.contains(at) || (mark !== STRAIGHT && mark !== OPENING && mark !== CLOSING)) {
    return false;
  }
  // The role `readParagraph` gives a first mark: with nothing written before it, only a ” its place leaves undecided closes.
  return mark !== CLOSING || placeOf(text, at, paragraph) === 'open';
}

/** The skipped regions, asked in ascending order: one walk over them in all. */
class SkippedRegions {
  private readonly regions: readonly TextRange[];
  private next = 0;

  constructor(regions: readonly TextRange[]) {
    this.regions = [...regions].sort((a, b) => a.start - b.start);
  }

  /** Whether `at` lies in a region; `at` never decreases between calls. */
  contains(at: number): boolean {
    while (this.next < this.regions.length && this.regions[this.next].end <= at) {
      this.next += 1;
    }
    for (let index = this.next; index < this.regions.length && this.regions[index].start <= at; index += 1) {
      if (this.regions[index].end > at) {
        return true;
      }
    }
    return false;
  }
}
