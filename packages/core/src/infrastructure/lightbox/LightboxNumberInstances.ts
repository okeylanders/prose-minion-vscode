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
 *   (`findDialogueSpans`); below it: the span stands in a paragraph with no
 *   dialogue at all, the paragraphs the row counts and lights (PR #155).
 *
 * The check is a span filter on the one quote verifier
 * (`LightboxQuoteVerifier`), as the dialogue anchor's is: among the spans the
 * verifier would accept, the first that holds an instance is the quote. A
 * quote the verifier finds but whose spans hold no instance is withheld as
 * `no-instance`. No text is matched here outside the verifier.
 *
 * The task lines tell the model, by id, which figures stand out and what an
 * instance looks like; they name no count the model could repeat as its own.
 * Since Slice 4F they list only the figures the numbers lens still reads
 * (`LIGHTBOX_NUMBERS_READ_STATS`): being verbs, adverbs and intensifiers are
 * craft steering's, whose quotes are held to the same word-pattern filter
 * (`lightboxPatternInstanceFilter`, `verifyLightboxPatternInstance`).
 */

import type { LightboxNumberRow, LightboxNumberStatId, LightboxReadingTile, LightboxWithheldClaim } from '@messages';
import { findDialogueSpans } from '@/utils/dialogueSpans';
import { countWords } from '@/utils/textUtils';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import { STYLE_FLAG_FILLER_WORDS } from '@/tools/measure/styleFlags';
import { BEING_VERB_FORMS, BEING_VERB_NEGATED_FORMS } from '@/tools/measure/beingVerbs';
import type { LightboxQuoteVerdict, LightboxQuoteVerifier, LightboxSpanFilter } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import {
  LIGHTBOX_NUMBER_PATTERNS,
  LIGHTBOX_NUMBER_STATS,
  type LightboxNumberPatternId
} from '@/infrastructure/lightbox/LightboxNumbers';
import { LIGHTBOX_GATE_REASONS } from '@/infrastructure/lightbox/LightboxTileGates';
import { LIGHTBOX_NUMBERS_READ_STATS } from '@shared/constants/lightboxSteering';

/** The standouts on a board, by figure: what a numbers reading may name, and how its quotes are checked. */
export type LightboxStandoutRows = ReadonlyMap<LightboxNumberStatId, LightboxNumberRow>;

/** The rows that stand out, by figure. */
export function lightboxStandoutRows(rows: readonly LightboxNumberRow[] | undefined): LightboxStandoutRows {
  return new Map((rows ?? []).filter((row) => row.standout).map((row) => [row.stat, row]));
}

/**
 * What a numbers reading of a figure was asked under: the figure's
 * direction, the bases it stands out against (the preset, the writer's
 * average) and, for sentence length, the reference an instance is measured
 * against. Undefined when the figure does not stand out.
 */
export function lightboxStandoutSignature(row: LightboxNumberRow | undefined): string | undefined {
  const standout = row?.standout;
  return standout ? JSON.stringify([standout.direction, standout.against, standout.reference ?? null]) : undefined;
}

/**
 * Hold number usages to the measurement they are shown under (PR #155
 * F-01). A usage read when the board measured `readUnder` stays only while
 * its figure stands out the same way on `current`; otherwise it is withheld
 * by its title, with the host's reason. The text may be unchanged: the
 * writer's average or the preset can change what stands out. Every other
 * tile is untouched.
 */
export function holdLightboxNumberUsages<T extends { tiles: LightboxReadingTile[]; withheldClaims: LightboxWithheldClaim[] }>(
  group: T,
  readUnder: readonly LightboxNumberRow[] | undefined,
  current: readonly LightboxNumberRow[] | undefined
): T {
  const before = new Map((readUnder ?? []).map((row) => [row.stat, row]));
  const after = new Map((current ?? []).map((row) => [row.stat, row]));
  const withheld: LightboxWithheldClaim[] = [];
  const tiles = group.tiles.filter((tile) => {
    if (tile.kind !== 'number-usage') {
      return true;
    }
    const now = lightboxStandoutSignature(after.get(tile.stat));
    if (now !== undefined && now === lightboxStandoutSignature(before.get(tile.stat))) {
      return true;
    }
    const reason = now === undefined ? LIGHTBOX_GATE_REASONS.numberNotStandout.carried : LIGHTBOX_GATE_REASONS.numberRemeasured;
    withheld.push({ kind: tile.kind, lens: tile.lens, title: tile.title, reason, quotes: [] });
    return false;
  });
  return withheld.length === 0 ? group : { ...group, tiles, withheldClaims: [...group.withheldClaims, ...withheld] };
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
        // Below: narration from a paragraph with no dialogue, as the row counts its instances.
        return standout.direction === 'above'
          ? spans.some((span) => span.start <= start && end <= span.end)
          : spans.length === 0;
      };
    case 'passive-voice':
    case 'being-verbs':
    case 'adverbs':
    case 'intensifiers':
      return lightboxPatternInstanceFilter(row.stat, paragraphs);
  }
}

