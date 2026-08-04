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

export interface WorkshopLexicalGravityStandingDirectiveApplyRequest {
  family: 'lexical-gravity';
  widgetId: 'lexical-gravity';
  widgetConfigInput: Extract<WorkshopWidgetConfigInput, { widgetId: 'lexical-gravity' }>;
  widgetConfigId?: string;
  editConflictMessage: string;
  alreadyActiveMessage: string;
}

/** Each live standing feature contributes one exact prepared-request arm. */
export type WorkshopStandingDirectiveApplyRequest =
  WorkshopLexicalGravityStandingDirectiveApplyRequest;

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

const unsupportedFamily = (family: unknown): never => {
  throw new Error(`Standing directive family ${String(family)} is not implemented`);
};

const unsupportedApplyWidget = (widgetId: never): never => {
  throw new Error(`Unsupported standing directive apply widget: ${String(widgetId)}`);
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
  const entryForFamily = (
    family: WorkshopStandingDirectiveFamily
  ): WorkshopStandingDirectiveOperationEntry =>
    entries[family] ?? unsupportedFamily(family);

  return {
    prepareApply: (payload) => {
      switch (payload.widgetId) {
        case 'lexical-gravity':
          return entries['lexical-gravity'].prepareApply(payload);
        default:
          return unsupportedApplyWidget(payload.widgetId);
      }
    },
    widgetIdForFamily: (family) => entryForFamily(family).widgetId,
    render: (input) => entryForFamily(input.directive.family).render(input),
    summarize: (directive, config) => entryForFamily(directive.family).summarize(directive, config),
    markerContent: (action, directive, previousConfig, currentConfig) =>
      entryForFamily(directive.family).markerContent(
        action,
        directive,
        previousConfig,
        currentConfig
      ),
    formatSummary: (summary) => entryForFamily(summary.family).formatSummary(summary),
    describe: (input) => entryForFamily(input.directive.family).describe(input)
  };
}

export const WORKSHOP_STANDING_DIRECTIVE_OPERATIONS =
  createWorkshopStandingDirectiveOperations({
    'lexical-gravity': LEXICAL_GRAVITY_STANDING_DIRECTIVE_OPERATIONS,
    'prose-controller': proseControllerEntry
  });
