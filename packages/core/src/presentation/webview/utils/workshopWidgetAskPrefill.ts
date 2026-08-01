import { WorkshopWidgetId } from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

type WorkshopWidgetAskPrefillBuilder = (hostLabel: string, widgetLabel: string) => string;

const ASK_PREFILL_BUILDERS: Partial<Record<WorkshopWidgetId, WorkshopWidgetAskPrefillBuilder>> = {
  'gesture-playground': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the beat we’re discussing. Seed it with the exact target phrase, useful surrounding context, and grounded character notes, then offer it for me to review and open.`,
  'lexical-gravity': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the passage we’re discussing. Choose a useful starting lens, weight, reach, and metaphor setting, then offer it for me to review and open.`
};

export function canBuildWorkshopWidgetAskPrefill(widgetId: unknown): widgetId is WorkshopWidgetId {
  return typeof widgetId === 'string'
    && ASK_PREFILL_BUILDERS[widgetId as WorkshopWidgetId] !== undefined;
}

/**
 * Editable Host request for the widget browser's agent-preparation door.
 * The model prepares a recommendation seed; the writer still sends the ask,
 * opens the returned chip, edits the form, and commits any resulting state.
 */
export function buildWorkshopWidgetAskPrefill(
  widgetId: WorkshopWidgetId,
  hostLabel: string
): string {
  const widgetLabel = workshopWidgetLabel(widgetId);
  const builder = ASK_PREFILL_BUILDERS[widgetId];
  if (!builder) {
    throw new Error(`Widget ${widgetId} has no Host-preparation prompt.`);
  }
  return builder(hostLabel, widgetLabel);
}
