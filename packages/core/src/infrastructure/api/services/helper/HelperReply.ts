/**
 * HelperReply — reads a helper task's reply through the shared parser
 * (ADR 2026-11-05 D1, D2): refused when it reached its ceiling or is longer
 * than the task allows, then `parseModelJson` (structure-only repairs under
 * its content guard), then the task's own exact-field decoder.
 *
 * Feature-agnostic: nothing here knows a task.
 */

import { parseModelJson, ModelJsonParseError, type ModelJsonRepairKind } from '@parsers/ModelJsonRepair';
import type { HelperDecoded, HelperReplyFault, HelperTaskPolicy } from '@services/helper/HelperTaskPolicy';

export type HelperReplyRead<Output> =
  | { readonly ok: true; readonly value: Output; readonly repairs: readonly ModelJsonRepairKind[] }
  | { readonly ok: false; readonly fault: HelperReplyFault };

export function readHelperReply<Output>(
  policy: Pick<HelperTaskPolicy<unknown, Output>, 'decode' | 'call'>,
  content: string,
  finishReason: string | undefined
): HelperReplyRead<Output> {
  if (finishReason === 'length') {
    return { ok: false, fault: 'cut-off' };
  }
  if (content.length > policy.call.responseCharacters) {
    return { ok: false, fault: 'too-long' };
  }
  let value: unknown;
  let repairs: readonly ModelJsonRepairKind[];
  try {
    ({ value, repairs } = parseModelJson(content.trim()));
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      return { ok: false, fault: 'malformed-json' };
    }
    throw error;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, fault: 'not-an-object' };
  }
  const decoded: HelperDecoded<Output> = policy.decode(value as Record<string, unknown>);
  return decoded.ok ? { ok: true, value: decoded.value, repairs } : decoded;
}
