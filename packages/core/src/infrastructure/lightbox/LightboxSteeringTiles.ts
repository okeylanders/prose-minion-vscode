/**
 * From a decoded group G block to board tiles: craft steering (ADR
 * 2026-10-19 D7 second addendum; Slice 4F). Pure: no host, no I/O. Called
 * by `LightboxReadingTiles` through its claim assembler, so every claim here
 * meets the rules every reading meets: quotes checked against the paragraph
 * they name, a claim with none withheld by title, the kind's gate
 * (`LightboxTileGates`) applied as stale carry applies it, ids minted per
 * run.
 *
 * - **Every quote holds an instance.** A figure's reading and each note are
 *   verified with the figure's own detector (`verifyLightboxPatternInstance`,
 *   the word-pattern filter the numbers lens uses), whether or not the
 *   figure stands out. A quote found but holding none is withheld as
 *   `no-instance`.
 * - **Host titles.** A reading is titled by its figure's label, a note by
 *   that label and its place ("Adverbs (-ly) · note II"), so no unchecked
 *   words are shown as a title.
 * - **Dialogue is voice** (epic decision 26, `LightboxSteeringVoice`): a
 *   note whose instance stands in dialogue keeps its stance, but any nudge
 *   or example the reading gave is withheld, with the host's reason; a note
 *   that leans or compensates with no nudge in narration is withheld by the
 *   gate.
 * - **The one example is anchored** (`anchorLightboxSteeringExample`): its
 *   `before` must be a run of whole words of the note's checked quote, as
 *   the chapter has it, that holds an instance of the figure in narration
 *   and takes in no speech (one that stands only on dialogue is withheld as
 *   voice; one that holds narration but crosses into a character's words,
 *   either way, is withheld as speech, while its note and nudge stand: PR
 *   #162 F-02). Found by the
 *   verifier's own rules (exact, then folded), through a span filter, so
 *   what the board shows as `before` is the chapter's own text. That text
 *   can be longer than the reading's (a soft line break and its indent, a
 *   spaced dash), so the pair as the chapter has it is held to the
 *   example's contract again: its bounds, a change between its parts, and
 *   one Workshop point for the whole pair (PR #160 F-02). Otherwise the
 *   example alone is withheld, with the host's reason, and the note stands.
 *   The example is never evidence and never a quote.
 * - **The task lines** say what an instance of each figure is, and which
 *   figures the chapter holds none of (no count is given).
 */

import { WORKSHOP_LIGHTBOX_TILE_LIMITS } from '@messages';
import type {
  LightboxNumberRow,
  LightboxSteeringExample,
  LightboxSteeringNoteTile,
  LightboxSteeringStatId,
  LightboxVerifiedQuote
} from '@messages';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';
import { LIGHTBOX_STEERING_STATS, lightboxSteeringExampleText } from '@shared/constants/lightboxSteering';
import type { LightboxQuoteVerifier, LightboxSpanFilter } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { lightboxIntervalReach } from '@/infrastructure/lightbox/LightboxSpanIndex';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import {
  lightboxPatternInstanceFilter,
  lightboxPatternInstancePhrase,
  verifyLightboxPatternInstance
} from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_STEERING_EXAMPLE_REASONS, lightboxSteeringExamplePairFault } from '@/infrastructure/lightbox/LightboxSteeringCodec';
import { lightboxSteeringNoteTitle, type LightboxDecodedSteeringBlock } from '@/infrastructure/lightbox/LightboxSteeringWire';
import {
  holdLightboxSteeringVoice,
  lightboxSteeringNarrationFilter,
  lightboxSteeringSpeechFilter
} from '@/infrastructure/lightbox/LightboxSteeringVoice';

