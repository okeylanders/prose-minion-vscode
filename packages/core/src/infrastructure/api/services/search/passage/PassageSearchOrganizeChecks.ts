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
 * - **What a quotation is.** Double quotation marks, straight (`"…"`) or
 *   curly (`“…”`, which may nest); a double mark left unpaired, or an empty
 *   quotation, fails its text: the check cannot say what was quoted.
 * - **Single marks, when they are a pair.** Outside double marks, a single
 *   mark (`‘` or `'`) that does not follow a letter or digit and is followed
 *   by text opens a span; the next single mark (`’` or `'`) that follows text
 *   and is not followed by a letter or digit closes it, and the span is
 *   checked like any other. A mark between two letters (it’s, Rabbit’s) is
 *   an apostrophe and neither opens nor closes; a mark after a word with no
 *   opener before it (the Rabbits’ watch) is ignored; an opener that is
 *   never closed (’tis written with an opening mark) is read as an
 *   apostrophe, not a quotation. The stated limits: inside a single-quoted
 *   span, a plural possessive closes it early, and the shorter span is what
 *   is checked; and an elision written with a straight or opening mark
 *   before a later closing candidate reads as a span and fails closed.
 * - **How a span is compared.** Both sides are folded through the shared
 *   fold (case, accents, any whitespace to a space), curly marks made
 *   straight, and runs of spaces collapsed, since the request shows each
 *   quote on one line. A span may also stand without its closing
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

const SINGLE_OPENERS = new Set(['‘', '\'']);
const SINGLE_CLOSERS = new Set(['’', '\'']);
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
const isWordCharacter = (character: string | undefined): boolean => character !== undefined && WORD_CHARACTER.test(character);
const isText = (character: string | undefined): boolean => character !== undefined && character.trim() !== '';

/**
 * The spans `text` puts in quotation marks, without their marks: every
 * double-quoted span, and every paired single-quoted one (see the module
 * comment for what a pair is). Undefined when a double mark is left
 * unpaired. One pass over the text.
 */
export function passageSearchQuotedSpans(text: string): string[] | undefined {
  const spans: string[] = [];
  let opened = -1;
  let closer = '';
  let depth = 0;
  // Where a single-quoted span opened, outside any double-quoted one; -1 when none is open.
  let single = -1;
  for (let index = 0; index < text.length; index += 1) {
    const mark = text[index];
    if (opened >= 0) {
      if (closer === CLOSING && mark === OPENING) {
        depth += 1;
      } else if (mark === closer) {
        depth -= 1;
        if (depth === 0) {
          spans.push(text.slice(opened, index));
          opened = -1;
        }
      }
    } else if (mark === CLOSING) {
      return undefined;
    } else if (mark === STRAIGHT || mark === OPENING) {
      opened = index + 1;
      closer = mark === STRAIGHT ? STRAIGHT : CLOSING;
      depth = 1;
    } else if (single >= 0 && SINGLE_CLOSERS.has(mark) && isText(text[index - 1]) && !isWordCharacter(text[index + 1])) {
      spans.push(text.slice(single, index));
      single = -1;
    } else if (single < 0 && SINGLE_OPENERS.has(mark) && !isWordCharacter(text[index - 1]) && isText(text[index + 1])) {
      single = index + 1;
    }
  }
  return opened < 0 ? spans : undefined;
}

/** Text as the check compares it: folded, marks straightened, spaces collapsed. */
export function passageSearchComparableText(text: string): string {
  return foldSearchText(text).replace(/[‘’]/g, '\'').replace(/[“”]/g, STRAIGHT).replace(/ +/g, ' ').trim();
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