/**
 * Whether a found span holds a match of a word pattern's detector, matched
 * over the whole paragraph as the figure was counted, so a span cut mid-word
 * ("ly tired" of "only tired") holds no match it would not have counted.
 * Shared by the numbers lens and craft steering (Slice 4F), which hold a
 * quote to the figure's own detector whether or not it stands out.
 */
export function lightboxPatternInstanceFilter(stat: LightboxNumberPatternId, paragraphs: readonly string[]): LightboxSpanFilter {
  const detect = LIGHTBOX_NUMBER_PATTERNS[stat];
  const matches = new Map<number, Array<{ start: number; end: number }>>();
  return (paragraph, start, end) => {
    const source = paragraphs[paragraph - 1];
    if (source === undefined) {
      return false;
    }
    if (!matches.has(paragraph)) {
      matches.set(paragraph, detect(source));
    }
    return (matches.get(paragraph) ?? []).some((match) => start <= match.start && match.end <= end);
  };
}

/** A word pattern's quote, by its detector: the first accepted span holding an instance, else `no-instance` or the verifier's failure. */
export function verifyLightboxPatternInstance(
  verifier: LightboxQuoteVerifier,
  stat: LightboxNumberPatternId,
  paragraph: number,
  quote: string
): LightboxQuoteVerdict {
  return verifyWith(verifier, lightboxPatternInstanceFilter(stat, verifier.paragraphs), paragraph, quote);
}

function verifyWith(verifier: LightboxQuoteVerifier, filter: LightboxSpanFilter, paragraph: number, quote: string): LightboxQuoteVerdict {
  const held = verifier.verify(paragraph, quote, filter);
  if (held.found) {
    return held;
  }
  const plain = verifier.verify(paragraph, quote);
  return plain.found ? { found: false, paragraph: plain.paragraph, reason: 'no-instance' } : held;
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
  return verifyWith(verifier, lightboxInstanceFilter(row, verifier.paragraphs), paragraph, quote);
}

/**
 * The task's lines for the numbers lens: each standout it reads by id, with
 * what an instance looks like. Craft steering's figures are never listed
 * (Slice 4F): they are read there, standing out or not.
 */
export function lightboxNumberTaskLines(rows: readonly LightboxNumberRow[] | undefined): string[] {
  const standouts = (rows ?? []).filter((row) => row.standout && LIGHTBOX_NUMBERS_READ_STATS.includes(row.stat));
  if (standouts.length === 0) {
    return ['None of the figures this lens reads (sentence length, dialogue, passive voice) stands out in this chapter: return the numbers block with no items, and say so in its friction.'];
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
        : 'Quote narration from a paragraph with no dialogue in it.';
    case 'passive-voice':
    case 'being-verbs':
    case 'adverbs':
    case 'intensifiers':
      return `Each quote must contain ${lightboxPatternInstancePhrase(row.stat)}`;
  }
}

/**
 * What an instance of a word pattern is, said so a reading quotes one
 * (Slice 4F, the being-verbs investigation): the words the detector counts,
 * and what it does not count that a reader might take for one. Being verbs
 * count their contractions (epic decision 26).
 */
export function lightboxPatternInstancePhrase(stat: LightboxNumberPatternId): string {
  switch (stat) {
    case 'passive-voice':
      return 'was, were, been or being followed by a word ending in -ed.';
    case 'being-verbs':
      return `one of these whole words: ${BEING_VERB_FORMS.join(', ')}; or one contracted: I'm, 're (you're, we're, they're), ` +
        `'s read as is (it's, she's, that's, there's), ${BEING_VERB_NEGATED_FORMS.join(', ')}. ` +
        '\'s as a possessive (the Rabbit\'s watch) or as has (he\'s been, she\'s got), let\'s, ain\'t before been or got, ' +
        '\'d, \'ll and \'ve, a form joined to an underscore (_was_) and a linking verb (seem, become, look, feel, appear) are not instances.';
    case 'adverbs':
      return 'a whole word ending in -ly (the detector counts every one, "only" and "family" too).';
    case 'intensifiers':
      return `one of these whole words: ${STYLE_FLAG_FILLER_WORDS.join(', ')}.`;
  }
}
