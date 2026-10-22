/**
 * The rules this build measures with (ADR 2026-10-19 D12 addendum; Slice
 * 5A). A board built now carries these ids; a board opened from a file keeps
 * the ids it was saved with. Each id is defined beside its rule, and
 * `measurementRuleIds.test.ts` pins each to its rule's output.
 */

import type { LightboxMeasureRules } from '@messages';
import { LIGHTBOX_PARAGRAPH_RULE_ID } from '@/infrastructure/lightbox/LightboxParagraphs';
import { PROSE_SENTENCE_RULE_ID } from '@/tools/measure/passageProseStats';
import { DIALOGUE_SPANS_RULE_ID } from '@/utils/dialogueSpans';
import { BEING_VERBS_RULE_ID } from '@/tools/measure/beingVerbs';
import { LIGHTBOX_OPINION_BASIS_RULE_ID } from '@shared/constants/lightboxOpinionBasis';

export const LIGHTBOX_MEASURE_RULES: Readonly<LightboxMeasureRules> = Object.freeze({
  paragraphs: LIGHTBOX_PARAGRAPH_RULE_ID,
  sentences: PROSE_SENTENCE_RULE_ID,
  dialogue: DIALOGUE_SPANS_RULE_ID,
  beingVerbs: BEING_VERBS_RULE_ID,
  opinionBasis: LIGHTBOX_OPINION_BASIS_RULE_ID
});

/** A fresh copy of this build's rules, for a board built now. */
export function currentLightboxMeasureRules(): LightboxMeasureRules {
  return { ...LIGHTBOX_MEASURE_RULES };
}
