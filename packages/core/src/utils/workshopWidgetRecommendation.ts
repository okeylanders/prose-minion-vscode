/**
 * Deterministic extraction of persona widget recommendations
 * (ADR 2026-07-22 decision 13, actionable-findings mold): a bounded contract
 * instruction, a strict fail-closed parse, and a typed field on the turn.
 * Malformed sections reject wholesale, and ids that are not `live` in the
 * widget registry reject too — comp-only widgets never render chips. The
 * model recommends; only the writer commits.
 *
 * Lives under `@/utils` (not the application layer) for the same reason as
 * workshopPromptFrames: the contract instruction rides the INITIAL persona
 * envelope, which is assembled in infrastructure, and infrastructure must
 * not import application.
 */

import { WorkshopWidgetRecommendation } from '@messages';
import { isLiveWorkshopWidgetId } from '@shared/constants/workshopWidgets';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export const WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION = [
  '<workshop-widget-recommendation-contract>',
  'The writer has an interactive Gesture Playground widget: it generates a menu of gesture/expression directions for one phrase, and the writer picks what to keep. When reworking a specific gesture or expression beat would genuinely help, you may end your message with exactly `### Try a widget` and ONE single-line item:',
  '- gesture-playground | phrase: <the exact phrase from the passage> | notes: <one line on who this character is in this beat>',
  'Both `| phrase:` and `| notes:` are optional prefills the writer can edit before anything runs. Recommend at most once per message, only while the writer is actively reworking a beat, and never with a phrase that is not in the passage. Do not describe the widget mechanics in prose — the chip does that.',
  '</workshop-widget-recommendation-contract>'
].join('\n');

const TRY_WIDGET_HEADING = '### Try a widget';
const ANY_HEADING = /^#{1,6}\s+/;
const LIST_ITEM = /^[-*+]\s+(.+)$/;

export type WorkshopWidgetRecommendationRejection =
  | 'duplicate_heading'
  | 'not_exactly_one_item'
  | 'unknown_or_unavailable_widget'
  | 'invalid_field'
  | 'field_too_long';

export type WorkshopWidgetRecommendationInspection =
  | { outcome: 'absent'; recommendation?: undefined }
  | { outcome: 'accepted'; recommendation: WorkshopWidgetRecommendation }
  | {
      outcome: 'rejected';
      recommendation?: undefined;
      rejection: WorkshopWidgetRecommendationRejection;
    };

/**
 * Parse one exact `### Try a widget` section carrying exactly one single-line
 * item: a live widget id, optionally followed by `| phrase:` / `| notes:`
 * prefill fields. Anything else rejects wholesale.
 */
export function inspectWorkshopWidgetRecommendation(
  content: string
): WorkshopWidgetRecommendationInspection {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headingIndexes = lines.flatMap((line, index) =>
    line.trim() === TRY_WIDGET_HEADING ? [index] : []
  );
  if (headingIndexes.length === 0) {
    return { outcome: 'absent' };
  }
  if (headingIndexes.length > 1) {
    return { outcome: 'rejected', rejection: 'duplicate_heading' };
  }

  const sectionLines: string[] = [];
  for (let index = headingIndexes[0] + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (ANY_HEADING.test(line.trim())) {
      break;
    }
    sectionLines.push(line);
  }

  const meaningfulLines = sectionLines.map((line) => line.trim()).filter((line) => line.length > 0);
  if (meaningfulLines.length !== 1) {
    return { outcome: 'rejected', rejection: 'not_exactly_one_item' };
  }

  const item = LIST_ITEM.exec(meaningfulLines[0]);
  if (!item) {
    return { outcome: 'rejected', rejection: 'not_exactly_one_item' };
  }

  const segments = item[1].split('|').map((segment) => segment.trim());
  const widgetId = segments.shift();
  if (!isLiveWorkshopWidgetId(widgetId)) {
    return { outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' };
  }

  const budget = PROMPT_BUDGETS.workshopWidgets;
  let targetPhrase: string | undefined;
  let characterNotes: string | undefined;
  for (const segment of segments) {
    const phraseMatch = /^phrase:\s*(.+)$/.exec(segment);
    const notesMatch = /^notes:\s*(.+)$/.exec(segment);
    if (phraseMatch && targetPhrase === undefined) {
      targetPhrase = phraseMatch[1].trim().replace(/^["'“‘]|["'”’]$/g, '');
      if (targetPhrase.length === 0 || targetPhrase.length > budget.gestureTargetPhraseCharacters) {
        return { outcome: 'rejected', rejection: 'field_too_long' };
      }
    } else if (notesMatch && characterNotes === undefined) {
      characterNotes = notesMatch[1].trim();
      if (
        characterNotes.length === 0
        || characterNotes.length > budget.gestureCharacterNotesCharacters
      ) {
        return { outcome: 'rejected', rejection: 'field_too_long' };
      }
    } else {
      return { outcome: 'rejected', rejection: 'invalid_field' };
    }
  }

  const seed = targetPhrase !== undefined || characterNotes !== undefined
    ? {
        ...(targetPhrase !== undefined ? { targetPhrase } : {}),
        ...(characterNotes !== undefined ? { characterNotes } : {})
      }
    : undefined;
  return {
    outcome: 'accepted',
    recommendation: { widgetId, ...(seed ? { seed } : {}) }
  };
}
