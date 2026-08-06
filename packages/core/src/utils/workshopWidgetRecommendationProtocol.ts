/** Feature-neutral protocol primitives for Workshop widget recommendations. */

import { WorkshopWidgetRecommendation } from '@messages';

export const TRY_WIDGET_HEADING = '### Try a widget';
export const WIDGET_RECOMMENDATION_FRAME_START =
  '<workshop-widget-recommendation version="1">';
export const WIDGET_RECOMMENDATION_FRAME_END = '</workshop-widget-recommendation>';
export const WIDGET_RECOMMENDATION_ID_START = '<widget-id>';
export const WIDGET_RECOMMENDATION_ID_END = '</widget-id>';

export type WorkshopWidgetRecommendationRejection =
  | 'duplicate_heading'
  | 'frame_too_long'
  | 'invalid_frame'
  | 'unknown_or_unavailable_widget'
  | 'invalid_field'
  | 'field_too_long';

export type WorkshopWidgetRecommendationField =
  | 'targetPhrase'
  | 'writerInstructions'
  | 'contextText'
  | 'sourceReferences'
  | 'characterNotes'
  | 'lensSlug'
  | 'weight'
  | 'reach'
  | 'metaphorPull';

export type WorkshopWidgetRecommendationInvalidFieldReason =
  | 'empty'
  | 'target_missing_from_context'
  | 'invalid_source_references'
  | 'unsupported_lens'
  | 'invalid_weight'
  | 'invalid_reach'
  | 'invalid_metaphor_pull';

interface WorkshopWidgetRecommendationRejectedBase {
  outcome: 'rejected';
  recommendation?: undefined;
}

export type WorkshopWidgetRecommendationInspection =
  | { outcome: 'absent'; recommendation?: undefined }
  | { outcome: 'accepted'; recommendation: WorkshopWidgetRecommendation }
  | (WorkshopWidgetRecommendationRejectedBase & {
      rejection: Exclude<
      WorkshopWidgetRecommendationRejection,
        'field_too_long' | 'frame_too_long' | 'invalid_field'
      >;
    })
  | (WorkshopWidgetRecommendationRejectedBase & {
      rejection: 'invalid_field';
      field: WorkshopWidgetRecommendationField;
      reason: WorkshopWidgetRecommendationInvalidFieldReason;
    })
  | (WorkshopWidgetRecommendationRejectedBase & {
      rejection: 'field_too_long';
      field: WorkshopWidgetRecommendationField;
      actualCharacters: number;
      maximumCharacters: number;
    })
  | (WorkshopWidgetRecommendationRejectedBase & {
      rejection: 'frame_too_long';
      actualCharacters: number;
      maximumCharacters: number;
    });

export interface WorkshopWidgetRecommendationEntry {
  readonly widgetId: WorkshopWidgetRecommendation['widgetId'];
  /** One clause used by the generic contract introduction. */
  readonly catalogSummary: string;
  /** Complete feature-owned instructions and example frame. */
  readonly instruction: string;
  inspect(sectionLines: readonly string[]): WorkshopWidgetRecommendationInspection;
}

export function extractWorkshopWidgetRecommendationId(
  sectionLines: readonly string[]
): string | undefined {
  const starts = sectionLines.flatMap((line, index) =>
    line === WIDGET_RECOMMENDATION_ID_START ? [index] : []
  );
  const ends = sectionLines.flatMap((line, index) =>
    line === WIDGET_RECOMMENDATION_ID_END ? [index] : []
  );
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    return undefined;
  }
  return sectionLines.slice(starts[0] + 1, ends[0]).join('\n').trim();
}

/**
 * Validate exact marker multiplicity/order and reject text outside the frame
 * or between adjacent control tags. Field bodies remain feature-owned.
 */
export function inspectExactWorkshopWidgetRecommendationFrame(
  sectionLines: readonly string[],
  orderedMarkers: readonly string[]
): Map<string, number> | WorkshopWidgetRecommendationInspection {
  const indexes = new Map<string, number>();
  for (const marker of orderedMarkers) {
    const found = sectionLines.flatMap((line, index) => line === marker ? [index] : []);
    if (found.length !== 1) {
      return { outcome: 'rejected', rejection: 'invalid_frame' };
    }
    indexes.set(marker, found[0]);
  }

  const ordered = orderedMarkers.map((marker) => indexes.get(marker)!);
  if (ordered.some((index, ordinal) => ordinal > 0 && index <= ordered[ordinal - 1])) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }

  const frameStartIndex = indexes.get(WIDGET_RECOMMENDATION_FRAME_START)!;
  const frameEndIndex = indexes.get(WIDGET_RECOMMENDATION_FRAME_END)!;
  if (
    sectionLines.slice(0, frameStartIndex).some((line) => line.trim().length > 0)
    || sectionLines.slice(frameEndIndex + 1).some((line) => line.trim().length > 0)
  ) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }

  const boundaryGaps = orderedMarkers.flatMap((marker, index) =>
    index % 2 === 0
      ? [[marker, orderedMarkers[index + 1]] as const]
      : []
  );
  if (boundaryGaps.some(([left, right]) => sectionLines
    .slice(indexes.get(left)! + 1, indexes.get(right)!)
    .some((line) => line.trim().length > 0))) {
    return { outcome: 'rejected', rejection: 'invalid_frame' };
  }

  return indexes;
}

export function workshopWidgetRecommendationField(
  sectionLines: readonly string[],
  indexes: ReadonlyMap<string, number>,
  start: string,
  end: string
): string {
  return sectionLines
    .slice(indexes.get(start)! + 1, indexes.get(end)!)
    .join('\n')
    .trim();
}
