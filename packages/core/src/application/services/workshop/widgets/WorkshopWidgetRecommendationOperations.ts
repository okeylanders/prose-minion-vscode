/**
 * Closed Workshop widget-recommendation registry and family-wide operations.
 *
 * Each named feature owns its prompt copy, markers, field vocabulary, and
 * parser. This module is the one application seam that composes those slices
 * into a bounded prompt contract and dispatches accepted live widget ids.
 */

import {
  WorkshopWidgetId,
  WorkshopWidgetRecommendation
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY,
  type WorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  CreativeVariationsRecommendationField,
  CreativeVariationsRecommendationInvalidFieldReason,
  CREATIVE_VARIATIONS_WIDGET_RECOMMENDATION_ENTRY
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsRecommendation';
import {
  GesturePlaygroundRecommendationField,
  GesturePlaygroundRecommendationInvalidFieldReason,
  GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundRecommendation';
import {
  LexicalGravityRecommendationField,
  LexicalGravityRecommendationInvalidFieldReason,
  LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityRecommendation';
import {
  extractWorkshopWidgetRecommendationId,
  TRY_WIDGET_HEADING,
  WorkshopWidgetRecommendationEntry,
  WorkshopWidgetRecommendationInspection as ProtocolWorkshopWidgetRecommendationInspection
} from '@/utils/workshopWidgetRecommendationProtocol';

export type WorkshopWidgetRecommendationField =
  | CreativeVariationsRecommendationField
  | GesturePlaygroundRecommendationField
  | LexicalGravityRecommendationField;

export type WorkshopWidgetRecommendationInvalidFieldReason =
  | CreativeVariationsRecommendationInvalidFieldReason
  | GesturePlaygroundRecommendationInvalidFieldReason
  | LexicalGravityRecommendationInvalidFieldReason;

export type WorkshopWidgetRecommendationInspection =
  ProtocolWorkshopWidgetRecommendationInspection<
    WorkshopWidgetRecommendation,
    WorkshopWidgetRecommendationField,
    WorkshopWidgetRecommendationInvalidFieldReason
  >;

export type {
  WorkshopWidgetRecommendationRejection
} from '@/utils/workshopWidgetRecommendationProtocol';

type RecommendationWidgetId = WorkshopWidgetRecommendation['widgetId'];

/**
 * The only generic-to-feature recommendation dispatch point. A new live
 * recommendation arm must supply one named entry and make this Record compile.
 */
export const WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES = Object.freeze({
  'gesture-playground': GESTURE_PLAYGROUND_WIDGET_RECOMMENDATION_ENTRY,
  'lexical-gravity': LEXICAL_GRAVITY_WIDGET_RECOMMENDATION_ENTRY,
  'creative-variations': CREATIVE_VARIATIONS_WIDGET_RECOMMENDATION_ENTRY
}) satisfies Readonly<
  Record<RecommendationWidgetId, WorkshopWidgetRecommendationEntry>
>;

function availableRecommendationEntries(
  availability: WorkshopWidgetAvailabilityPolicy
): WorkshopWidgetRecommendationEntry[] {
  return Object.values(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES)
    .filter(({ widgetId }) => availability.isAvailable(widgetId));
}

export function buildWorkshopWidgetRecommendationInstruction(
  availability: WorkshopWidgetAvailabilityPolicy
): string {
  const availableEntries = availableRecommendationEntries(availability);
  return [
    '<workshop-widget-recommendation-contract>',
    `The writer has the following interactive widgets you may recommend: ${[
      ...availableEntries
    ]
      .sort((left, right) => left.catalogOrder - right.catalogOrder)
      .map(({ catalogSummary }) => catalogSummary)
      .join('; ')}.`,
    'Each response is independent: recommend at most one widget in this response, and only when it would genuinely help. A recommendation or uncommitted chip from an earlier turn never counts against this response and never suppresses a fresh recommendation. When the writer explicitly asks you to prepare or configure a live widget, emit a fresh, complete frame if the supplied material supports its required fields; do not merely acknowledge the request. End your response with exactly one of the multiline control frames below. If you also emit `### Next steps`, put that section before `### Try a widget`; the widget frame must be the final content in the response.',
    'Use the reserved heading and every tag in the selected frame exactly once, alone on their lines. Do not repeat the heading or use any reserved tag inside a field.',
    ...[...availableEntries]
      .sort((left, right) => left.instructionOrder - right.instructionOrder)
      .map(({ instruction }) => instruction),
    '</workshop-widget-recommendation-contract>'
  ].join('\n');
}

export const WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION =
  buildWorkshopWidgetRecommendationInstruction(
    WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY
  );

const WIDGET_BUDGET = PROMPT_BUDGETS.workshopWidgets;

/** Existing family-wide safety ceiling for the complete recommendation tail. */
export const WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS =
  Math.max(
    WIDGET_BUDGET.gestureTargetPhraseCharacters
      + WIDGET_BUDGET.gestureWriterInstructionsCharacters
      + WIDGET_BUDGET.gestureContextCharacters
      + WIDGET_BUDGET.gestureCharacterNotesCharacters
      + WIDGET_BUDGET.gestureSourceReferenceCharacters
      + WIDGET_BUDGET.gestureRecommendationFrameAllowanceCharacters,
    WIDGET_BUDGET.creativeSubjectCharacters
      + WIDGET_BUDGET.creativeContextCharacters
      + WIDGET_BUDGET.creativeSourceReferences
        * WIDGET_BUDGET.creativeSourceReferenceCharacters
      + WIDGET_BUDGET.creativeMustSurviveCharacters
      + WIDGET_BUDGET.creativeMustNotChangeCharacters
      + WIDGET_BUDGET.creativeAimCharacters
      + WIDGET_BUDGET.creativeRecommendationFrameAllowanceCharacters
  );

/**
 * Parse one exact `### Try a widget` section carrying a versioned multiline
 * frame. Feature fields dispatch through the exact registry above; malformed,
 * incomplete, duplicated, unavailable, or over-budget controls reject whole.
 */
export function inspectWorkshopWidgetRecommendation(
  content: string,
  availability: WorkshopWidgetAvailabilityPolicy
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
  if (
    !widgetId
    || !isRecommendationWidgetId(widgetId)
    || !availability.isAvailable(widgetId)
  ) {
    return { outcome: 'rejected', rejection: 'unknown_or_unavailable_widget' };
  }
  return WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES[widgetId].inspect(sectionLines);
}

function isRecommendationWidgetId(value: string): value is RecommendationWidgetId {
  return Object.prototype.hasOwnProperty.call(WORKSHOP_WIDGET_RECOMMENDATION_ENTRIES, value);
}
