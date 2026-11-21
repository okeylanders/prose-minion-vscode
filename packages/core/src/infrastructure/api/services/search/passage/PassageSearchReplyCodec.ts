/**
 * A Passage Search read call's reply (ADR 2026-11-20 D8): asks, not gates.
 *
 * ```json
 * { "instances": [ { "quote": "…", "before": "…", "after": "…", "note": "…", "label": "…" } ] }
 * ```
 *
 * - The JSON is read by the shared parser (`parseModelJson`); a reply cut
 *   off at its output ceiling keeps the instances that finished
 *   (`salvageModelJson`, its array items kept). Each repair is reported by
 *   kind, never with text.
 * - An empty list is a fine answer.
 * - `quote` is read whole, never clipped: it is checked against the source.
 *   `before` and `after` are optional context for choosing among repeats.
 * - The lengths and counts the prompt states are asks. One safety ceiling
 *   (`safetyMultiple` times the ask) clips only `note`, with an ellipsis,
 *   and counts it. A `label` or a `quote` over its ceiling is a malformed
 *   instance, as is a missing `quote` or `label` or a wrong type: that
 *   instance is dropped and counted, and the rest stand.
 * - Fields the format does not define are ignored and counted.
 * - A reply longer than `responseCharacters`, one that does not parse, or
 *   one whose root has no `instances` list is the call's failure.
 *
 * Pure. An error carries a closed kind and no text of the reply.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ModelJsonParseError, parseModelJson, salvageModelJson, type ModelJsonRepairKind } from '@parsers/ModelJsonRepair';

/** An instance as the model wrote it, before host code finds it in the text. */
export interface PassageSearchReplyInstance {
  readonly quote: string;
  readonly before?: string;
  readonly after?: string;
  readonly note: string;
  readonly label: string;
}

export interface PassageSearchReply {
  readonly instances: readonly PassageSearchReplyInstance[];
  /** Instances dropped for a missing or mistyped field, or one over its ceiling. */
  readonly malformed: number;
  /** Fields the format does not define, at the root and in instances. */
  readonly ignoredFields: number;
  /** Notes clipped at the safety ceiling. */
  readonly notesClipped: number;
  readonly repairs: readonly ModelJsonRepairKind[];
  /** The reply was cut off, and what finished was kept. */
  readonly cut: boolean;
}

export type PassageSearchReplyFault = 'too-long' | 'unparseable' | 'no-instances';

/** The reply cannot be read: the call's failure. */
export class PassageSearchReplyError extends Error {
  constructor(readonly fault: PassageSearchReplyFault) {
    super(`The Passage Search reply could not be read (${fault}).`);
    this.name = 'PassageSearchReplyError';
  }
}

const ROOT_FIELDS = new Set(['instances']);
const INSTANCE_FIELDS = new Set(['quote', 'before', 'after', 'note', 'label']);

type Bounds = Pick<
  typeof PROMPT_BUDGETS.passageSearch,
  'responseCharacters' | 'quoteCharacters' | 'noteCharacters' | 'labelCharacters' | 'safetyMultiple'
>;

/** Read a reply's content; `cutOff` when the provider stopped it at the output ceiling. */
export function readPassageSearchReply(content: string, cutOff: boolean, bounds: Bounds = PROMPT_BUDGETS.passageSearch): PassageSearchReply {
  if (content.length > bounds.responseCharacters) {
    throw new PassageSearchReplyError('too-long');
  }
  const { root, repairs } = rootOf(content, cutOff);
  // A reply cut before its list began has none: nothing finished, which the cut already says.
  const listed = root.instances ?? (cutOff ? [] : undefined);
  if (!Array.isArray(listed)) {
    throw new PassageSearchReplyError('no-instances');
  }
  let ignoredFields = Object.keys(root).filter((key) => !ROOT_FIELDS.has(key)).length;
  let malformed = 0;
  let notesClipped = 0;
  const instances: PassageSearchReplyInstance[] = [];
  for (const item of listed) {
    if (!isRecord(item)) {
      malformed += 1;
      continue;
    }
    ignoredFields += Object.keys(item).filter((key) => !INSTANCE_FIELDS.has(key)).length;
    const instance = instanceOf(item, bounds);
    if (!instance) {
      malformed += 1;
      continue;
    }
    notesClipped += instance.clipped ? 1 : 0;
    instances.push(instance.value);
  }
  return { instances, malformed, ignoredFields, notesClipped, repairs, cut: cutOff };
}

function rootOf(content: string, cutOff: boolean): { root: Record<string, unknown>; repairs: readonly ModelJsonRepairKind[] } {
  try {
    if (cutOff) {
      const salvaged = salvageModelJson(content, { arrayItems: true });
      return { root: salvaged.root, repairs: salvaged.repairs };
    }
    const parsed = parseModelJson(content);
    if (!isRecord(parsed.value)) {
      throw new PassageSearchReplyError('no-instances');
    }
    return { root: parsed.value, repairs: parsed.repairs };
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      throw new PassageSearchReplyError('unparseable');
    }
    throw error;
  }
}

function instanceOf(item: Record<string, unknown>, bounds: Bounds): { value: PassageSearchReplyInstance; clipped: boolean } | undefined {
  const { quote, before, after, note, label } = item;
  if (typeof quote !== 'string' || quote.length === 0 || quote.length > bounds.quoteCharacters * bounds.safetyMultiple) {
    return undefined;
  }
  const name = typeof label === 'string' ? label.replace(/\s+/g, ' ').trim() : '';
  if (name.length === 0 || name.length > bounds.labelCharacters * bounds.safetyMultiple) {
    return undefined;
  }
  if (!optionalText(before) || !optionalText(after) || !optionalText(note)) {
    return undefined;
  }
  const written = (note ?? '').replace(/\s+/g, ' ').trim();
  const ceiling = bounds.noteCharacters * bounds.safetyMultiple;
  const clipped = written.length > ceiling;
  return {
    value: {
      quote,
      ...(before ? { before } : {}),
      ...(after ? { after } : {}),
      note: clipped ? `${written.slice(0, ceiling).trimEnd()}…` : written,
      label: name
    },
    clipped
  };
}

function optionalText(value: unknown): value is string | undefined | null {
  return value === undefined || value === null || typeof value === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
