/**
 * A Proofread reply's frame: one JSON object between its sentinels (ADR
 * 2026-10-21 D6). Pure: no host, no I/O.
 *
 * It accepts the same tolerances as the Lightbox's frame, for the same model
 * habits:
 * - a code fence around the whole frame, sentinels included, is set aside;
 * - a reply with no closing sentinel is accepted when its JSON is complete
 *   as it stands (no bracket is added to it);
 * - the JSON is read with the shared, feature-agnostic repair parser
 *   (`parseModelJson`), never raw `JSON.parse`, under its content guard.
 *
 * A reply cut off at the output ceiling never reaches this reader: the
 * service rejects it, because a cut list of issues would read as "no more
 * errors". Every message is host-owned (positions and the protocol's own
 * names, never the reply's text).
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  ModelJsonParseError,
  describeModelJsonRefusal,
  parseModelJson,
  type ModelJsonRepairKind
} from '@parsers/ModelJsonRepair';

export const PROOFREAD_OPENING_SENTINEL = '===PROOFREAD_V1===';
export const PROOFREAD_CLOSING_SENTINEL = '===END_PROOFREAD_V1===';

export type ProofreadFrameRepair = ModelJsonRepairKind | 'missing-closing-sentinel';

export interface ProofreadFrame {
  readonly root: Record<string, unknown>;
  /** The structural repairs made, each kind once, in the order first made. */
  readonly repairs: readonly ProofreadFrameRepair[];
}

/** The frame cannot be read. `message` and `diagnostic` carry no reply text. */
export class ProofreadFrameError extends Error {
  constructor(message: string, readonly diagnostic?: string) {
    super(message);
    this.name = 'ProofreadFrameError';
  }
}

const OPENING_FENCE = /^```[\w-]*$/u;
const CLOSING_FENCE = '```';

/** Read a reply's frame; throws `ProofreadFrameError` when it cannot be read. */
export function readProofreadFrame(content: string): ProofreadFrame {
  const ceiling = PROMPT_BUDGETS.proofread.responseCharacters;
  if (content.length > ceiling) {
    throw new ProofreadFrameError(`The response runs past ${ceiling.toLocaleString('en-US')} characters`);
  }
  const repairs = new Set<ProofreadFrameRepair>();
  const lines = unfenced(content.replace(/\r\n?/g, '\n').trim().split('\n'), repairs);
  const text = lines.join('\n');

  if (occurrences(text, PROOFREAD_OPENING_SENTINEL) !== 1) {
    throw new ProofreadFrameError(`The response must contain exactly one ${PROOFREAD_OPENING_SENTINEL}`);
  }
  if (lines[0].trim() !== PROOFREAD_OPENING_SENTINEL) {
    throw new ProofreadFrameError(`The opening ${PROOFREAD_OPENING_SENTINEL} must be the first line`);
  }
  const closes = occurrences(text, PROOFREAD_CLOSING_SENTINEL);
  if (closes > 1) {
    throw new ProofreadFrameError(`The response must contain at most one ${PROOFREAD_CLOSING_SENTINEL}`);
  }
  if (closes === 1 && lines[lines.length - 1].trim() !== PROOFREAD_CLOSING_SENTINEL) {
    throw new ProofreadFrameError(`The closing ${PROOFREAD_CLOSING_SENTINEL} must be the final line`);
  }
  const jsonText = lines.slice(1, closes === 1 ? -1 : undefined).join('\n').trim();
  if (jsonText.length === 0) {
    throw new ProofreadFrameError('The response JSON is empty');
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
    throw new ProofreadFrameError(
      closes === 1
        ? `The response JSON is invalid${error.position !== undefined ? ` (at character ${error.position})` : ''}`
        : `The response must end with ${PROOFREAD_CLOSING_SENTINEL}`,
      `A structural repair was refused: ${describeModelJsonRefusal(error.refusal)}.`
    );
  }
  if (closes === 0) {
    repairs.add('missing-closing-sentinel');
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ProofreadFrameError('The response JSON must be an object');
  }
  return { root: value as Record<string, unknown>, repairs: [...repairs] };
}

/** The lines without a fence line around them, sentinels and all, noted as a repair. */
function unfenced(lines: string[], repairs: Set<ProofreadFrameRepair>): string[] {
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
