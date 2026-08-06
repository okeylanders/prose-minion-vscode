/**
 * Feature-neutral Workshop widget-recommendation envelope and closed dispatch.
 * Feature prompt copy, markers, and validation live in their named widget
 * packages; this module owns only the bounded frame, live-id gate, registry,
 * and transcript/retention cleanup shared by the family.
 */

import {
  WorkshopWidgetId,
  WorkshopWidgetRecommendation
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isLiveWorkshopWidgetId } from '@shared/constants/workshopWidgets';
import {
  GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation';
import {
  LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation';
import {
  extractWorkshopWidgetRecommendationId,
  TRY_WIDGET_HEADING,
  WorkshopWidgetRecommendationEntry,
  WorkshopWidgetRecommendationField,
  WorkshopWidgetRecommendationInspection,
  WorkshopWidgetRecommendationInvalidFieldReason,
  WorkshopWidgetRecommendationRejection
} from '@/utils/workshopWidgetRecommendationProtocol';

export type {
  WorkshopWidgetRecommendationField,
  WorkshopWidgetRecommendationInspection,
  WorkshopWidgetRecommendationInvalidFieldReason,
  WorkshopWidgetRecommendationRejection
} from '@/utils/workshopWidgetRecommendationProtocol';

type RecommendationWidgetId = WorkshopWidgetRecommendation['widgetId'];

/**
 * The only generic-to-feature recommendation dispatch point. A new live
 * recommendation arm must supply one named entry and make this Record compile.
 */
export const WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES: Readonly<
  Record<RecommendationWidgetId, WorkshopWidgetRecommendationEntry>
> = Object.freeze({
  'gesture-playground': GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY,
  'lexical-gravity': LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY
});

const CATALOG_ENTRIES = [
  GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY,
  LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY
] as const;
const INSTRUCTION_ENTRIES = [
  LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY,
  GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY
] as const;

export const WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION = [
  '<workshop-widget-recommendation-contract>',
  `The writer has two interactive widgets you may recommend: ${CATALOG_ENTRIES
    .map(({ catalogSummary }) => catalogSummary)
    .join('; ')}.`,
  'Each response is independent: recommend at most one widget in this response, and only when it would genuinely help. A recommendation or uncommitted chip from an earlier turn never counts against this response and never suppresses a fresh recommendation. When the writer explicitly asks you to prepare or configure a live widget, emit a fresh, complete frame if the supplied material supports its required fields; do not merely acknowledge the request. End your response with exactly one of the multiline control frames below. If you also emit `### Next steps`, put that section before `### Try a widget`; the widget frame must be the final content in the response.',
  ...INSTRUCTION_ENTRIES.map(({ instruction }) => instruction),
  '</workshop-widget-recommendation-contract>'
].join('\n');

const WIDGET_BUDGET = PROMPT_BUDGETS.workshopWidgets;

/** Existing family-wide safety ceiling for the complete recommendation tail. */
export const WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS =
  WIDGET_BUDGET.gestureTargetPhraseCharacters
  + WIDGET_BUDGET.gestureWriterInstructionsCharacters
  + WIDGET_BUDGET.gestureContextCharacters
  + WIDGET_BUDGET.gestureCharacterNotesCharacters
  + WIDGET_BUDGET.gestureSourceReferenceCharacters
  + WIDGET_BUDGET.gestureRecommendationFrameAllowanceCharacters;

/**
 * Parse one exact `### Try a widget` section carrying a versioned multiline
 * frame. Feature fields dispatch through the exact registry above; malformed,
 * incomplete, duplicated, unavailable, or over-budget controls reject whole.
 */
export function inspectWorkshopWidgetRecommendation(
  content: string
): WorkshopWidgetRecommendationInspection {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headingIndexes = lines.flatMap((line, index) =>
    line === TRY_WIDGET_HEADING ? [index] : []
  );
  if (headingIndexes.length === 0) {
    return { outcome: 'absent' };
  }
  if (headingIndexes.length > 1) {
    return { outcome: 'rejected', rejection: 'duplicate_heading' };
  }

  const sectionLines = lines.slice(headingIndexes[0] + 1);
  const sectionCharacters = sectionLines.join('\n').length;
  if (sectionCharacters > WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS) {
    return {
      outcome: 'rejected',
      rejection: 'frame_too_long',
      actualCharacters: sectionCharacters,
      maximumCharacters: WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS
    };
  }

  const widgetId = extractWorkshopWidgetRecommendationId(sectionLines);
  if (!widgetId || !isLiveWorkshopWidgetId(widgetId) || !isRecommendationWidgetId(widgetId)) {
    return { outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' };
  }
  return WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES[widgetId].inspect(sectionLines);
}

function isRecommendationWidgetId(value: WorkshopWidgetId): value is RecommendationWidgetId {
  return Object.prototype.hasOwnProperty.call(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES, value);
}

/**
 * Recommendation controls render as chips and editable forms, not machine
 * framing in the transcript. The reserved heading owns the final tail even
 * when a frame rejects, so malformed debris cannot persist as prose.
 */
export function stripWorkshopWidgetRecommendationControl(content: string): string {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const headingIndex = lines.findIndex((line) => line === TRY_WIDGET_HEADING);
  return headingIndex >= 0
    ? lines.slice(0, headingIndex).join('\n').trimEnd()
    : content;
}

/** Remove the private widget protocol before retained provider history. */
export function sanitizeWorkshopWidgetRecommendationForRetention(content: string): string {
  const stripped = stripWorkshopWidgetRecommendationControl(content).trim();
  return stripped || '[Widget setup delivered through the Workshop interface.]';
}
