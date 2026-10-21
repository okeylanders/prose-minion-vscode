/**
 * Dialogue is voice (epic decision 26; ADR 2026-10-19 D7, the 2026-10-21
 * addendum on dialogue). Pure: no host, no I/O, no model.
 *
 * Craft steering's figures are a craft signal in narration. In dialogue
 * they are the character's voice, so a note whose instance stands in
 * dialogue may be drawn, and may read the pattern it makes, with any
 * stance, but it carries no nudge and no example. This is the host's rule,
 * not only the prompt's, and it holds fresh, on carry and at Bring:
 * - **Where the instance stands.** The note's checked quote is found again
 *   by the verifier's own rules, through the figure's instance filter, as
 *   the quote check found it. The instances its span holds, by the
 *   figure's own detector, are in dialogue when each lies inside a span of
 *   `findDialogueSpans`, the matcher craft steering's narration and
 *   dialogue split uses. Its limit applies: single-quoted speech (‘…’, or
 *   Gutenberg's '…') reads as narration. A quote holding an instance in
 *   narration is a narration note, whatever else it holds.
 * - **In dialogue.** A nudge and example the reading gave are withheld,
 *   with the host's reason (`voice`); the note and its stance stand. A note
 *   that leans or compensates with no nudge is shown with the same kind of
 *   line, saying the board offers none there.
 * - **In narration.** A note that leans or compensates names its nudge, as
 *   before: one with none is withheld by the gate (`LightboxTileGates`),
 *   fresh, or on carry when its instance has left dialogue. Its example
 *   anchors only on an instance in narration
 *   (`anchorLightboxSteeringExample`), so it never rewrites a line a
 *   character speaks.
 */

import type { LightboxSteeringNoteTile, LightboxSteeringStatId, LightboxVerifiedQuote } from '@messages';
import { findDialogueSpans } from '@/utils/dialogueSpans';
import { LIGHTBOX_NUMBER_PATTERNS } from '@/infrastructure/lightbox/LightboxNumbers';
import type { LightboxQuoteVerifier } from '@/infrastructure/lightbox/LightboxQuoteVerifier';

/** Where a note's instance stands: the character's voice, or the narration's craft. */
export type LightboxSteeringVoice = 'dialogue' | 'narration';

/** A read note's voice line, in host words: each fits one Workshop point (120 characters). */
export const LIGHTBOX_STEERING_VOICE_REASONS = {
  /** The reading gave no nudge, as the prompt asks for an instance in dialogue. */
  none: 'Its instance is in dialogue, the character\'s voice: the board reads it there but offers no nudge or example.',
  /** The reading gave a nudge or an example there anyway. */
  withheld: {
    fresh: 'Its instance is in dialogue, the character\'s voice, so no nudge or example the reading gave is shown.',
    carried: 'Its instance now stands in dialogue, the character\'s voice, so its nudge, and any example, are no longer shown.'
  }
} as const;

/**
 * Where the instances of the note's checked `quote` stand: `dialogue` when
 * every instance of `stat` its span holds lies inside dialogue, `narration`
 * when one does not; undefined when the quote holds no instance there.
 */
export function lightboxSteeringInstanceVoice(
  verifier: LightboxQuoteVerifier,
  stat: LightboxSteeringStatId,
  quote: Pick<LightboxVerifiedQuote, 'paragraph' | 'text'> | undefined
): LightboxSteeringVoice | undefined {
  const source = quote ? verifier.paragraphs[quote.paragraph - 1] : undefined;
  if (!quote || source === undefined) {
    return undefined;
  }
  const instances = LIGHTBOX_NUMBER_PATTERNS[stat](source);
  const dialogue = findDialogueSpans(source);
  const spoken = (start: number, end: number) => dialogue.some((span) => span.start <= start && end <= span.end);
  let voice: LightboxSteeringVoice | undefined;
  // The first span the verifier accepts that holds an instance: the span the quote check found.
  verifier.verify(quote.paragraph, quote.text, (paragraph, start, end) => {
    const held = paragraph === quote.paragraph ? instances.filter((match) => start <= match.start && match.end <= end) : [];
    if (held.length === 0) {
      return false;
    }
    voice = held.every((match) => spoken(match.start, match.end)) ? 'dialogue' : 'narration';
    return true;
  });
  return voice;
}

/** Whether `start`–`end` of a paragraph (1-based) holds an instance of `stat` in narration: where an example may anchor. */
export function lightboxSteeringNarrationFilter(
  verifier: LightboxQuoteVerifier,
  stat: LightboxSteeringStatId
): (paragraph: number, start: number, end: number) => boolean {
  const found = new Map<number, Array<{ start: number; end: number }>>();
  return (paragraph, start, end) => {
    const source = verifier.paragraphs[paragraph - 1];
    if (source === undefined) {
      return false;
    }
    if (!found.has(paragraph)) {
      const dialogue = findDialogueSpans(source);
      found.set(paragraph, LIGHTBOX_NUMBER_PATTERNS[stat](source)
        .filter((match) => !dialogue.some((span) => span.start <= match.start && match.end <= span.end)));
    }
    return (found.get(paragraph) ?? []).some((match) => start <= match.start && match.end <= end);
  };
}

/** The fields of a note the voice rule decides. */
export type LightboxSteeringVoiceFields = Pick<LightboxSteeringNoteTile, 'stance' | 'nudge' | 'example' | 'exampleWithheld' | 'voice'>;

/**
 * A note's fields under the voice rule. In dialogue, a note that leans or
 * compensates keeps its stance, loses any nudge and example (and an
 * example's reason, moot there) and gains its voice line. Anywhere else, and
 * for a note that earns, the fields are returned as they are: a leaning note
 * in narration with no nudge is the gate's to withhold.
 */
export function holdLightboxSteeringVoice<T extends LightboxSteeringVoiceFields>(
  fields: T,
  voice: LightboxSteeringVoice | undefined,
  phase: 'fresh' | 'carried'
): T {
  if (fields.stance === 'earns' || voice !== 'dialogue') {
    return fields;
  }
  const { nudge, example, exampleWithheld, voice: line, ...rest } = fields;
  const offered = nudge !== undefined || example !== undefined || exampleWithheld !== undefined;
  // A line already drawn stays as it is while its instance stays in dialogue.
  return { ...rest, voice: offered ? LIGHTBOX_STEERING_VOICE_REASONS.withheld[phase] : line ?? LIGHTBOX_STEERING_VOICE_REASONS.none } as T;
}
