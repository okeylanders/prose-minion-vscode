/** Closed family registry for standing-directive feature operations. */

import {
  WorkshopApplyStandingWidgetPayload,
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSnapshot,
  WorkshopStandingDirectiveSummary,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import {
  WorkshopWidgetConfigInput
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import {
  LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityStandingDirectiveOperations';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

export type WorkshopStandingDirectiveApplyRequest = {
  [Payload in WorkshopApplyStandingWidgetPayload as Payload['widgetId']]: {
    family: Extract<WorkshopStandingDirectiveFamily, Payload['widgetId']>;
    widgetId: Payload['widgetId'];
    widgetConfigInput: Extract<WorkshopWidgetConfigInput, { widgetId: Payload['widgetId'] }>;
    widgetConfigId?: string;
    editConflictMessage: string;
    alreadyActiveMessage: string;
  }
}[WorkshopApplyStandingWidgetPayload['widgetId']];

export interface WorkshopStandingDirectiveRendering {
  directive: WorkshopStandingDirectiveSnapshot;
  config: WorkshopWidgetConfigSnapshot;
}

export interface WorkshopStandingDirectiveOperationEntry {
  readonly widgetId: WorkshopStandingDirectiveSnapshot['widgetId'];
  prepareApply(payload: WorkshopApplyStandingWidgetPayload): WorkshopStandingDirectiveApplyRequest;
  render(input: WorkshopStandingDirectiveRendering): string;
  summarize(
    directive: WorkshopStandingDirectiveSnapshot,
    config: WorkshopWidgetConfigSnapshot
  ): WorkshopStandingDirectiveSummary;
  markerContent(
    action: 'installed' | 'shifted' | 'removed',
    directive: WorkshopStandingDirectiveSnapshot,
    previousConfig?: WorkshopWidgetConfigSnapshot,
    currentConfig?: WorkshopWidgetConfigSnapshot
  ): string;
  formatSummary(summary: WorkshopStandingDirectiveSummary): string;
  describe(input: WorkshopStandingDirectiveRendering): string;
}

export type WorkshopStandingDirectiveOperationEntries = Readonly<
  Record<WorkshopStandingDirectiveFamily, WorkshopStandingDirectiveOperationEntry>
>;

type WorkshopStandingApplyPreparers = {
  [WidgetId in WorkshopApplyStandingWidgetPayload['widgetId']]: (
    payload: Extract<WorkshopApplyStandingWidgetPayload, { widgetId: WidgetId }>
  ) => WorkshopStandingDirectiveApplyRequest;
};

export interface WorkshopStandingDirectiveOperations {
  prepareApply(payload: WorkshopApplyStandingWidgetPayload): WorkshopStandingDirectiveApplyRequest;
  widgetIdForFamily(
    family: WorkshopStandingDirectiveFamily
  ): WorkshopStandingDirectiveSnapshot['widgetId'];
  render(input: WorkshopStandingDirectiveRendering): string;
  summarize(
    directive: WorkshopStandingDirectiveSnapshot,
    config: WorkshopWidgetConfigSnapshot
  ): WorkshopStandingDirectiveSummary;
  markerContent(
    action: 'installed' | 'shifted' | 'removed',
    directive: WorkshopStandingDirectiveSnapshot,
    previousConfig?: WorkshopWidgetConfigSnapshot,
    currentConfig?: WorkshopWidgetConfigSnapshot
  ): string;
  formatSummary(summary: WorkshopStandingDirectiveSummary): string;
  describe(input: WorkshopStandingDirectiveRendering): string;
}

const unsupportedFamily = (family: WorkshopStandingDirectiveFamily): never => {
  throw new Error(`Standing directive family ${family} is not implemented`);
};

const proseControllerEntry: WorkshopStandingDirectiveOperationEntry = {
  widgetId: 'prose-controller',
  prepareApply: () => unsupportedFamily('prose-controller'),
  render: () => unsupportedFamily('prose-controller'),
  summarize: () => unsupportedFamily('prose-controller'),
  markerContent: (action, directive) => {
    const verb = action === 'installed'
      ? 'Installed'
      : action === 'shifted'
        ? 'Shifted'
        : 'Removed';
    return `${verb} ${workshopWidgetLabel(directive.widgetId)}.`;
  },
  formatSummary: () => unsupportedFamily('prose-controller'),
  describe: () => unsupportedFamily('prose-controller')
};

export function createWorkshopStandingDirectiveOperations(
  entries: WorkshopStandingDirectiveOperationEntries
): WorkshopStandingDirectiveOperations {
  const applyPreparers = {
    'lexical-gravity': (payload) => entries['lexical-gravity'].prepareApply(payload)
  } satisfies WorkshopStandingApplyPreparers;

  return {
    prepareApply: (payload) => {
      const prepare = applyPreparers[payload.widgetId] as (
        input: WorkshopApplyStandingWidgetPayload
      ) => WorkshopStandingDirectiveApplyRequest;
      return prepare(payload);
    },
    widgetIdForFamily: (family) => entries[family].widgetId,
    render: (input) => entries[input.directive.family].render(input),
    summarize: (directive, config) => entries[directive.family].summarize(directive, config),
    markerContent: (action, directive, previousConfig, currentConfig) =>
      entries[directive.family].markerContent(
        action,
        directive,
        previousConfig,
        currentConfig
      ),
    formatSummary: (summary) => entries[summary.family].formatSummary(summary),
    describe: (input) => entries[input.directive.family].describe(input)
  };
}

export const WORKSHOP_STANDING_DIRECTIVE_OPERATIONS =
  createWorkshopStandingDirectiveOperations({
    'lexical-gravity': LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS,
    'prose-controller': proseControllerEntry
  });
