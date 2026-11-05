/**
 * The participant label's tooltip on a stamped reply (ADR 2026-11-03 D8): it
 * names the raw ids. The label's visible model text is the shared header rule,
 * `workshopTurnModelLabel` (amended 2026-11-04), which retired the under-body
 * served-by note.
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
