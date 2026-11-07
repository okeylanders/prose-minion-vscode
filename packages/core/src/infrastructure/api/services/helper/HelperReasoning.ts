/**
 * The helper's reasoning request (ADR 2026-11-05 D1, amended 2026-11-06
 * after the live pass): reasoning `off` on every call, so a model that
 * decides for itself how long to think cannot spend the reply's small
 * ceiling thinking and come back cut off.
 *
 * `off` is never sent to a model that always reasons (the PR #181 F-01
 * rule): the live catalog is asked about the exact model the call goes to.
 * Where Draft Edit refuses such a model, the helper sends it the `light`
 * budget on top of its ceiling instead: drafting is automatic, and a
 * refusal would only ever show the writer the quiet failure line. A catalog
 * that cannot say sends `off` as asked, as Draft Edit's does. No model
 * named (the provider's default) asks nothing and sends `off`, as Draft
 * Edit's passes do.
 */

import type { LogSink } from '@/platform';
import { catalogAlwaysReasons, type ReasoningCatalog } from '@orchestration/ReasoningCatalog';
import { reasoningRequest, type ReasoningRequest } from '@orchestration/ReasoningRequest';

export async function helperReasoningRequest(
  model: string,
  outputTokens: number,
  catalog: ReasoningCatalog,
  log: Pick<LogSink, 'appendLine'>,
  logPrefix: string
): Promise<ReasoningRequest> {
  if (model && await catalogAlwaysReasons(model, catalog, log, logPrefix) === true) {
    log.appendLine(`${logPrefix}: the model catalog says ${model} always reasons, so it was sent the light thinking budget on top of its ceiling`);
    return reasoningRequest('light', outputTokens);
  }
  return reasoningRequest('off', outputTokens);
}
