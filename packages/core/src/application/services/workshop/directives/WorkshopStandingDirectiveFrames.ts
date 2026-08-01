/** Deterministic prompt frames for session-owned standing prose directives. */

import {
  WorkshopStandingDirectiveSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  buildLexicalGravityDirectiveFrame
} from '@/application/services/workshop/lexicalGravity/LexicalGravityDirective';

export interface WorkshopStandingDirectiveRendering {
  directive: WorkshopStandingDirectiveSnapshot;
  config: WorkshopWidgetConfigSnapshot;
}

export function renderWorkshopStandingDirective(
  input: WorkshopStandingDirectiveRendering
): string {
  const { directive, config } = input;
  if (
    directive.family === 'lexical-gravity'
    && directive.widgetId === 'lexical-gravity'
    && config.widgetId === 'lexical-gravity'
  ) {
    return buildLexicalGravityDirectiveFrame(directive, config.draft);
  }
  throw new Error(`No standing directive renderer registered for ${directive.family}`);
}

export function renderWorkshopStandingDirectiveFrames(
  session: WorkshopSessionService
): string[] {
  return renderWorkshopStandingDirectiveFramesForSnapshots(
    session.getStandingDirectives(),
    (configId) => session.getWidgetConfig(configId)
  );
}

export function renderWorkshopStandingDirectiveFramesForSnapshots(
  directives: readonly WorkshopStandingDirectiveSnapshot[],
  resolveConfig: (configId: string) => WorkshopWidgetConfigSnapshot | undefined
): string[] {
  return directives.map((directive) => {
    const config = resolveConfig(directive.widgetConfigId);
    if (!config) {
      throw new Error(`Standing directive ${directive.id} has no widget config`);
    }
    return renderWorkshopStandingDirective({ directive, config });
  });
}

export function renderWorkshopStandingDirectiveFramesFromState(
  state: WorkshopSessionStateV1
): string[] {
  const configsById = new Map(
    (state.widgetConfigs ?? []).map((config) => [config.id, config])
  );
  return renderWorkshopStandingDirectiveFramesForSnapshots(
    state.standingDirectives ?? [],
    (configId) => configsById.get(configId)
  );
}
