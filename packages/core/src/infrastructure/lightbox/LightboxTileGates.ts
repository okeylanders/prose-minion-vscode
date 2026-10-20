/**
 * Kind-specific acceptance rules for reading tiles (ADR 2026-10-19 D7;
 * PR #150 F-04, F-05). Pure: no host, no I/O.
 *
 * One set of rules decides whether a reading can stand on the board, applied
 * by fresh assembly (`LightboxReadingTiles`) and by stale carry
 * (`LightboxStaleReadings`) alike, after each has checked the tile's quotes
 * and counted its support against the current text. Only the wording of a
 * withheld reason differs by phase ("was found" against "is no longer"); the
 * rules cannot drift apart:
 * - every reading needs at least one found quote;
 * - a motif recurs: its found quotes stand in at least two paragraphs;
 * - a collision claims two borrowed fields share a sentence: both fields are
 *   on the board, and one sentence of a found quote, by the prose-stats
 *   sentence rule (`proseSentenceSpans`), holds a term of each. That sentence
 *   is the collision's witness, kept on the tile and shown on the board;
 * - a palette cluster or swatch needs at least one of its words in the text;
 * - a subtext pair's said line is found in the paragraph it names and lies
 *   inside dialogue there (`LightboxDialogueAnchor`); the meant side is a
 *   claim and is not checked against the text (Slice 4);
 * - a spark stands on counted support: at least one term it names is in the
 *   text, besides its found quote, so it has paragraph addresses and counts
 *   (Slice 4).
 * Lineage has no rule beyond a found quote: its stances are the reading's
 * claim about a story, decoded strictly (`LightboxStoryCodec`), and nothing
 * in them changes with the text.
 * Every reason is host-owned: none echoes a model's names or words.
 */

import type { LightboxCountedSupport, LightboxReadingTileKind, LightboxVerifiedQuote } from '@messages';
import { lightboxTextHoldsTerm } from '@/infrastructure/lightbox/LightboxTermCounts';
import { LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS } from '@/infrastructure/lightbox/LightboxReadingWire';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import type { LightboxDialogueIndex } from '@/infrastructure/lightbox/LightboxDialogueAnchor';

/** A first reading (`fresh`), or a reading carried onto changed text (`carried`). */
export type LightboxGatePhase = 'fresh' | 'carried';

/** Writer-facing reasons, by rule; the phase picks the tense where it matters. */
export const LIGHTBOX_GATE_REASONS = {
  noQuote: {
    fresh: 'No quote it gave was found in the paragraph it named.',
    carried: 'Its quotes are no longer in the chapter.'
  },
  motifOneParagraph: {
    fresh: 'A motif recurs, but its quotes were found in only one paragraph.',
    carried: 'A motif recurs, but its quotes now stand in only one paragraph.'
  },
  collisionFieldWithheld: 'One of the fields it names is not on the board.',
  noSharedSentence: 'No sentence of its quotes holds a term of each field, so the board cannot show them sharing one.',
  clusterWordsGone: 'None of its words are in the chapter.',
  swatchWordsGone: 'Its color words are not in the chapter.',
  saidNotFound: {
    fresh: 'Its said line was not found in the paragraph it named.',
    carried: 'Its said line is no longer in the chapter.'
  },
  saidNotDialogue: {
    fresh: 'Its said line is not inside quoted dialogue in that paragraph, so it is not something a character says.',
    carried: 'Its said line no longer stands inside quoted dialogue, so it is not something a character says.'
  },
  sparkUncounted: {
    fresh: 'None of the words it stands on is in the chapter, so it has no counted support.',
    carried: 'None of the words it stands on is still in the chapter, so it has no counted support.'
  }
} as const;

/** A tile as the gate sees it: its kind, its found quotes and its host counts. */
export interface LightboxGateCandidate {
  kind: LightboxReadingTileKind;
  evidence: readonly LightboxVerifiedQuote[];
  support: readonly LightboxCountedSupport[];
  /** A collision's two field names, as the reading named them. */
  fields?: readonly [string, string];
  /** A subtext pair's said line: the quote the verifier found, or `null` when it found none. */
  said?: LightboxVerifiedQuote | null;
}

export interface LightboxGateContext {
  phase: LightboxGatePhase;
  /** The borrowed fields on the board, by `lightboxFieldKey`, with their terms. */
  drawnFields: ReadonlyMap<string, readonly string[]>;
  /** Where the current text's dialogue stands, for a said line. */
  dialogue: LightboxDialogueIndex;
}

export type LightboxGateVerdict =
  | { ok: true; witness?: LightboxVerifiedQuote }
  | { ok: false; reason: string };

/** How a field is looked up by name: case folded, as the codec compares names. */
export function lightboxFieldKey(name: string): string {
  return name.toLocaleLowerCase('en-US');
}

/** Whether a reading can stand on the board, and a collision's witness when it can. */
export function lightboxTileGate(candidate: LightboxGateCandidate, context: LightboxGateContext): LightboxGateVerdict {
  const refuse = (reason: string): LightboxGateVerdict => ({ ok: false, reason });
  if (candidate.evidence.length === 0) {
    return refuse(LIGHTBOX_GATE_REASONS.noQuote[context.phase]);
  }
  switch (candidate.kind) {
    case 'motif': {
      const paragraphs = new Set(candidate.evidence.map((quote) => quote.paragraph));
      return paragraphs.size < LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS
        ? refuse(LIGHTBOX_GATE_REASONS.motifOneParagraph[context.phase])
        : { ok: true };
    }
    case 'gravity-collision': {
      const [first, second] = (candidate.fields ?? []).map((name) => context.drawnFields.get(lightboxFieldKey(name)));
      if (!first || !second) {
        return refuse(LIGHTBOX_GATE_REASONS.collisionFieldWithheld);
      }
      const witness = lightboxCollisionWitness(candidate.evidence, [first, second]);
      return witness ? { ok: true, witness } : refuse(LIGHTBOX_GATE_REASONS.noSharedSentence);
    }
    case 'palette-cluster':
      return counted(candidate.support) ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.clusterWordsGone);
    case 'swatch':
      return counted(candidate.support) ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.swatchWordsGone);
    case 'subtext': {
      const said = candidate.said;
      if (!said) {
        return refuse(LIGHTBOX_GATE_REASONS.saidNotFound[context.phase]);
      }
      return context.dialogue.holds(said) ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.saidNotDialogue[context.phase]);
    }
    case 'spark':
      return counted(candidate.support) ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.sparkUncounted[context.phase]);
    default:
      return { ok: true };
  }
}

function counted(support: readonly LightboxCountedSupport[]): boolean {
  return support.some((term) => term.count > 0);
}

/**
 * The first sentence, in quote order, that holds a term of each field, as a
 * quote of its own (the chapter's span, its paragraph and match kind); or
 * undefined when no sentence does.
 */
export function lightboxCollisionWitness(
  evidence: readonly LightboxVerifiedQuote[],
  fieldTerms: readonly [readonly string[], readonly string[]]
): LightboxVerifiedQuote | undefined {
  const holdsField = (sentence: string, terms: readonly string[]) =>
    terms.some((term) => lightboxTextHoldsTerm(sentence, term));
  for (const quote of evidence) {
    for (const { start, end } of proseSentenceSpans(quote.text)) {
      const sentence = quote.text.slice(start, end).trim();
      if (holdsField(sentence, fieldTerms[0]) && holdsField(sentence, fieldTerms[1])) {
        return { paragraph: quote.paragraph, text: sentence, match: quote.match };
      }
    }
  }
  return undefined;
}
