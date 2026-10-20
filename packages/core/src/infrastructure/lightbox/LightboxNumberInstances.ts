/**
 * What counts as an instance of a standout figure in a reading's quote
 * (Slice 4B; ADR 2026-10-19 D7 and its addendum). Pure: no host, no I/O.
 *
 * A numbers reading says how a figure that stands out is used, and each
 * quote it keeps must hold an instance of that figure, judged by the
 * detector that counted it (`LightboxNumbers`):
 * - a word pattern (passive voice, being verbs, adverbs, intensifiers): the
 *   found span holds a match of the pattern's detector;
 * - sentence length: the found span lies inside one sentence of its
 *   paragraph (the prose-stats splitter) whose length is beyond the
 *   standout's reference;
 * - dialogue above its reference: the span lies inside a dialogue span
 *   (`findDialogueSpans`); below it: the span touches no dialogue at all.
 *
 * The check is a span filter on the one quote verifier
 * (`LightboxQuoteVerifier`), as the dialogue anchor's is: among the spans the
 * verifier would accept, the first that holds an instance is the quote. A
 * quote the verifier finds but whose spans hold no instance is withheld as
 * `no-instance`. No text is matched here outside the verifier.
 *
 * The task lines tell the model, by id, which figures stand out and what an
 * instance looks like; they name no count the model could repeat as its own.
 */

import type { LightboxNumberRow, LightboxNumberStatId } from '@messages';
import { findDialogueSpans } from '@/utils/dialogueSpans';
import { countWords } from '@/utils/textUtils';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { STYLE_FLAG_FILLER_WORDS } from '@/tools/measure/styleFlags';
import { BEING_VERB_FORMS } from '@/tools/measure/beingVerbs';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier, LightboxSpanFilter } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { LIGHTBOX_NUMBER_PATTERNS, LIGHTBOX_NUMBER_STATS } from '@/infrastructure/lightbox/LightboxNumbers';

/** The standouts on a board, by figure: what a numbers reading may name, and how its quotes are checked. */
export type LightboxStandoutRows = ReadonlyMap<LightboxNumberStatId, LightboxNumberRow>;

/** The rows that stand out, by figure. */
export function lightboxStandoutRows(rows: readonly LightboxNumberRow[] | undefined): LightboxStandoutRows {
  return new Map((rows ?? []).filter((row) => row.standout).map((row) => [row.stat, row]));
}

/** Whether a found span of a paragraph (1-based) holds an instance of the standout `row`. */
export function lightboxInstanceFilter(row: LightboxNumberRow, paragraphs: readonly string[]): LightboxSpanFilter {
  const standout = row.standout;
  const text = (paragraph: number) => paragraphs[paragraph - 1];
  if (!standout) {
    return () => false;
  }
  switch (row.stat) {
    case 'sentence-length': {
      const reference = standout.reference;
      return (paragraph, start, end) => {
        const source = text(paragraph);
        if (source === undefined || reference === undefined) {
          return false;
        }
        const sentence = proseSentenceSpans(source).find((span) => span.start <= start && end <= span.end);
        if (!sentence) {
          return false;
        }
        const words = countWords(source.slice(sentence.start, sentence.end));
        return standout.direction === 'above' ? words > reference : words < reference;
      };
    }
    case 'dialogue':
      return (paragraph, start, end) => {
        const source = text(paragraph);
        if (source === undefined) {
          return false;
        }
        const spans = findDialogueSpans(source);
        return standout.direction === 'above'
          ? spans.some((span) => span.start <= start && end <= span.end)
          : spans.every((span) => end <= span.start || span.end <= start);
      };
    case 'passive-voice':
    case 'being-verbs':
    case 'adverbs':
    case 'intensifiers': {
      // Matched over the whole paragraph, as the figure was counted, so a
      // span cut mid-word ("ly tired" of "only tired") holds no match it
      // would not have counted.
      const detect = LIGHTBOX_NUMBER_PATTERNS[row.stat];
      const matches = new Map<number, Array<{ start: number; end: number }>>();
      return (paragraph, start, end) => {
        const source = text(paragraph);
        if (source === undefined) {
          return false;
        }
        if (!matches.has(paragraph)) {
          matches.set(paragraph, detect(source));
        }
        return (matches.get(paragraph) ?? []).some((match) => start <= match.start && match.end <= end);
      };
    }
  }
}

/**
 * Verify a numbers reading's quote: the first span the verifier accepts that
 * holds an instance; else, when the words are found but hold none, a
 * `no-instance` failure; else the verifier's own failure.
 */
export function verifyLightboxInstance(
  verifier: LightboxQuoteVerifier,
  row: LightboxNumberRow,
  paragraph: number,
  quote: string
): LightboxQuoteVerdict {
  const held = verifier.verify(paragraph, quote, lightboxInstanceFilter(row, verifier.paragraphs));
  if (held.found) {
    return held;
  }
  const plain = verifier.verify(paragraph, quote);
  return plain.found ? { found: false, paragraph: plain.paragraph, reason: 'no-instance' } : held;
}

/** The task's lines for the numbers lens: each standout by id, with what an instance looks like. */
export function lightboxNumberTaskLines(rows: readonly LightboxNumberRow[] | undefined): string[] {
  const standouts = (rows ?? []).filter((row) => row.standout);
  if (standouts.length === 0) {
    return ['The board measured no figure as standing out in this chapter: return the numbers block with no items, and say so in its friction.'];
  }
  return [
    'The board measured these figures as standing out in this chapter. Read how each is used, by its id, and only these:',
    ...standouts.map((row) => `- \`${row.stat}\`: ${standoutPhrase(row)} ${instancePhrase(row)}`)
  ];
}

function standoutPhrase(row: LightboxNumberRow): string {
  const standout = row.standout as NonNullable<LightboxNumberRow['standout']>;
  const against = standout.against.map((basis) => (basis === 'standards' ? 'the writer\'s publishing preset' : 'the writer\'s other chapters')).join(' and ');
  const more = standout.direction === 'above';
  switch (row.stat) {
    case 'sentence-length':
      return `sentences run ${more ? 'longer' : 'shorter'} here than in ${against}.`;
    case 'dialogue':
      return `${more ? 'more' : 'less'} of this chapter is dialogue than in ${against}.`;
    default:
      return `${LIGHTBOX_NUMBER_STATS.find((entry) => entry.stat === row.stat)?.noun ?? row.stat} are more frequent here than in ${against}.`;
  }
}

function instancePhrase(row: LightboxNumberRow): string {
  const standout = row.standout as NonNullable<LightboxNumberRow['standout']>;
  switch (row.stat) {
    case 'sentence-length':
      return `Quote from inside one sentence of ${standout.direction === 'above' ? 'more' : 'fewer'} than ${standout.reference} words.`;
    case 'dialogue':
      return standout.direction === 'above'
        ? 'Quote words from inside quotation marks.'
        : 'Quote narration, with no quotation marks in it.';
    case 'passive-voice':
      return 'Each quote must contain was, were, been or being followed by a word ending in -ed.';
    case 'being-verbs':
      return `Each quote must contain one of: ${BEING_VERB_FORMS.join(', ')}.`;
    case 'adverbs':
      return 'Each quote must contain a word ending in -ly.';
    case 'intensifiers':
      return `Each quote must contain one of: ${STYLE_FLAG_FILLER_WORDS.join(', ')}.`;
  }
}
