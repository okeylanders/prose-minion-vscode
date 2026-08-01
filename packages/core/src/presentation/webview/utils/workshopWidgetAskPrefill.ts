import { WorkshopWidgetId } from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

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
  if (widgetId === 'gesture-playground') {
    return `Hey ${hostLabel}! Please prepare ${widgetLabel} for the beat we’re discussing. Seed it with the exact target phrase, useful surrounding context, and grounded character notes, then offer it for me to review and open.`;
  }
  if (widgetId === 'lexical-gravity') {
    return `Hey ${hostLabel}! Please prepare ${widgetLabel} for the passage we’re discussing. Choose a useful starting lens, weight, reach, and metaphor setting, then offer it for me to review and open.`;
  }
  return `Hey ${hostLabel}! Please prepare ${widgetLabel} for what we’re discussing, then offer it for me to review and open.`;
}
