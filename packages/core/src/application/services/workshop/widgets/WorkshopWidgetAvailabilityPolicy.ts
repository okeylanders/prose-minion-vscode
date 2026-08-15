/** Route-time availability for the closed Conversation Widget catalog. */

import type { WorkshopWidgetId } from '@messages';
import { isLiveWorkshopWidgetId } from '@shared/constants/workshopWidgets';

export interface WorkshopWidgetAvailabilityPolicy {
  isAvailable: (widgetId: WorkshopWidgetId) => boolean;
}

/** Production policy: the catalog remains the sole shipped-availability truth. */
export const WORKSHOP_WIDGET_CATALOG_AVAILABILITY_POLICY: WorkshopWidgetAvailabilityPolicy =
  Object.freeze({
    isAvailable: isLiveWorkshopWidgetId
  });

/**
 * Fixed policy for isolated route tests that must exercise an exact
 * availability set. It never changes or replaces the production catalog.
 */
export function fixedWorkshopWidgetAvailabilityPolicy(
  availableWidgetIds: readonly WorkshopWidgetId[]
): WorkshopWidgetAvailabilityPolicy {
  const available = new Set(availableWidgetIds);
  return Object.freeze({
    isAvailable: (widgetId: WorkshopWidgetId) => available.has(widgetId)
  });
}