/** Letters, digits, apostrophes and hyphens join a word: a run of whole words starts and ends beside none of them. */
const WORD_CHARACTER = /[\p{L}\p{N}'’_-]/u;

export function assembleSteeringBlock(block: LightboxDecodedSteeringBlock, assembler: LightboxClaimAssembler): void {
  const { verifier } = assembler.context;
  const friction = block.friction;
  assembler.malformed('steering-reading', 'steering', block.malformed);
  for (const figure of block.figures) {
    const { stat } = figure;
    const label = LIGHTBOX_NUMBER_STAT_LABELS[stat];
    const verifyQuote = (paragraph: number, quote: string) => verifyLightboxPatternInstance(verifier, stat, paragraph, quote);
    if ('withheld' in figure.reading) {
      assembler.withholdClaim({ kind: 'steering-reading', lens: 'steering', title: label, reason: figure.reading.withheld, quotes: [] });
    } else {
      assembler.claim(
        { kind: 'steering-reading', lens: 'steering', title: label, claim: figure.reading.claim, quotes: figure.reading.evidence,
          terms: [], support: [], friction, verifyQuote },
        (base) => ({ ...base, kind: 'steering-reading', stat })
      );
    }
    assembler.malformed('steering-note', 'steering', figure.malformedNotes);
    for (const note of figure.notes) {
      assembler.claim(
        { kind: 'steering-note', lens: 'steering', title: lightboxSteeringNoteTitle(label, note.ordinal), claim: note.why,
          quotes: [{ para: note.para, quote: note.quote }], terms: [], support: [], friction, verifyQuote,
          steeringNote: { stat, leans: note.stance !== 'earns', nudged: note.nudge !== undefined } },
        (base, accepted) => ({
          ...base,
          kind: 'steering-note',
          stat,
          ordinal: note.ordinal,
          // Dialogue is voice (epic decision 26): there the note keeps its stance, and no nudge or example.
          ...holdLightboxSteeringVoice({
            stance: note.stance,
            ...(note.nudge !== undefined ? { nudge: note.nudge } : {}),
            ...lightboxSteeringExampleFields(verifier, stat, base.evidence[0], note.example, note.exampleWithheld, 'fresh')
          }, accepted.voice, 'fresh')
        })
      );
    }
  }
}

/** A note's example fields on `quote`: the anchored example, or why none is shown; nothing when the reading gave none. */
export function lightboxSteeringExampleFields(
  verifier: LightboxQuoteVerifier,
  stat: LightboxSteeringStatId,
  quote: LightboxVerifiedQuote | undefined,
  example: LightboxSteeringExample | undefined,
  withheld: string | undefined,
  phase: 'fresh' | 'carried'
): Pick<LightboxSteeringNoteTile, 'example' | 'exampleWithheld'> {
  if (!example) {
    return withheld ? { exampleWithheld: withheld } : {};
  }
  const anchored: LightboxSteeringAnchor = quote ? anchorLightboxSteeringExample(verifier, stat, quote, example) : { fault: 'unanchored' };
  if ('fault' in anchored) {
    return { exampleWithheld: LIGHTBOX_STEERING_ANCHOR_REASONS[anchored.fault][phase] };
  }
  return { example: anchored.example, ...(withheld ? { exampleWithheld: withheld } : {}) };
}

/**
 * Why an example does not stand in its note's quote as the chapter has it:
 * `voice` when it stands only on an instance in dialogue, `speech` when it
 * holds one in narration but also takes in words a character speaks.
 */
export type LightboxSteeringAnchorFault = 'unanchored' | 'voice' | 'speech' | 'long' | 'same' | 'fit';

/** The example as the chapter has it, or why it cannot be shown. */
export type LightboxSteeringAnchor = { example: LightboxSteeringExample } | { fault: LightboxSteeringAnchorFault };

/** The host's reason for each fault, fresh and carried. */
const LIGHTBOX_STEERING_ANCHOR_REASONS: Readonly<Record<LightboxSteeringAnchorFault, { fresh: string; carried: string }>> = {
  unanchored: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchored, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchoredCarried },
  voice: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.voice, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.voice },
  speech: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.speech, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.speech },
  long: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredLong, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredLong },
  same: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredSame, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredSame },
  fit: { fresh: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredFit, carried: LIGHTBOX_STEERING_EXAMPLE_REASONS.anchoredFit }
};

