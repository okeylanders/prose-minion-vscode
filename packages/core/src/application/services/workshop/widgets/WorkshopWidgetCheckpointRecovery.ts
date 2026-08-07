/** Closed dispatcher for widget-owned checkpoint grammar and recovery. */

import type {
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetId
} from '@messages';
import {
  assertGesturePlaygroundDraftCheckpointShape,
  assertGesturePlaygroundDraftShape,
  normalizeGesturePlaygroundDraftForHydration
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec';
import {
  assertLexicalGravityDraftCheckpointShape,
  assertLexicalGravityDraftShape,
  normalizeLexicalGravityDraftForHydration
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityConfigCodec';
import type {
  WorkshopWidgetDraftRecoveryResult,
  WorkshopWidgetRecoveryNotice
} from '@/application/services/workshop/widgets/WorkshopWidgetCheckpointRecoveryContracts';

export interface WorkshopWidgetConfigRecoveryResult {
  config: WorkshopWidgetConfigSnapshot;
  normalizations: WorkshopWidgetCheckpointNormalization[];
  notices: WorkshopWidgetRecoveryNotice[];
}

export type WorkshopWidgetCheckpointNormalization =
  | ReturnType<
      typeof normalizeGesturePlaygroundDraftForHydration
    >['normalizations'][number]
  | ReturnType<
      typeof normalizeLexicalGravityDraftForHydration
    >['normalizations'][number];

export function assertWorkshopWidgetDraftShape(
  widgetId: WorkshopWidgetId,
  draft: unknown,
  path: string
): void {
  switch (widgetId) {
    case 'gesture-playground':
      assertGesturePlaygroundDraftShape(draft, path);
      return;
    case 'lexical-gravity':
      assertLexicalGravityDraftShape(draft, path);
      return;
    default:
      throw new Error(`Unsupported persisted Workshop widget: ${widgetId}`);
  }
}

export function assertWorkshopWidgetDraftCheckpointShape(
  widgetId: WorkshopWidgetId,
  draft: unknown,
  path: string
): void {
  switch (widgetId) {
    case 'gesture-playground':
      assertGesturePlaygroundDraftCheckpointShape(draft, path);
      return;
    case 'lexical-gravity':
      assertLexicalGravityDraftCheckpointShape(draft, path);
      return;
    default:
      throw new Error(`Unsupported persisted Workshop widget: ${widgetId}`);
  }
}

export function recoverWorkshopWidgetConfigCheckpoint(
  config: WorkshopWidgetConfigSnapshot
): WorkshopWidgetConfigRecoveryResult {
  switch (config.widgetId) {
    case 'gesture-playground':
      return liftWorkshopWidgetRecovery(
        config,
        normalizeGesturePlaygroundDraftForHydration(config.draft)
      );
    case 'lexical-gravity':
      return liftWorkshopWidgetRecovery(
        config,
        normalizeLexicalGravityDraftForHydration(config.draft)
      );
    default:
      throw new Error(
        `Unsupported persisted Workshop widget: ${(config as { widgetId?: unknown }).widgetId}`
      );
  }
}

function liftWorkshopWidgetRecovery<
  TConfig extends WorkshopWidgetConfigSnapshot
>(
  config: TConfig,
  result: WorkshopWidgetDraftRecoveryResult<
    TConfig['draft'],
    WorkshopWidgetCheckpointNormalization
  >
): WorkshopWidgetConfigRecoveryResult {
  const recovered = result.normalizations.length === 0
    ? config
    : { ...config, draft: result.draft };
  return {
    config: recovered,
    normalizations: result.normalizations,
    notices: result.notices.map((notice) => ({
      ...notice,
      widgetId: config.widgetId,
      configId: config.id
    }))
  };
}
