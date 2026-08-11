/** Closed dispatch from one-shot wire payloads to named feature preparations. */

import type {
  WorkshopCommitWidgetPayload,
  WorkshopWidgetId
} from '@messages';
import type {
  WorkshopWidgetConfigInput
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import {
  prepareGesturePlaygroundOneShotCommit
} from '@/application/services/workshop/widgets/gesturePlayground/GesturePlaygroundOneShotCommit';

export type WorkshopOneShotWidgetId = WorkshopCommitWidgetPayload['widgetId'];
export type WorkshopOneShotWidgetConfigInput = Extract<
  WorkshopWidgetConfigInput,
  { widgetId: WorkshopOneShotWidgetId }
>;

export interface WorkshopOneShotWidgetCommitPlan {
  widgetId: WorkshopOneShotWidgetId;
  widgetConfigInput: WorkshopOneShotWidgetConfigInput;
  clonedFromConfigId?: string;
  roomText: string;
  displayText: string;
  /** Optional feature voice; the host owns a neutral tool-target fallback. */
  toolTargetRefusalMessage?: string;
  artifact: {
    label: string;
    content: string;
    /** Count of writer-selected units; presentation derives the noun from the widget. */
    selectionCount: number;
  };
}

export type WorkshopOneShotWidgetCommitPreparationResult =
  | { ok: true; commit: WorkshopOneShotWidgetCommitPlan }
  | {
      ok: false;
      reason: 'unsupported-one-shot-widget' | 'invalid-draft';
      message: string;
    };

interface WorkshopOneShotWidgetCommitOperationEntry<
  Id extends WorkshopOneShotWidgetId
> {
  widgetId: Id;
  prepare: (
    payload: Extract<WorkshopCommitWidgetPayload, { widgetId: Id }>
  ) => WorkshopOneShotWidgetCommitPreparationResult;
}

type WorkshopOneShotWidgetCommitOperationRegistry = {
  [Id in WorkshopOneShotWidgetId]: WorkshopOneShotWidgetCommitOperationEntry<Id>;
};

const WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS = {
  'gesture-playground': {
    widgetId: 'gesture-playground',
    prepare: prepareGesturePlaygroundOneShotCommit
  }
} satisfies WorkshopOneShotWidgetCommitOperationRegistry;

/** Type-erased only after the exact mapped registry has compiled. */
type WorkshopOneShotWidgetCommitOperation = {
  prepare: (
    payload: WorkshopCommitWidgetPayload
  ) => WorkshopOneShotWidgetCommitPreparationResult;
};

export function supportsWorkshopOneShotWidgetCommit(
  widgetId: WorkshopWidgetId
): widgetId is WorkshopOneShotWidgetId {
  return Object.prototype.hasOwnProperty.call(
    WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS,
    widgetId
  );
}

export function prepareWorkshopOneShotWidgetCommit(
  payload: WorkshopCommitWidgetPayload
): WorkshopOneShotWidgetCommitPreparationResult {
  if (!supportsWorkshopOneShotWidgetCommit(payload.widgetId)) {
    return {
      ok: false,
      reason: 'unsupported-one-shot-widget',
      message: 'That widget does not support one-shot commits.'
    };
  }
  const entry = WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS[
    payload.widgetId
  ] as unknown as WorkshopOneShotWidgetCommitOperation;
  return entry.prepare(payload);
}