/**
 * The example with its `before` as the chapter has it, when `before` is a
 * run of whole words inside the checked quote's span that holds an instance
 * of the figure in narration and shares no character with a dialogue span
 * (the steering measure's own, quotation marks included), and the pair as
 * the chapter has it still keeps the
 * example's contract: each part within its bounds, a change between them,
 * and the whole within one Workshop point. The quote is the note's own, as
 * verified, so the example can never anchor anywhere else in the chapter.
 */
export function anchorLightboxSteeringExample(
  verifier: LightboxQuoteVerifier,
  stat: LightboxSteeringStatId,
  quote: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>,
  example: LightboxSteeringExample
): LightboxSteeringAnchor {
  const source = verifier.paragraphs[quote.paragraph - 1];
  if (source === undefined) {
    return { fault: 'unanchored' };
  }
  const spans: Array<{ start: number; end: number }> = [];
  for (let at = source.indexOf(quote.text); at >= 0; at = source.indexOf(quote.text, at + 1)) {
    spans.push({ start: at, end: at + quote.text.length });
  }
  // One search per candidate span, never a scan of every place the quote stands (PR #162 F-01).
  const quoteReach = lightboxIntervalReach(spans);
  const whole = (start: number, end: number) =>
    !WORD_CHARACTER.test(source[start - 1] ?? '') && !WORD_CHARACTER.test(source[end] ?? '') &&
    WORD_CHARACTER.test(source[start] ?? '') && WORD_CHARACTER.test(source[end - 1] ?? '');
  const inQuote = (paragraph: number, start: number, end: number) =>
    paragraph === quote.paragraph && quoteReach(start) >= end && whole(start, end);
  const find = (accept: LightboxSpanFilter) => {
    const found = verifier.verify(quote.paragraph, example.before, (paragraph, start, end) =>
      inQuote(paragraph, start, end) && accept(paragraph, start, end));
    return found.found && found.paragraph === quote.paragraph ? found : undefined;
  };
  // Dialogue is voice (epic decision 26): the example stands on an instance in narration, and takes in no word a
  // character speaks, even beside that narration (PR #162 F-02).
  const narration = lightboxSteeringNarrationFilter(verifier, stat);
  const speech = lightboxSteeringSpeechFilter(verifier);
  const verdict = find((paragraph, start, end) => narration(paragraph, start, end) && !speech(paragraph, start, end));
  if (!verdict) {
    if (find(narration)) {
      return { fault: 'speech' };
    }
    return { fault: find(lightboxPatternInstanceFilter(stat, verifier.paragraphs)) ? 'voice' : 'unanchored' };
  }
  const anchored = { before: verdict.text, after: example.after };
  const fault = lightboxSteeringExamplePairFault(anchored);
  if (fault) {
    return { fault: fault === 'same' ? 'same' : 'long' };
  }
  // Implied by the two parts' bounds today; checked so a change of budget can never clip a brought example.
  if (lightboxSteeringExampleText(anchored).length > WORKSHOP_LIGHTBOX_TILE_LIMITS.pointCharacters) {
    return { fault: 'fit' };
  }
  return { example: anchored };
}

/**
 * Group G's task lines: each figure by id, with what an instance of it is,
 * and the figures the chapter holds none of (the numbers rows' instance
 * counts decide that; no count is written).
 */
export function lightboxSteeringTaskLines(rows: readonly LightboxNumberRow[] | undefined): string[] {
  const instances = (stat: LightboxSteeringStatId) => rows?.find((row) => row.stat === stat)?.instances ?? 0;
  return [
    'Read each of these figures by its id, whatever its rate. A quote counts only when it holds an instance exactly as described:',
    ...LIGHTBOX_STEERING_STATS.map((stat) => instances(stat) > 0
      ? `- \`${stat}\`: an instance is ${lightboxPatternInstancePhrase(stat)}`
      : `- \`${stat}\`: the board found no instance in this chapter, so give no figure for it.`)
  ];
}
