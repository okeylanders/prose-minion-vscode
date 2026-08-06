/** Deterministic prompt frames for session-owned standing prose directives. */

import {
  WorkshopStandingDirectiveSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  WORKSHOP_STANDING_DIRECTIVE_OPERATIONS,
  WorkshopStandingDirectiveOperations,
  WorkshopStandingDirectiveRendering
} from '@/application/services/workshop/directives/WorkshopStandingDirectiveOperations';

export function renderWorkshopStandingDirective(
  input: WorkshopStandingDirectiveRendering,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): string {
  return operations.render(input);
}

export function renderWorkshopStandingDirectiveFrames(
  session: WorkshopSessionService,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): string[] {
  return renderWorkshopStandingDirectiveFramesForSnapshots(
    session.getStandingDirectives(),
    (configId) => session.getWidgetConfig(configId),
    operations
  );
}

export function renderWorkshopStandingDirectiveFramesForSnapshots(
  directives: readonly WorkshopStandingDirectiveSnapshot[],
  resolveConfig: (configId: string) => WorkshopWidgetConfigSnapshot | undefined,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): string[] {
  return directives.map((directive) => {
    const config = resolveConfig(directive.widgetConfigId);
    if (!config) {
      throw new Error(`Standing directive ${directive.id} has no widget config`);
    }
    return renderWorkshopStandingDirective({ directive, config }, operations);
  });
}

export function renderWorkshopStandingDirectiveFramesFromState(
  state: WorkshopSessionStateV1,
  operations: WorkshopStandingDirectiveOperations = WORKSHOP_STANDING_DIRECTIVE_OPERATIONS
): string[] {
  const configsById = new Map(
    (state.widgetConfigs ?? []).map((config) => [config.id, config])
  );
  return renderWorkshopStandingDirectiveFramesForSnapshots(
    state.standingDirectives ?? [],
    (configId) => configsById.get(configId),
    operations
  );
}
