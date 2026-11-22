/**
 * What the host keeps of the organizing pass's reply (ADR 2026-11-20 D13).
 * Pure.
 *
 * - **Citations.** A cite is kept only when it names an instance the pass
 *   was shown. A claim left with none is dropped and counted; a section
 *   left with no claim is dropped and counted.
 * - **Quotations.** Any span a claim, a title or the headline puts in
 *   quotation marks must stand inside the source quote (D9a) of an instance
 *   the pass was shown: for a claim, one it cites (and that was kept). A
 *   claim that fails is dropped and counted. A headline that fails is
 *   replaced by the host's ("14 instances in 6 files"); a title that fails
 *   by the host's ("Group 2"). Neither loses its claims.
 *
 * **The invariant** (PR #295 re-reviews): a text passes only when every
 * outermost quotation it shows is checked whole, from its opening mark to
 * its matching closing mark, nested marks and all. Every word inside any
 * outermost quotation stands inside one checked span, and that span stands
 * in a source quote. A sub-span is never checked in place of a quotation,
 * and no rule chooses among readings: where the marks allow more than one,
 * or none, the text fails closed (a claim is dropped; a title or the
 * headline is replaced by the host's).
 *
 * - **Whitespace first.** Before any mark is read the text is put in NFC,
 *   and every whitespace character (each Unicode space separator, a tab, a
 *   line break) becomes one space, runs collapsed. Every structure decision
 *   and every comparison below sees that text.
 * - **Double marks take a role, then pair on a stack.** A curly mark's
 *   shape is its role: `“` opens, `”` closes. A straight mark's role comes
 *   from its neighbours: it opens when the start, a space, opening
 *   punctuation, a dash or an opening mark stands before it and something
 *   not a space after it; it closes when something not a space stands
 *   before it and the end, a space or punctuation after it. A straight mark
 *   that fits both roles, or neither, fails the text. Openers are pushed;
 *   a closer must match the kind on top (straight with straight, `”` with
 *   `“`), and a closer with nothing to match, or an opener left open, fails
 *   the text. When the stack empties, the whole outermost quotation is one
 *   span. So `"She said "meet me" before leaving"` is checked as one span,
 *   and `"a" and "b"` as two.
 * - **Single marks** (`'`, `‘`, `’`), read across the whole text:
 *   - An opening mark is `‘` wherever it stands, or `'` or `’` with no
 *     letter or digit before it. Any other single mark, one after a letter
 *     or digit, is an apostrophe (it’s, the Queen’s, the sailors’) while no
 *     quotation is open.
 *   - Once a mark opens a quotation, the very next single mark must close
 *     it: `'` or `’`, with no space before it and no letter or digit after
 *     it. A single-quoted quotation outside double marks is one span,
 *     checked whole; one inside double marks is part of theirs.
 *   - Anything else is ambiguous, and fails the text: no close at all; a
 *     next single mark that cannot close (an apostrophe or an opening mark
 *     inside the span, a space before it, a letter or digit after it); a
 *     double mark inside the span; and, once the quotation is closed, any
 *     later single mark anywhere that is not an apostrophe between two
 *     letters or digits, since it could be the same quotation's real close.
 *   - One exception, inside double marks only: a single opening mark that
 *     the double quotation holding it closes before any single mark does
 *     (an elision such as ’tis in dialogue) ends there. It was checked as
 *     part of that span, and only apostrophes inside words may follow it.
 *   - So a text holds at most one single-quoted quotation. Stated costs,
 *     each failing closed: an elision at a word's start outside double
 *     marks (’tis, 'em, the ’90s), an apostrophe inside a single-quoted
 *     quotation, a bare possessive or an elision after one, and two
 *     single-quoted quotations in one text, inside double marks or not.
 *     The prompt asks for double marks, which have none of these.
 * - **Marks the check does not read** (« », ‹ ›, „, ‚, ‛, ‟, the corner
 *   marks 「」『』, the fullwidth marks, a grave or acute accent standing
 *   alone, any other Unicode quotation punctuation) fail the text wherever
 *   they stand: no reading of them can be checked.
 * - **How a span is compared.** Both sides are folded through the shared
 *   fold (case, accents), curly marks made straight, since the request
 *   shows each quote on one line. A span may also stand without its closing
 *   punctuation (a comma or full stop written inside the marks). Matching
 *   is plain substring search: no pattern is built from the reply.
 * - **Bounded work.** Each search is charged the length of the text it
 *   searches against `organize.quotationWork`; past it, a text that quotes
 *   anything fails closed. A reply read in ordinary use is nowhere near it.
 * - **Lengths are asks.** What is kept is clipped at the safety ceiling
 *   (`safetyMultiple` times its ask) with an ellipsis, and counted, only
 *   after its quotations were read whole.
 * - **Counts stay the host's.** A figure the pass writes is not checked:
 *   the stated limit.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { foldSearchText } from '@shared/utils/foldedTextSearch';
import type { PassageSearchAnalysis, PassageSearchInstance } from '@services/search/passage/PassageSearchContracts';
import type { PassageSearchOrganizeReply } from '@services/search/passage/PassageSearchOrganizeReplyCodec';

type Bounds = Pick<typeof PROMPT_BUDGETS.passageSearch, 'safetyMultiple'> & {
  readonly organize: Pick<typeof PROMPT_BUDGETS.passageSearch.organize, 'headlineCharacters' | 'titleCharacters' | 'claimCharacters' | 'quotationWork'>;
};

const STRAIGHT = '"';
const OPENING = '“';
const CLOSING = '”';
const CLOSING_PUNCTUATION = new Set([',', '.', ';', ':', '!', '?', '…']);

const SINGLE_OPENING = '‘';
const SINGLE_MARKS = new Set(['\'', SINGLE_OPENING, '’']);
/** Every other quotation mark: Unicode's initial and final quotation punctuation, the low-9, corner and fullwidth marks, a lone grave or acute accent. */
const UNREAD_MARK = /[\p{Pi}\p{Pf}„‚「」『』〝〞〟＂＇`´]/u;
/** What may stand before an opening straight mark, beside the start, a space and an opening mark: opening punctuation, an opening quotation mark, a dash. */
const OPENING_CONTEXT = /[\p{Ps}\p{Pi}\p{Pd}]/u;
const PUNCTUATION = /\p{P}/u;
/** Each Unicode space separator, a tab, a line break: JavaScript's whitespace, and the next-line control it leaves out. */
const WHITESPACE = /[\s\p{Zs}\u0085]+/gu;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const isWordCharacter = (character: string | undefined): boolean => character !== undefined && WORD_CHARACTER.test(character);

/** The text every quotation decision reads: NFC, every run of whitespace one space. */
export function passageSearchQuotationText(text: string): string {
  return text.normalize('NFC').replace(WHITESPACE, ' ');
}

/**
 * A straight double mark's role from its neighbours; undefined when it fits
 * both roles or neither. `afterOpener`: the mark before it was read as an
 * opening mark.
 */
function straightRole(before: string | undefined, after: string | undefined, afterOpener: boolean): 'open' | 'close' | undefined {
  const opens = (before === undefined || before === ' ' || afterOpener || OPENING_CONTEXT.test(before)) && after !== undefined && after !== ' ';
  const closes = before !== undefined && before !== ' ' && (after === undefined || after === ' ' || PUNCTUATION.test(after));
  return opens === closes ? undefined : opens ? 'open' : 'close';
}

/**
 * The spans `text` puts in quotation marks, without their marks: every
 * outermost double-quoted span, whole, and the one single-quoted span a
 * text may hold outside double marks (see the module comment). Undefined
 * when the marks cannot be read as exactly that, so the text fails. One
 * pass over the text, by code point.
 */
export function passageSearchQuotedSpans(text: string): string[] | undefined {
  const characters = Array.from(passageSearchQuotationText(text));
  const spans: string[] = [];
  // The double marks open now, innermost last, each as the mark that closes it; and where the outermost one opened.
  const doubles: string[] = [];
  let outermost = -1;
  // Before the one single-quoted quotation a text may hold, inside it (opened at `single`, `singleDepth` doubles deep), or after it.
  let quotation: 'none' | 'open' | 'closed' = 'none';
  let single = -1;
  let singleDepth = 0;
  let lastOpener = -1;
  for (let index = 0; index < characters.length; index += 1) {
    const mark = characters[index];
    const before = characters[index - 1];
    const after = characters[index + 1];
    if (mark === STRAIGHT || mark === OPENING || mark === CLOSING) {
      const role = mark === OPENING ? 'open' : mark === CLOSING ? 'close' : straightRole(before, after, lastOpener === index - 1);
      if (role === undefined) {
        return undefined;
      }
      if (role === 'open') {
        if (quotation === 'open') {
          // A double mark inside a single-quoted quotation.
          return undefined;
        }
        if (doubles.length === 0) {
          outermost = index + 1;
        }
        doubles.push(mark === OPENING ? CLOSING : STRAIGHT);
        lastOpener = index;
        continue;
      }
      if (doubles[doubles.length - 1] !== mark) {
        // A closer with no opener of its kind to match.
        return undefined;
      }
      if (quotation === 'open') {
        // Opened inside this very quotation and never closed (an elision such as ’tis): it ends with it, or the text fails.
        if (singleDepth !== doubles.length) {
          return undefined;
        }
        quotation = 'closed';
      }
      doubles.pop();
      if (doubles.length === 0) {
        spans.push(characters.slice(outermost, index).join(''));
      }
      continue;
    }
    if (SINGLE_MARKS.has(mark)) {
      if (quotation === 'open') {
        // The very next single mark closes the quotation, unambiguously, or the text fails.
        if (mark === SINGLE_OPENING || before === ' ' || isWordCharacter(after)) {
          return undefined;
        }
        if (singleDepth === 0) {
          spans.push(characters.slice(single, index).join(''));
        }
        quotation = 'closed';
      } else if (mark !== SINGLE_OPENING && isWordCharacter(before) && (quotation === 'none' || isWordCharacter(after))) {
        // An apostrophe: inside a word, or after one while no quotation has opened (the sailors’).
      } else if (quotation === 'none') {
        quotation = 'open';
        single = index + 1;
        singleDepth = doubles.length;
        lastOpener = index;
      } else {
        // After the close, anything but an apostrophe inside a word could be this quotation's real close.
        return undefined;
      }
      continue;
    }
    if (UNREAD_MARK.test(mark)) {
      return undefined;
    }
  }
  return doubles.length === 0 && quotation !== 'open' ? spans : undefined;
}

/** Text as the check compares it: whitespace as quotations read it, folded, marks straightened, trimmed. */
export function passageSearchComparableText(text: string): string {
  return foldSearchText(passageSearchQuotationText(text)).replace(/[‘’]/g, '\'').replace(/[“”]/g, STRAIGHT).replace(/ +/g, ' ').trim();
}

function withoutClosingPunctuation(span: string): string {
  let end = span.length;
  while (end > 0 && (CLOSING_PUNCTUATION.has(span[end - 1]) || span[end - 1] === ' ')) {
    end -= 1;
  }
  return span.slice(0, end);
}

/** The host's headline: its own counts, never the pass's. */
export function passageSearchHostHeadline(instances: readonly Pick<PassageSearchInstance, 'file'>[]): string {
  const files = new Set(instances.map((instance) => instance.file)).size;
  return `${instances.length} ${instances.length === 1 ? 'instance' : 'instances'} in ${files} ${files === 1 ? 'file' : 'files'}`;
}

/**
 * The analysis the host keeps of `reply`, over `instances` (the result's)
 * and `shown` (the numbers the pass was given). It may hold no section: the
 * caller says so rather than show an empty analysis.
 */
export function checkPassageSearchOrganizeReply(
  reply: PassageSearchOrganizeReply,
  instances: readonly PassageSearchInstance[],
  shown: readonly number[],
  bounds: Bounds = PROMPT_BUDGETS.passageSearch
): PassageSearchAnalysis {
  const shownNumbers = new Set(shown);
  const quotes = new Map<number, string>();
  for (const instance of instances) {
    if (shownNumbers.has(instance.number)) {
      quotes.set(instance.number, passageSearchComparableText(instance.quote));
    }
  }
  // A line break stands in no span: the fold turns every one into a space.
  const everyQuote = [...quotes.values()].join('\n');
  let work = bounds.organize.quotationWork;
  let clipped = 0;

  /** Whether every quotation in `text` stands in `within`; true for a text that quotes nothing. */
  const quotationsStand = (text: string, within: () => string): boolean => {
    const spans = passageSearchQuotedSpans(text);
    if (!spans) {
      return false;
    }
    if (spans.length === 0) {
      return true;
    }
    const source = within();
    for (const span of new Set(spans.map(passageSearchComparableText))) {
      const bare = withoutClosingPunctuation(span);
      if (bare.length === 0 || work < source.length) {
        return false;
      }
      work -= source.length;
      if (!source.includes(span) && !source.includes(bare)) {
        return false;
      }
    }
    return true;
  };
  const clip = (text: string, ask: number): string => {
    const ceiling = ask * bounds.safetyMultiple;
    if (text.length <= ceiling) {
      return text;
    }
    clipped += 1;
    return `${text.slice(0, ceiling).trimEnd()}…`;
  };

  const dropped = { claims: 0, uncited: 0, misquoted: 0, malformed: reply.malformedClaims, sections: reply.malformedSections, cites: 0 };
  let titles = 0;
  const sections: Array<PassageSearchAnalysis['sections'][number]> = [];
  for (const section of reply.sections) {
    const claims: Array<{ text: string; cites: number[] }> = [];
    for (const claim of section.claims) {
      const cites = claim.cites.filter((cite) => quotes.has(cite));
      dropped.cites += claim.cites.length - cites.length + claim.badCites;
      if (cites.length === 0) {
        dropped.uncited += 1;
      } else if (!quotationsStand(claim.text, () => cites.map((cite) => quotes.get(cite) ?? '').join('\n'))) {
        dropped.misquoted += 1;
      } else {
        claims.push({ text: clip(claim.text, bounds.organize.claimCharacters), cites });
      }
    }
    if (claims.length === 0) {
      dropped.sections += 1;
      continue;
    }
    const kept = section.title !== undefined && quotationsStand(section.title, () => everyQuote);
    titles += kept ? 0 : 1;
    sections.push({ title: kept ? clip(section.title ?? '', bounds.organize.titleCharacters) : `Group ${sections.length + 1}`, claims });
  }
  dropped.claims = dropped.uncited + dropped.misquoted + dropped.malformed;
  const headlineKept = reply.headline !== undefined && quotationsStand(reply.headline, () => everyQuote);
  return {
    headline: headlineKept ? clip(reply.headline ?? '', bounds.organize.headlineCharacters) : passageSearchHostHeadline(instances),
    sections,
    read: { instances: quotes.size, of: instances.length },
    dropped,
    replaced: { headline: !headlineKept, titles },
    clipped
  };
}
