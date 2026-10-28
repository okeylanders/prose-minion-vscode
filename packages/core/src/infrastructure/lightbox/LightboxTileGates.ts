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
 * - group D (Slice 4B): a familiar phrase is counted in the text and a
 *   found quote's span holds a whole occurrence of it, judged over the full
 *   paragraph by the term counter's tokenizer (`lightboxPhraseHeld`, PR #155
 *   F-03), so a quote cut inside a longer word holds nothing; a tier mix stands on at least
 *   `LIGHTBOX_STOCK_MINIMUM_BEATS` found beats; a handoff's two sentences
 *   are adjacent in one paragraph (`LightboxSentencePairs`); a numbers
 *   reading reads a figure that stands out on the board it is drawn on, is
 *   not one of craft steering's (Slice 4F), and keeps only quotes holding an
 *   instance of it (`LightboxNumberInstances`).
 * - group E (Slice 4C, `LightboxPlotGates`): a synopsis stands on two found
 *   quotes; a pressure thread on its found plant, a found resolution when it
 *   gives one, and its quotes in paragraph order; an artifact on a counted
 *   term. The movements are held as a set (`lightboxMovementSetGate`, also
 *   applied by both phases), and engagement follows them.
 * - group G (Slice 4F, craft steering): a figure's reading and each
 *   instance note keep only quotes holding an instance of their figure, by
 *   its own detector, and stand on at least one. A note that leans or
 *   compensates with no nudge stands only while its instance is in
 *   dialogue, the character's voice (epic decision 26, `LightboxSteeringVoice`).
 * - group F (Slice 4D, `LightboxOpinionGates`): the Opinion stands while
 *   one of its views does. Its observations and views are gated first, by
 *   their own rules (cited items on the board, quotes the tiles hold, the
 *   text rules), and it alone may stand with no quote of its own: it cites
 *   board items, and never quotes.
 * Lineage, signature phrases, air-locks, echoes, paragraph endings, the
 * template and its beats have no rule beyond a found quote: what they add is the reading's claim,
 * decoded strictly, and nothing in it changes with the text (an ending
 * follows its column's text, `LightboxTileCounts`).
 * Every reason is host-owned: none echoes a model's names or words.
 */

import type {
  LightboxCountedSupport,
  LightboxNumberStatId,
  LightboxReadingTileKind,
  LightboxVerifiedQuote
} from '@messages';
import { lightboxTextHoldsTerm } from '@/infrastructure/lightbox/LightboxTermCounts';
import { LIGHTBOX_MOTIF_MINIMUM_PARAGRAPHS, LIGHTBOX_STOCK_MINIMUM_BEATS } from '@/infrastructure/lightbox/LightboxReadingWire';
import type { LightboxSentencePair } from '@/infrastructure/lightbox/LightboxSentencePairs';
import type { LightboxStandoutRows } from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_NUMBERS_READ_STATS } from '@shared/constants/lightboxSteering';
import { proseSentenceSpans } from '@/tools/measure/passageProseStats';
import type { LightboxDialogueIndex } from '@/infrastructure/lightbox/LightboxDialogueAnchor';
import type { LightboxSteeringVoice } from '@/infrastructure/lightbox/LightboxSteeringVoice';
import {
  LIGHTBOX_PLOT_GATE_REASONS,
  lightboxSynopsisGate,
  lightboxThreadGate,
  type LightboxThreadCandidate
} from '@/infrastructure/lightbox/LightboxPlotGates';

