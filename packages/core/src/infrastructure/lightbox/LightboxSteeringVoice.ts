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
 * - **In dialogue.** Every note says so with the host's voice line, whatever
 *   its stance (PR #162 N-01): the digest, the board, the inspector and
 *   Bring all read that line as the mark of the character's voice. A note
 *   that leans or compensates loses any nudge and example the reading gave
 *   (its line says why); one with no nudge says the board offers none
 *   there. A note that earns has nothing to withhold, and its line says
 *   only where its instance stands.
 * - **In narration.** No voice line stands. A note that leans or
 *   compensates names its nudge, as before: one with none is withheld by
 *   the gate (`LightboxTileGates`), fresh, or on carry when its instance has
 *   left dialogue. Its example anchors only on an instance in narration,
 *   and only on a span that takes in no speech at all
 *   (`anchorLightboxSteeringExample`, PR #162 F-02), so it never rewrites a
 *   word a character speaks, even beside the narration it holds.
 * Each paragraph is detected and matched once per text, and each question
 * answered by binary search (`LightboxSpanIndex`, PR #162 F-01).
 */

import type { LightboxSteeringNoteTile, LightboxSteeringStatId, LightboxVerifiedQuote } from '@messages';
import type { LightboxQuoteVerifier, LightboxSpanFilter } from '@/infrastructure/lightbox/LightboxQuoteVerifier';
import { lightboxParagraphDialogue, lightboxParagraphPattern } from '@/infrastructure/lightbox/LightboxSpanIndex';

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
  },
  /** A note that earns: nothing to withhold, its place said all the same (PR #162 N-01). */
  earns: 'Its instance is in dialogue, the character\'s voice.'
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
  if (!quote || verifier.paragraphs[quote.paragraph - 1] === undefined) {
    return undefined;
  }
  let voice: LightboxSteeringVoice | undefined;
  // The first span the verifier accepts that holds an instance: the span the quote check found.
  verifier.verify(quote.paragraph, quote.text, (paragraph, start, end) => {
    const pattern = paragraph === quote.paragraph ? lightboxParagraphPattern(verifier.paragraphs, stat, paragraph) : undefined;
    if (!pattern?.holds(start, end)) {
      return false;
    }
    voice = pattern.holdsInNarration(start, end) ? 'narration' : 'dialogue';
    return true;
  });
  return voice;
}

/** Whether `start`–`end` of a paragraph (1-based) holds an instance of `stat` in narration: where an example may anchor. */
export function lightboxSteeringNarrationFilter(verifier: LightboxQuoteVerifier, stat: LightboxSteeringStatId): LightboxSpanFilter {
  return (paragraph, start, end) => lightboxParagraphPattern(verifier.paragraphs, stat, paragraph)?.holdsInNarration(start, end) ?? false;
}

/** Whether `start`–`end` of a paragraph (1-based) takes in any speech, its quotation marks included: where an example may not anchor. */
export function lightboxSteeringSpeechFilter(verifier: LightboxQuoteVerifier): LightboxSpanFilter {
  return (paragraph, start, end) => lightboxParagraphDialogue(verifier.paragraphs, paragraph)?.overlaps(start, end) ?? false;
}

/** The fields of a note the voice rule decides. */
export type LightboxSteeringVoiceFields = Pick<LightboxSteeringNoteTile, 'stance' | 'nudge' | 'example' | 'exampleWithheld' | 'voice'>;

/**
 * A note's fields under the voice rule. In dialogue, every note carries a
 * voice line: one that leans or compensates keeps its stance, loses any
 * nudge and example (and an example's reason, moot there) and says why;
 * one that earns keeps its fields and says where it stands. Anywhere else
 * no voice line stands, and the other fields are as they are: a leaning
 * note in narration with no nudge is the gate's to withhold.
 */
export function holdLightboxSteeringVoice<T extends LightboxSteeringVoiceFields>(
  fields: T,
  voice: LightboxSteeringVoice | undefined,
  phase: 'fresh' | 'carried'
): T {
  if (voice !== 'dialogue') {
    if (fields.voice === undefined) {
      return fields;
    }
    const { voice: _line, ...unmarked } = fields;
    return unmarked as T;
  }
  if (fields.stance === 'earns') {
    return { ...fields, voice: LIGHTBOX_STEERING_VOICE_REASONS.earns };
  }
  const { nudge, example, exampleWithheld, voice: line, ...rest } = fields;
  const offered = nudge !== undefined || example !== undefined || exampleWithheld !== undefined;
  // A line already drawn stays as it is while its instance stays in dialogue.
  return { ...rest, voice: offered ? LIGHTBOX_STEERING_VOICE_REASONS.withheld[phase] : line ?? LIGHTBOX_STEERING_VOICE_REASONS.none } as T;
}
