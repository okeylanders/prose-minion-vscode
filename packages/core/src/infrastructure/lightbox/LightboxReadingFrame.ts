/**
 * A group's frame: one JSON object between its sentinels (ADR 2026-10-19
 * D6), read before any block is decoded (`LightboxReadingCodec`). Pure: no
 * host, no I/O.
 *
 * The frame is all-or-nothing: a missing or repeated opening sentinel, text
 * before it, or JSON that cannot be read fails the whole group, which the
 * reply reader quarantines. Since Slice 4H (epic decisions 39 and 40) a
 * frame is first given deterministic, structure-only repairs, and a reply
 * cut off at the output ceiling is salvaged:
 * - **the JSON** goes through the shared, feature-agnostic parser
 *   (`@parsers/ModelJsonRepair`): a code fence around it, stray or missing
 *   closing brackets, trailing commas and curly-quote delimiters, under its
 *   content guard, or refused as before. Lightbox keeps only what is its
 *   protocol's, here:
 * - a code fence around the whole frame, sentinels included, is set aside
 *   (`code-fence`);
 * - a reply that stopped normally with no closing sentinel is accepted
 *   when its JSON is complete as it stands (`missing-closing-sentinel`):
 *   no bracket is added to it;
 * - a reply that reached the output ceiling before its frame closed keeps
 *   the root's finished members, and names the member it was cut inside
 *   (`cutOff.cutKey`), which is dropped, never trusted;
 * - a reply cut off at the output ceiling while it wrote its frame's ending
 *   (PR #165 F-02) has that part set aside first, only when the last line
 *   is a start of this group's closing sentinel, or of the closing fence
 *   of a fence the reply opened, around the frame or inside it. A reply
 *   that stopped normally gets no such allowance, and any other last line
 *   is read as it stands, and refused as before;
 * - a member closed out of its block, standing in the root just after the
 *   block that defines it and lacks it, is moved back into that block
 *   (`misnested-member`, Slice 4K, epic decision 50), by the text's order
 *   of the root's members, under the content guard
 *   (`LightboxBlockFormat`). The writer's real case: group E's summary
 *   closed one brace early, before its friction.
 * Every message is host-owned (PR #149 F-05): positions and the protocol's
 * own names, never the text. Why a repair was refused goes only into the
 * frame error's `diagnostic`, beside the body in the recovery store.
 */

import type { LightboxReadingGroupId } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { objectAt } from '@/application/services/workshop/persistedValidation';
import {
  ModelJsonParseError,
  describeModelJsonRefusal,
  parseModelJson,
  salvageModelJson,
  type ModelJsonSalvaged
} from '@parsers/ModelJsonRepair';
import { renestLightboxMembers } from '@/infrastructure/lightbox/LightboxBlockFormat';
import {
  LightboxGroupFrameError,
  lightboxGroupSentinels,
  type LightboxFrameRepair,
  type LightboxReplyEnd
} from '@/infrastructure/lightbox/LightboxReadingWire';

export interface LightboxFrame {
  root: Record<string, unknown>;
  /** The structural repairs made, each kind once, in the order first made. */
  repairs: LightboxFrameRepair[];
  /** Present when the reply reached the output ceiling before its frame closed. */
  cutOff?: {
    /** The root member it was cut inside, when that member's key had arrived whole. */
    cutKey?: string;
  };
}

/** A fence line: three backticks and maybe a language, alone on its line. */
const OPENING_FENCE = /^```[\w-]*$/u;
const CLOSING_FENCE = '```';

/** Read a group's frame; throws `LightboxGroupFrameError` when it cannot be read. */
export function readLightboxFrame(content: string, group: LightboxReadingGroupId, end: LightboxReplyEnd): LightboxFrame {
  const B = PROMPT_BUDGETS.lightbox;
  // The one safety ceiling, for the whole response: far past what the output ceiling lets a reply run to.
  const ceiling = B.groupResponseCharacters * B.safetyMultiple;
  if (content.length > ceiling) {
    throw new LightboxGroupFrameError(`The group ${group} response runs past ${ceiling.toLocaleString('en-US')} characters`);
  }
  const repairs = new Set<LightboxFrameRepair>();
  const { start, end: close } = lightboxGroupSentinels(group);
  const written = content.replace(/\r\n?/g, '\n').trim().split('\n');
  const lines = unfenced(end === 'ceiling' ? withoutCutEnding(written, close) : written, repairs);
  const text = lines.join('\n');
  if (occurrences(text, start) !== 1) {
    throw new LightboxGroupFrameError(`The group ${group} response must contain exactly one ${start}`);
  }
  if (lines[0].trim() !== start) {
    throw new LightboxGroupFrameError(`The group ${group} opening sentinel must be the first line`);
  }
  const closes = occurrences(text, close);
  if (closes > 1) {
    throw new LightboxGroupFrameError(`The group ${group} response must contain exactly one ${close}`);
  }
  if (closes === 1 && lines[lines.length - 1].trim() !== close) {
    throw new LightboxGroupFrameError(`The group ${group} closing sentinel must be the final line`);
  }
  const between = lines.slice(1, closes === 1 ? -1 : undefined);
  // Cut off inside the closing fence of a fence opened inside the sentinels: the fence's start is set aside too.
  const jsonText = (end === 'ceiling' && closes === 0 ? withoutCutEnding(between) : between).join('\n').trim();
  if (jsonText.length === 0) {
    throw new LightboxGroupFrameError(`The group ${group} response JSON is empty`);
  }

  if (closes === 0 && end === 'ceiling') {
    return salvaged(jsonText, group, repairs);
  }
  // With no closing sentinel, a reply that stopped normally is accepted only when its JSON is complete as it stands.
  const parsed = readJson(jsonText, group, repairs, closes === 1);
  if (closes === 0) {
    if ('refused' in parsed) {
      throw new LightboxGroupFrameError(`The group ${group} response must contain exactly one ${close}`, parsed.refused.diagnostic);
    }
    repairs.add('missing-closing-sentinel');
  } else if ('refused' in parsed) {
    throw parsed.refused;
  }
  const root = renested(rootOf(parsed.value, group), parsed.rootKeys, repairs);
  return { root, repairs: [...repairs] };
}

