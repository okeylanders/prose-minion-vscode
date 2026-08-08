/** Closed lifecycle registry for every earned persisted widget-config arm. */

import type { WorkshopWidgetConfigSnapshot, WorkshopWidgetId } from '@messages';
import {
  assertGesturePlaygroundDraftCheckpointShape,
  assertGesturePlaygroundDraftIntegrity,
  assertGesturePlaygroundDraftShape,
  normalizeGesturePlaygroundDraftForHydration,
  type GesturePlaygroundCheckpointNormalization
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundConfigCodec';
import {
  assertLexicalGravityDraftCheckpointShape,
  assertLexicalGravityDraftIntegrity,
  assertLexicalGravityDraftShape,
  normalizeLexicalGravityDraftForHydration,
  type LexicalGravityCheckpointNormalization
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
  | GesturePlaygroundCheckpointNormalization
  | LexicalGravityCheckpointNormalization;

type PersistedWorkshopWidgetId = WorkshopWidgetConfigSnapshot['widgetId'];
type PersistedWorkshopWidgetDraft<Id extends PersistedWorkshopWidgetId> =
  Extract<WorkshopWidgetConfigSnapshot, { widgetId: Id }>['draft'];

interface WorkshopWidgetPersistenceLifecycleFor<
  Id extends PersistedWorkshopWidgetId
> {
  assertCheckpointShape: (draft: unknown, path: string) => void;
  normalizeForHydration: (
    draft: unknown
  ) => WorkshopWidgetDraftRecoveryResult<
    PersistedWorkshopWidgetDraft<Id>,
    WorkshopWidgetCheckpointNormalization
  >;
  assertCurrentShape: (draft: unknown, path: string) => void;
  validateIntegrity: (
    draft: PersistedWorkshopWidgetDraft<Id>,
    path: string
  ) => void;
}

type WorkshopWidgetPersistenceLifecycleRegistry = {
  [Id in PersistedWorkshopWidgetId]: WorkshopWidgetPersistenceLifecycleFor<Id>;
};

/** Type-erased only after registry construction, at the runtime id boundary. */
interface WorkshopWidgetPersistenceLifecycle {
  assertCheckpointShape: (draft: unknown, path: string) => void;
  normalizeForHydration: (
    draft: unknown
  ) => WorkshopWidgetDraftRecoveryResult<unknown, WorkshopWidgetCheckpointNormalization>;
  assertCurrentShape: (draft: unknown, path: string) => void;
  validateIntegrity: (draft: unknown, path: string) => void;
}

/**
 * The registry is deliberately closed. Its mapped `satisfies` contract is the
 * architecture witness: every arm of the persisted config union contributes
 * exactly one correctly typed four-operation lifecycle before TypeScript will
 * build.
 */
const WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES = {
  'gesture-playground': {
    assertCheckpointShape: assertGesturePlaygroundDraftCheckpointShape,
    normalizeForHydration: normalizeGesturePlaygroundDraftForHydration,
    assertCurrentShape: assertGesturePlaygroundDraftShape,
    validateIntegrity: assertGesturePlaygroundDraftIntegrity
  },
  'lexical-gravity': {
    assertCheckpointShape: assertLexicalGravityDraftCheckpointShape,
    normalizeForHydration: normalizeLexicalGravityDraftForHydration,
    assertCurrentShape: assertLexicalGravityDraftShape,
    validateIntegrity: assertLexicalGravityDraftIntegrity
  }
} satisfies WorkshopWidgetPersistenceLifecycleRegistry;

export function persistedWorkshopWidgetLifecycleIds(): PersistedWorkshopWidgetId[] {
  return Object.keys(WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES) as PersistedWorkshopWidgetId[];
}

export function assertWorkshopWidgetDraftShape(
  widgetId: WorkshopWidgetId,
  draft: unknown,
  path: string
): void {
  lifecycleFor(widgetId).assertCurrentShape(draft, path);
}

export function assertWorkshopWidgetDraftCheckpointShape(
  widgetId: WorkshopWidgetId,
  draft: unknown,
  path: string
): void {
  lifecycleFor(widgetId).assertCheckpointShape(draft, path);
}

export function validateWorkshopWidgetDraftIntegrity(
  widgetId: WorkshopWidgetId,
  draft: unknown,
  path: string
): void {
  lifecycleFor(widgetId).validateIntegrity(draft, path);
}

export function recoverWorkshopWidgetConfigCheckpoint(
  config: WorkshopWidgetConfigSnapshot
): WorkshopWidgetConfigRecoveryResult {
  return liftWorkshopWidgetRecovery(
    config,
    lifecycleFor(config.widgetId).normalizeForHydration(config.draft)
  );
}

function lifecycleFor(widgetId: WorkshopWidgetId): WorkshopWidgetPersistenceLifecycle {
  if (!Object.prototype.hasOwnProperty.call(
    WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES,
    widgetId
  )) {
    throw new Error(`Unsupported persisted Workshop widget: ${widgetId}`);
  }
  return WORKSHOP_WIDGET_PERSISTENCE_LIFECYCLES[
    widgetId as PersistedWorkshopWidgetId
  ] as unknown as WorkshopWidgetPersistenceLifecycle;
}

function liftWorkshopWidgetRecovery(
  config: WorkshopWidgetConfigSnapshot,
  result: WorkshopWidgetDraftRecoveryResult<
    unknown,
    WorkshopWidgetCheckpointNormalization
  >
): WorkshopWidgetConfigRecoveryResult {
  return {
    config: { ...config, draft: result.draft } as WorkshopWidgetConfigSnapshot,
    normalizations: result.normalizations,
    notices: result.notices.map((notice) => ({
      ...notice,
      widgetId: config.widgetId,
      configId: config.id
    }))
  };
}
