/** Closed dispatch from one-shot wire payloads to named feature compilers. */

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

export interface WorkshopOneShotWidgetPreparedCommit {
  widgetId: WorkshopOneShotWidgetId;
  widgetConfigInput: WorkshopOneShotWidgetConfigInput;
  clonedFromConfigId?: string;
  roomText: string;
  displayText: string;
  toolTargetRefusalMessage: string;
  artifact: {
    label: string;
    content: string;
    selectionCount: number;
  };
}

export type WorkshopOneShotWidgetCommitPreparation =
  | { ok: true; commit: WorkshopOneShotWidgetPreparedCommit }
  | { ok: false; message: string };

interface WorkshopOneShotWidgetCommitOperationEntry<
  Id extends WorkshopOneShotWidgetId
> {
  widgetId: Id;
  prepare: (
    payload: Extract<WorkshopCommitWidgetPayload, { widgetId: Id }>
  ) => WorkshopOneShotWidgetCommitPreparation;
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
  ) => WorkshopOneShotWidgetCommitPreparation;
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
): WorkshopOneShotWidgetCommitPreparation {
  const entry = WORKSHOP_ONE_SHOT_WIDGET_COMMIT_OPERATIONS[
    payload.widgetId
  ] as unknown as WorkshopOneShotWidgetCommitOperation;
  return entry.prepare(payload);
}
