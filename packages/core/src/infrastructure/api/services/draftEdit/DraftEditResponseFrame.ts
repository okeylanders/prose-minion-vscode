/**
 * A Draft Edit pass's reply frame: one JSON object between the pass's
 * sentinels (ADR 2026-10-21 D6; shared by Craft Flags since Slice 3c). Pure:
 * no host, no I/O. Each pass names its sentinels and its ceiling
 * (`DraftEditFrameSpec`); the rules are one.
 *
 * It accepts the same tolerances as the Lightbox's frame, for the same model
 * habits:
 * - a code fence around the whole frame, sentinels included, is set aside;
 * - a reply with no closing sentinel is accepted when its JSON is complete
 *   as it stands (no bracket is added to it);
 * - the JSON is read with the shared, feature-agnostic repair parser
 *   (`parseModelJson`), never raw `JSON.parse`, under its content guard.
 *
 * A reply cut off at the output ceiling never reaches this reader: each
 * pass's service rejects it, because a cut list of findings would read as
 * "nothing more". Every message is host-owned (positions and the
 * protocol's own names, never the reply's text).
 */

import {
  ModelJsonParseError,
  describeModelJsonRefusal,
  parseModelJson,
  type ModelJsonRepairKind
} from '@parsers/ModelJsonRepair';

/** A pass's frame: its sentinels, and the longest reply it reads. */
export interface DraftEditFrameSpec {
  readonly opening: string;
  readonly closing: string;
  readonly responseCharacters: number;
}

export type DraftEditFrameRepair = ModelJsonRepairKind | 'missing-closing-sentinel';

export interface DraftEditFrame {
  readonly root: Record<string, unknown>;
  /** The structural repairs made, each kind once, in the order first made. */
  readonly repairs: readonly DraftEditFrameRepair[];
}

/** The frame, or its root, cannot be read. `message` and `diagnostic` carry no reply text. */
export class DraftEditFrameError extends Error {
  constructor(message: string, readonly diagnostic?: string) {
    super(message);
    this.name = 'DraftEditFrameError';
  }
}

const OPENING_FENCE = /^```[\w-]*$/u;
const CLOSING_FENCE = '```';

/** Read a reply's frame; throws `DraftEditFrameError` when it cannot be read. */
export function readDraftEditFrame(content: string, spec: DraftEditFrameSpec): DraftEditFrame {
  const { opening, closing, responseCharacters: ceiling } = spec;
  if (content.length > ceiling) {
    throw new DraftEditFrameError(`The response runs past ${ceiling.toLocaleString('en-US')} characters`);
  }
  const repairs = new Set<DraftEditFrameRepair>();
  const lines = unfenced(content.replace(/\r\n?/g, '\n').trim().split('\n'), repairs);
  const text = lines.join('\n');

  if (occurrences(text, opening) !== 1) {
    throw new DraftEditFrameError(`The response must contain exactly one ${opening}`);
  }
  if (lines[0].trim() !== opening) {
    throw new DraftEditFrameError(`The opening ${opening} must be the first line`);
  }
  const closes = occurrences(text, closing);
  if (closes > 1) {
    throw new DraftEditFrameError(`The response must contain at most one ${closing}`);
  }
  if (closes === 1 && lines[lines.length - 1].trim() !== closing) {
    throw new DraftEditFrameError(`The closing ${closing} must be the final line`);
  }
  const jsonText = lines.slice(1, closes === 1 ? -1 : undefined).join('\n').trim();
  if (jsonText.length === 0) {
    throw new DraftEditFrameError('The response JSON is empty');
  }

  let value: unknown;
  try {
    // A missing bracket is closed only when the reply ended its frame on purpose.
    const read = parseModelJson(jsonText, { closeMissingBrackets: closes === 1 });
    read.repairs.forEach((repair) => repairs.add(repair));
    value = read.value;
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }
    throw new DraftEditFrameError(
      closes === 1
        ? `The response JSON is invalid${error.position !== undefined ? ` (at character ${error.position})` : ''}`
        : `The response must end with ${closing}`,
      `A structural repair was refused: ${describeModelJsonRefusal(error.refusal)}.`
    );
  }
  if (closes === 0) {
    repairs.add('missing-closing-sentinel');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DraftEditFrameError('The response JSON must be an object');
  }
  return { root: value as Record<string, unknown>, repairs: [...repairs] };
}

/** The lines without a fence line around them, sentinels and all, noted as a repair. */
function unfenced(lines: string[], repairs: Set<DraftEditFrameRepair>): string[] {
  let from = 0;
  let to = lines.length;
  if (to > from && OPENING_FENCE.test(lines[from].trim())) {
    from += 1;
    repairs.add('code-fence');
  }
  if (to > from && lines[to - 1].trim() === CLOSING_FENCE) {
    to -= 1;
    repairs.add('code-fence');
  }
  return lines.slice(from, to);
}

function occurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}
