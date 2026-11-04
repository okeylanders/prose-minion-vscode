/**
 * What a bubble says about the model that answered it (ADR 2026-11-03 D8).
 *
 * - The served-by note appears only when the provider named a model other
 *   than the one requested ("Auto router · served by Claude Sonnet 5"). A
 *   match, or a reply whose provider named no model, says nothing: that is
 *   not a mismatch, only an absence of evidence.
 * - The participant label's title names the raw ids, on every stamped reply.
 *
 * Neither is a slice: a slice marks a change in what was requested.
 */

import type { WorkshopTurnModel } from '@messages';

/** The label lookup's fallback: a model is named by its raw id. */
export const workshopRawModelId = (modelId: string): string => modelId;

/** True when the provider named exactly the requested model, or named none. */
function servedAsRequested(model: WorkshopTurnModel): boolean {
  return model.servedModelIds.length === 0 ||
    (model.servedModelIds.length === 1 && model.servedModelIds[0] === model.requestedModelId);
}

export function workshopServedByNote(
  model: WorkshopTurnModel | undefined,
  modelLabel: (modelId: string) => string
): string | undefined {
  if (!model || servedAsRequested(model)) {
    return undefined;
  }
  return `${modelLabel(model.requestedModelId)} · served by ${model.servedModelIds.map(modelLabel).join(', ')}`;
}

export function workshopTurnModelTitle(model: WorkshopTurnModel | undefined): string | undefined {
  if (!model) {
    return undefined;
  }
  if (model.servedModelIds.length === 0) {
    return `Requested ${model.requestedModelId} · the provider named no model`;
  }
  return servedAsRequested(model)
    ? `${model.requestedModelId} · requested and served`
    : `Requested ${model.requestedModelId} · served by ${model.servedModelIds.join(', ')}`;
}
