/**
 * Model stamps on Workshop assistant turns (ADR 2026-11-03 D7, D9).
 *
 * A stamp records which model scope a provider-produced turn used, the
 * model requested when its run started, and the models the provider reported
 * serving. It is display provenance only: nothing here, and nothing that
 * reads a stamp, may put it in a prompt, a room frame, or provider history.
 *
 * The field is additive and optional (D9): a turn without `model` reads and
 * writes exactly as before.
 */

import type { AnalysisRunModel } from '@/domain/models/AnalysisResult';
import { InferenceReplySource, isModelScope, WorkshopTurnModel } from '@messages';
import {
  arrayOf,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';

/**
 * The stamp for a turn a run produced. Undefined when the run carried no
 * models (an unconfigured key, a caught error, a capability that made no
 * provider call), or when its reply is text the host wrote in place of an
 * unusable provider reply (Astra F-02): only `replySource: 'provider'`
 * qualifies, and an unknown source does not. Copied field by field, so the
 * turn never shares arrays with the run result.
 */
export function workshopTurnModelOf(
  run: { model?: AnalysisRunModel; replySource?: InferenceReplySource }
): WorkshopTurnModel | undefined {
  const model = run.model;
  if (run.replySource !== 'provider' || !model || model.requestedModelId.length === 0) {
    return undefined;
  }
  return cloneTurnModel(model);
}

/** A stamp's own copy: the turn never shares an array with its source. */
export function cloneTurnModel(model: WorkshopTurnModel): WorkshopTurnModel {
  return {
    scope: model.scope,
    requestedModelId: model.requestedModelId,
    servedModelIds: [...model.servedModelIds]
  };
}

/** Strict persisted shape of `WorkshopTurn.model`. */
export function assertWorkshopTurnModel(value: unknown, path: string): void {
  const model = exactObject(value, path, ['scope', 'requestedModelId', 'servedModelIds']);
  if (!isModelScope(model.scope)) {
    shapeError(`${path}.scope`, 'known model scope');
  }
  nonEmptyStringAt(model.requestedModelId, `${path}.requestedModelId`);
  const seen = new Set<string>();
  arrayOf(model.servedModelIds, `${path}.servedModelIds`, (id, itemPath) => {
    nonEmptyStringAt(id, itemPath);
    if (seen.has(id as string)) {
      shapeError(itemPath, 'a served model id not already listed');
    }
    seen.add(id as string);
  });
}

function nonEmptyStringAt(value: unknown, path: string): void {
  if (typeof value !== 'string' || value.length === 0) {
    shapeError(path, 'non-empty string');
  }
}
