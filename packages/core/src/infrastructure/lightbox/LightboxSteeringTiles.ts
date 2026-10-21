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
 * - **The one example is anchored** (`anchorLightboxSteeringExample`): its
 *   `before` must be a run of whole words of the note's checked quote, as
 *   the chapter has it, that holds an instance of the figure. Found by the
 *   verifier's own rules (exact, then folded), through a span filter, so
 *   what the board shows as `before` is the chapter's own text. Otherwise
 *   the example alone is withheld, with the host's reason, and the note
 *   stands. The example is never evidence and never a quote.
 * - **The task lines** say what an instance of each figure is, and which
 *   figures the chapter holds none of (no count is given).
 */

import type {
  LightboxNumberRow,
  LightboxSteeringExample,
  LightboxSteeringNoteTile,
  LightboxSteeringStatId,
  LightboxVerifiedQuote
} from '@messages';
import { LIGHTBOX_NUMBER_STAT_LABELS } from '@shared/constants/lightbox';
import { LIGHTBOX_STEERING_STATS } from '@shared/constants/lightboxSteering';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import type { LightboxClaimAssembler } from '@/infrastructure/lightbox/LightboxReadingTiles';
import {
  lightboxPatternInstanceFilter,
  lightboxPatternInstancePhrase,
  verifyLightboxPatternInstance
} from '@/infrastructure/lightbox/LightboxNumberInstances';
import { LIGHTBOX_STEERING_EXAMPLE_REASONS } from '@/infrastructure/lightbox/LightboxSteeringCodec';
import { lightboxSteeringNoteTitle, type LightboxDecodedSteeringBlock } from '@/infrastructure/lightbox/LightboxSteeringWire';

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
          quotes: [{ para: note.para, quote: note.quote }], terms: [], support: [], friction, verifyQuote },
        (base) => ({
          ...base,
          kind: 'steering-note',
          stat,
          stance: note.stance,
          ordinal: note.ordinal,
          ...(note.nudge !== undefined ? { nudge: note.nudge } : {}),
          ...lightboxSteeringExampleFields(verifier, stat, base.evidence[0], note.example, note.exampleWithheld, 'fresh')
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
  const anchored = quote ? anchorLightboxSteeringExample(verifier, stat, quote, example) : undefined;
  if (!anchored) {
    return { exampleWithheld: phase === 'fresh' ? LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchored : LIGHTBOX_STEERING_EXAMPLE_REASONS.unanchoredCarried };
  }
  return { example: anchored, ...(withheld ? { exampleWithheld: withheld } : {}) };
}

/**
 * The example with its `before` as the chapter has it, when `before` is a
 * run of whole words inside the checked quote's span that holds an instance
 * of the figure; else undefined. The quote is the note's own, as verified,
 * so the example can never anchor anywhere else in the chapter.
 */
export function anchorLightboxSteeringExample(
  verifier: LightboxQuoteVerifier,
  stat: LightboxSteeringStatId,
  quote: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'>,
  example: LightboxSteeringExample
): LightboxSteeringExample | undefined {
  const source = verifier.paragraphs[quote.paragraph - 1];
  if (source === undefined) {
    return undefined;
  }
  const spans: Array<{ start: number; end: number }> = [];
  for (let at = source.indexOf(quote.text); at >= 0; at = source.indexOf(quote.text, at + 1)) {
    spans.push({ start: at, end: at + quote.text.length });
  }
  const holds = lightboxPatternInstanceFilter(stat, verifier.paragraphs);
  const whole = (start: number, end: number) =>
    !WORD_CHARACTER.test(source[start - 1] ?? '') && !WORD_CHARACTER.test(source[end] ?? '') &&
    WORD_CHARACTER.test(source[start] ?? '') && WORD_CHARACTER.test(source[end - 1] ?? '');
  const verdict = verifier.verify(quote.paragraph, example.before, (paragraph, start, end) =>
    paragraph === quote.paragraph &&
    spans.some((span) => span.start <= start && end <= span.end) &&
    whole(start, end) &&
    holds(paragraph, start, end));
  return verdict.found && verdict.paragraph === quote.paragraph ? { before: verdict.text, after: example.after } : undefined;
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
