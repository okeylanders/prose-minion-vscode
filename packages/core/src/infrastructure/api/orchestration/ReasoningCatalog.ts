/**
 * What the live catalog says of a model's reasoning, and whether reasoning
 * `off` may be sent to it (PR #181 F-01; ADR 2026-10-21, Amendment
 * 2026-10-27). Neutral ground: Draft Edit's passes and the helper agent
 * (ADR 2026-11-05 D1, amended 2026-11-06) both read it, and neither
 * imports the other.
 *
 * OpenRouter's catalog marks a model that always reasons
 * (`reasoning.mandatory: true`), and such a model rejects `effort: 'none'`.
 * A Draft Edit pass at `off` refuses that model before anything is sent: it
 * never sends a request the provider will refuse, never quietly lets the
 * model think anyway, and never picks another model or level for the
 * writer. The helper asks the same question and applies its own rule.
 *
 * Only `off` asks the catalog: every other level is a budget a reasoning
 * model takes, so the default levels fetch nothing. The catalog is asked
 * about the exact model the call goes to. When it cannot say (offline, a
 * model it does not list, no `mandatory` field, or a failed read), `off` is
 * sent as asked and the provider's own answer stands.
 */

import type { ReasoningLevel } from '@/domain/models/ReasoningLevel';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import type { LogSink } from '@/platform';

/** What a caller reads of a model's reasoning: the live catalog in the extension, a fake in tests. */
export interface ReasoningCatalog {
  /** True when the catalog marks `model` as always reasoning; false when it says it is not; undefined when it cannot say. */
  alwaysReasons(model: string): Promise<boolean | undefined>;
}

/** The live catalog, fetched once if nothing has fetched it yet (a free request, never billable). */
export function liveCatalogReasoning(log: LogSink): ReasoningCatalog {
  return {
    async alwaysReasons(model: string): Promise<boolean | undefined> {
      await OpenRouterModels.fetchModels(log);
      return OpenRouterModels.getCachedAlwaysReasons(model);
    }
  };
}

/**
 * Whether the catalog marks `model` as always reasoning, asked by a caller
 * about to send reasoning `off`: true or false when it says, undefined when
 * it cannot (a failed read included), logged under `logPrefix`, which names
 * the caller and run; the log never carries the text.
 */
export async function catalogAlwaysReasons(
  model: string,
  catalog: ReasoningCatalog,
  log: Pick<LogSink, 'appendLine'>,
  logPrefix: string
): Promise<boolean | undefined> {
  let alwaysReasons: boolean | undefined;
  try {
    alwaysReasons = await catalog.alwaysReasons(model);
  } catch (error) {
    log.appendLine(`${logPrefix}: the model catalog could not be read (${error instanceof Error ? error.message : String(error)})`);
  }
  if (alwaysReasons === undefined) {
    log.appendLine(`${logPrefix}: the model catalog cannot say whether ${model} can stop reasoning; reasoning off sent as asked`);
  }
  return alwaysReasons;
}

/**
 * Whether a pass at `level` must refuse `model`: only at `off`, and only when
 * the catalog marks the model as always reasoning. `logPrefix` names the pass
 * and run ("[Proofread] chapter-01.md"); the log never carries the text.
 */
export async function refusesReasoningOff(
  level: ReasoningLevel,
  model: string,
  catalog: ReasoningCatalog,
  log: LogSink,
  logPrefix: string
): Promise<boolean> {
  if (level !== 'off') {
    return false;
  }
  if (await catalogAlwaysReasons(model, catalog, log, logPrefix) === true) {
    log.appendLine(`${logPrefix}: the model catalog says ${model} always reasons, so reasoning off was refused and nothing was sent`);
    return true;
  }
  return false;
}
