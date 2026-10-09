import { WorkshopWidgetId } from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

type WorkshopWidgetAskPrefillBuilder = (hostLabel: string, widgetLabel: string) => string;

const ASK_PREFILL_BUILDERS: Partial<Record<WorkshopWidgetId, WorkshopWidgetAskPrefillBuilder>> = {
  'gesture-playground': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the beat we’re discussing. Seed it with the exact target phrase, useful surrounding context, and grounded character notes, then offer it for me to review and open.`,
  'lexical-gravity': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the passage we’re discussing. Choose a useful starting lens, weight, reach, and metaphor setting, then offer it for me to review and open.`,
  'creative-variations': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the passage we’re discussing. `
    + 'Seed the exact subject passage, useful context and source references, any constraints I have '
    + 'actually stated, sampling distance, and take count. Leave the invariant and creative-aim '
    + 'fields empty when I have not stated them, then offer the setup for me to review and open. '
    + 'Do not generate, select, accept, or commit any takes.',
  'show-vs-tell': (hostLabel, widgetLabel) =>
    `Hey ${hostLabel}! Please prepare ${widgetLabel} for the told beat we’re discussing. `
    + 'Seed the exact beat, any surrounding source it should be read against, the “must survive” '
    + 'fact that the beat already carries, and any constraint I have actually stated. Leave the '
    + '“must not change”, point of view, position, channels, and length fields empty when I have '
    + 'not said which way I lean. Tell me what the line buys and what it spends where it '
    + 'stands, rather than judging it, then offer the setup for me to review and open. '
    + 'Do not generate, keep, carry, or commit anything.'
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