export { lightboxMovementSetGate } from '@/infrastructure/lightbox/LightboxPlotGates';

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
  },
  familiarUncounted: {
    fresh: 'The phrase it names is not in the chapter.',
    carried: 'The phrase it names is no longer in the chapter.'
  },
  familiarUnquoted: 'None of its found quotes holds the phrase it names.',
  tiersTooFew: {
    fresh: `Fewer than ${LIGHTBOX_STOCK_MINIMUM_BEATS} of its classified beats were found in the chapter, too few to count a mix.`,
    carried: `Fewer than ${LIGHTBOX_STOCK_MINIMUM_BEATS} of its classified beats are still in the chapter, too few to count a mix.`
  },
  handoffGone: {
    fresh: 'One of its two sentences was not found in the paragraph it named.',
    carried: 'One of its two sentences is no longer in the chapter.'
  },
  handoffNotAdjacent: {
    fresh: 'Its two quotes were not found in sentences side by side in one paragraph, so it is not a handoff.',
    carried: 'Its two quotes no longer stand in sentences side by side in one paragraph.'
  },
  numberNotStandout: {
    fresh: 'It reads a figure the board did not measure as standing out.',
    carried: 'The figure it reads no longer stands out in the chapter.'
  },
  numberNoInstance: {
    fresh: 'None of its quotes was found holding an instance of the figure it reads.',
    carried: 'None of its quotes still holds an instance of the figure it reads.'
  },
  /** Slice 4F: being verbs, adverbs and intensifiers are read by craft steering, not the numbers lens. */
  numberSteered: 'Craft steering reads this figure, so the numbers lens does not.',
  steeringNoInstance: {
    fresh: 'No quote it gave was found holding an instance of the figure it reads.',
    carried: 'No quote of it still holds an instance of the figure it reads.'
  },
  /** Dialogue is voice (epic decision 26): only a note in dialogue leans or compensates with no nudge. */
  steeringNoNudge: {
    fresh: 'It leans or compensates in narration, so it names the craft move worth a look, and this one names none.',
    carried: 'Its instance no longer stands in dialogue, and in narration a note that leans or compensates names a nudge; this one has none.'
  },
  /** The text is the same, but the figure was measured again and stands out differently (PR #155 F-01). */
  numberRemeasured: 'The figure it reads now stands out differently: your publishing preset or your own average changed since it was read. Re-analyze the numbers.',
  opinionNoView: {
    fresh: 'No view stood: each broke a rule (below), so the Opinion is not drawn.',
    carried: 'No view still stands on what the board holds now (below), so the Opinion is withheld.'
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
  /** A handoff's adjacent sentences, or why there are none (Slice 4B). */
  pair?: LightboxSentencePair | 'gone' | 'not-adjacent';
  /** A numbers reading's figure. */
  stat?: LightboxNumberStatId;
  /** A familiar phrase: whether a found quote's span holds a whole occurrence of it (`lightboxPhraseHeld`). */
  phraseHeld?: boolean;
  /** A pressure thread's quotes as found (Slice 4C). */
  thread?: LightboxThreadCandidate;
  /** The Opinion's views that stood their own gates (Slice 4D, `LightboxOpinionGates`). */
  opinionViews?: number;
  /** A steering note: whether it leans or compensates, whether it names a nudge, and where its instance stands (epic decision 26). */
  steeringNote?: { leans: boolean; nudged: boolean; voice: LightboxSteeringVoice | undefined };
}

export interface LightboxGateContext {
  phase: LightboxGatePhase;
  /** The borrowed fields on the board, by `lightboxFieldKey`, with their terms. */
  drawnFields: ReadonlyMap<string, readonly string[]>;
  /** Where the current text's dialogue stands, for a said line. */
  dialogue: LightboxDialogueIndex;
  /** The figures that stand out on the board being drawn (Slice 4B). */
  standouts: LightboxStandoutRows;
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
  if (candidate.kind === 'opinion') {
    return (candidate.opinionViews ?? 0) > 0 ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.opinionNoView[context.phase]);
  }
  if (candidate.kind === 'number-usage') {
    if (candidate.stat && !LIGHTBOX_NUMBERS_READ_STATS.includes(candidate.stat)) {
      return refuse(LIGHTBOX_GATE_REASONS.numberSteered);
    }
    if (!candidate.stat || !context.standouts.has(candidate.stat)) {
      return refuse(LIGHTBOX_GATE_REASONS.numberNotStandout[context.phase]);
    }
    return candidate.evidence.length > 0 ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.numberNoInstance[context.phase]);
  }
  if (candidate.kind === 'steering-reading' || candidate.kind === 'steering-note') {
    if (candidate.evidence.length === 0) {
      return refuse(LIGHTBOX_GATE_REASONS.steeringNoInstance[context.phase]);
    }
    const note = candidate.steeringNote;
    // Dialogue is voice: a note leaning with no nudge stands only while its instance is in dialogue.
    return note && note.leans && !note.nudged && note.voice !== 'dialogue'
      ? refuse(LIGHTBOX_GATE_REASONS.steeringNoNudge[context.phase])
      : { ok: true };
  }
  if (candidate.kind === 'stock-tiers' && candidate.evidence.length < LIGHTBOX_STOCK_MINIMUM_BEATS) {
    return refuse(LIGHTBOX_GATE_REASONS.tiersTooFew[context.phase]);
  }
  if (candidate.kind === 'handoff' && typeof candidate.pair !== 'object') {
    return refuse(candidate.pair === 'not-adjacent'
      ? LIGHTBOX_GATE_REASONS.handoffNotAdjacent[context.phase]
      : LIGHTBOX_GATE_REASONS.handoffGone[context.phase]);
  }
  if (candidate.kind === 'pressure-thread' || candidate.kind === 'synopsis') {
    const verdict = candidate.kind === 'synopsis'
      ? lightboxSynopsisGate(candidate.evidence.length, context.phase)
      : lightboxThreadGate(candidate.thread ?? { planted: null, escalations: [], resolution: { state: 'open' } }, context.phase);
    return verdict.ok ? { ok: true } : refuse(verdict.reason);
  }
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
    case 'familiar-phrase': {
      if (!counted(candidate.support)) {
        return refuse(LIGHTBOX_GATE_REASONS.familiarUncounted[context.phase]);
      }
      return candidate.phraseHeld === true ? { ok: true } : refuse(LIGHTBOX_GATE_REASONS.familiarUnquoted);
    }
    case 'artifact':
      return counted(candidate.support) ? { ok: true } : refuse(LIGHTBOX_PLOT_GATE_REASONS.artifactUncounted[context.phase]);
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
