/**
 * The writer-facing copy and log reasons for a rejected widget
 * recommendation (ADR 2026-07-22), moved out of the run-completion tree so
 * it stays one decision tree. Pure.
 */

import type { WorkshopWidgetRecommendationInspection } from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

const WIDGET_FIELD_LABELS = Object.freeze({
  targetPhrase: 'Target phrase',
  writerInstructions: 'Writer instructions',
  contextText: 'Surrounding context',
  sourceReferences: 'Source references',
  characterNotes: 'Character notes',
  subjectText: 'Subject passage',
  mustSurvive: 'Must survive',
  mustNotChange: 'Must not change',
  aim: 'Creative aim',
  distance: 'Sampling distance',
  requestedCount: 'Take count',
  lensSlug: 'Lens',
  weight: 'Weight',
  reach: 'Reach',
  metaphorPull: 'Metaphor pull',
  beatText: 'Told beat',
  subject: 'Chip subject',
  povMode: 'POV mode',
  povFocalCharacter: 'POV focal character',
  position: 'Handling position',
  channels: 'Emphasis channels',
  lengthBudget: 'Length allowance'
});

const INVALID_WIDGET_FIELD_COPY = Object.freeze({
  empty: 'was empty',
  target_missing_from_context: 'did not contain the exact target phrase',
  invalid_source_references: 'contained unavailable or malformed source references',
  invalid_distance: 'was outside the allowed sampling distances',
  invalid_requested_count: 'was not three, four, or five',
  unsupported_lens: 'named a lens that personas are not allowed to seed',
  invalid_weight: 'was outside the allowed weight steps',
  invalid_reach: 'was outside the allowed reach values',
  invalid_metaphor_pull: 'was not true or false',
  multiline: 'was not a single line',
  invalid_pov_mode: 'was outside the allowed POV modes',
  invalid_focal_character: 'named a focal character without a declared POV mode',
  invalid_position: 'was outside the allowed handling positions',
  invalid_channels: 'named an unknown or repeated channel',
  invalid_length_budget: 'was outside the allowed length allowances'
});

export function widgetRecommendationRejectionReason(
  inspection: Extract<WorkshopWidgetRecommendationInspection, { outcome: 'rejected' }>
): string {
  if (inspection.rejection === 'field_too_long') {
    return `${inspection.rejection}:${inspection.field}:`
      + `${inspection.actualCharacters}/${inspection.maximumCharacters}`;
  }
  if (inspection.rejection === 'frame_too_long') {
    return `${inspection.rejection}:${inspection.actualCharacters}/${inspection.maximumCharacters}`;
  }
  if (inspection.rejection === 'invalid_field') {
    return `${inspection.rejection}:${inspection.field}:${inspection.reason}`;
  }
  return inspection.rejection;
}

export function widgetRecommendationRejectionNotice(
  label: string,
  inspection: Extract<WorkshopWidgetRecommendationInspection, { outcome: 'rejected' }>
): { message: string; details: string } {
  const message = inspection.widgetId
    ? `${label}'s ${workshopWidgetLabel(inspection.widgetId)} setup could not be prepared.`
    : `${label}'s widget recommendation could not be prepared.`;
  if (inspection.rejection === 'field_too_long') {
    return {
      message,
      details: `${WIDGET_FIELD_LABELS[inspection.field]} used `
        + `${inspection.actualCharacters.toLocaleString('en-US')} characters; the limit is `
        + `${inspection.maximumCharacters.toLocaleString('en-US')}. Ask ${label} to try again.`
    };
  }
  if (inspection.rejection === 'frame_too_long') {
    return {
      message,
      details: `The generated setup used ${inspection.actualCharacters.toLocaleString('en-US')} `
        + `characters; the complete-frame limit is `
        + `${inspection.maximumCharacters.toLocaleString('en-US')}. Ask ${label} to try again.`
    };
  }
  if (inspection.rejection === 'invalid_field') {
    return {
      message,
      details: `${WIDGET_FIELD_LABELS[inspection.field]} `
        + `${INVALID_WIDGET_FIELD_COPY[inspection.reason]}. Ask ${label} to try again.`
    };
  }
  return {
    message,
    details: `The generated setup was incomplete or invalid. Ask ${label} to try again.`
  };
}