function salvaged(jsonText: string, group: LightboxReadingGroupId, repairs: Set<LightboxFrameRepair>): LightboxFrame {
  repairs.add('missing-closing-sentinel');
  let salvage: ModelJsonSalvaged;
  try {
    salvage = salvageModelJson(jsonText, { rootKeys: true });
  } catch (error) {
    throw new LightboxGroupFrameError(
      `The group ${group} reply reached the output ceiling and could not be read`,
      error instanceof ModelJsonParseError ? `A salvage was refused: ${describeModelJsonRefusal(error.refusal)}.` : undefined
    );
  }
  salvage.repairs.forEach((repair) => repairs.add(repair));
  const root = renested(salvage.root, salvage.rootKeys, repairs);
  return { root, repairs: [...repairs], cutOff: salvage.cutKey !== undefined ? { cutKey: salvage.cutKey } : {} };
}

/** The root with each member closed out of its block moved back into it (`LightboxBlockFormat`), noted as a repair. */
function renested(root: Record<string, unknown>, rootKeys: readonly string[] | undefined, repairs: Set<LightboxFrameRepair>): Record<string, unknown> {
  const renest = renestLightboxMembers(root, rootKeys ?? []);
  if (renest.moved > 0) {
    repairs.add('misnested-member');
  }
  return renest.root;
}

/** The shared parser's reading, or the frame error it becomes: the parser's position, never its text. */
function readJson(
  jsonText: string,
  group: LightboxReadingGroupId,
  repairs: Set<LightboxFrameRepair>,
  closeMissingBrackets: boolean
): { value: unknown; rootKeys?: string[] } | { refused: LightboxGroupFrameError } {
  try {
    const read = parseModelJson(jsonText, { closeMissingBrackets, rootKeys: true });
    read.repairs.forEach((repair) => repairs.add(repair));
    return { value: read.value, ...(read.rootKeys ? { rootKeys: read.rootKeys } : {}) };
  } catch (error) {
    if (!(error instanceof ModelJsonParseError)) {
      throw error;
    }
    return {
      refused: new LightboxGroupFrameError(
        `The group ${group} response JSON is invalid${error.position !== undefined ? ` (at character ${error.position})` : ''}`,
        `A structural repair was refused: ${describeModelJsonRefusal(error.refusal)}.`
      )
    };
  }
}

function rootOf(parsedValue: unknown, group: LightboxReadingGroupId): Record<string, unknown> {
  try {
    return objectAt(parsedValue, `group ${group}`);
  } catch (error) {
    throw new LightboxGroupFrameError(error instanceof Error ? error.message : String(error));
  }
}

/** The frame's lines without a fence line around them, sentinels and all, noted as a repair. */
function unfenced(lines: string[], repairs: Set<LightboxFrameRepair>): string[] {
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
  return from === 0 && to === lines.length ? lines : lines.slice(from, to);
}

/** A proper, non-empty start of `marker`, alone on its line: what a reply cut off while writing it leaves. */
function cutStartOf(line: string, marker: string): boolean {
  const written = line.trim();
  return written.length > 0 && written.length < marker.length && marker.startsWith(written);
}

/**
 * The lines without a last line that is a start of the frame's ending, cut
 * off at the output ceiling (PR #165 F-02): the closing fence of a fence
 * these lines open, or, given, this group's closing sentinel. Only a length
 * cutoff calls it; any other last line is kept, to be read or refused.
 */
function withoutCutEnding(lines: string[], close?: string): string[] {
  const last = lines[lines.length - 1] ?? '';
  const opensFence = lines.length > 1 && OPENING_FENCE.test(lines[0].trim());
  const cut = (opensFence && cutStartOf(last, CLOSING_FENCE)) || (close !== undefined && cutStartOf(last, close));
  return cut ? lines.slice(0, -1) : lines;
}

function occurrences(text: string, marker: string): number {
  return text.split(marker).length - 1;
}
