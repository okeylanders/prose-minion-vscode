/** Closed presentation registry for standing-directive summaries and markers. */

import {
  WorkshopStandingDirectiveSnapshot,
  WorkshopStandingDirectiveSummary,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import {
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  WorkshopStandingDirectiveOperations
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';

export function summarizeWorkshopStandingDirective(
  directive: WorkshopStandingDirectiveSnapshot,
  config: WorkshopWidgetConfigSnapshot,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): WorkshopStandingDirectiveSummary {
  if (directive.widgetId !== config.widgetId) {
    throw new Error(`Standing directive ${directive.id} has no matching widget config`);
  }
  return operations.summarize(directive, config);
}

export function workshopStandingDirectiveMarkerContent(
  action: 'installed' | 'shifted' | 'removed',
  directive: WorkshopStandingDirectiveSnapshot,
  previousConfig?: WorkshopWidgetConfigSnapshot,
  currentConfig?: WorkshopWidgetConfigSnapshot,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): string {
  return operations.markerContent(
    action,
    directive,
    previousConfig,
    currentConfig
  );
}
