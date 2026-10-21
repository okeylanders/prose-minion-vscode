/**
 * Whether a resolved Lightbox source can be boarded, and the preview it is
 * shown by (ADR 2026-10-19 D8). Pure. Split from `LightboxService` (Slice
 * 4B) so that module keeps within its size.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { countWords } from '@/utils/textUtils';
import type { LightboxSourceInput, LightboxSourceRefusalDraft } from '@/infrastructure/lightbox/LightboxService';

const PREVIEW_CHARACTERS = 360;

/** Why a resolved source cannot be boarded (D8), or undefined when it can. */
export function checkLightboxSource(input: LightboxSourceInput): LightboxSourceRefusalDraft | undefined {
  if (input.text.trim().length === 0) {
    return {
      reason: 'empty',
      message: 'That source has no text to board.',
      displayPath: input.displayPath
    };
  }
  const ceilingWords = PROMPT_BUDGETS.lightbox.sourceWords;
  const wordCount = countWords(input.text);
  if (wordCount > ceilingWords) {
    return {
      reason: 'over-ceiling',
      message: `This source has ${wordCount.toLocaleString('en-US')} words. ` +
        `The Lightbox boards up to ${ceilingWords.toLocaleString('en-US')} words at a time.`,
      displayPath: input.displayPath,
      wordCount,
      ceilingWords,
      suggestion: 'Choose a single chapter, or select a passage and open the selection in the Lightbox.'
    };
  }
  return undefined;
}

/** The opening of the text, cut at a word boundary. */
export function lightboxSourcePreview(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= PREVIEW_CHARACTERS) {
    return trimmed;
  }
  const cut = trimmed.slice(0, PREVIEW_CHARACTERS);
  const lastSpace = cut.search(/\s\S*$/);
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
