import type { WorkshopWidgetId } from '@messages';

/** Display-safe evidence supplied by the feature that performed a recovery. */
export interface WorkshopWidgetRecoveryNotice {
  code: string;
  widgetId: WorkshopWidgetId;
  configId: string;
  message: string;
}

/**
 * Feature-local result before the outer widget config supplies its identity.
 * Codes are stable machine evidence; notices are reserved for material,
 * writer-visible recovery.
 */
export interface WorkshopWidgetDraftRecoveryResult<
  TDraft,
  TNormalization extends string = string
> {
  draft: TDraft;
  normalizations: TNormalization[];
  notices: Array<{
    code: string;
    message: string;
  }>;
}
