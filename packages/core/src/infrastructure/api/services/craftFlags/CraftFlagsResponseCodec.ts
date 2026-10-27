/**
 * A Craft Flags reply (ADR 2026-10-21, Amendment 2026-10-26: Slice 3c): its
 * frame, and its flags. Pure: no host, no I/O.
 *
 * As Proofread's: forgiving per reply, fail-closed per flag.
 * - A field the format does not define, at the root or on a flag, is ignored
 *   and counted, never named. A `replacement` is one: a Craft Flags flag
 *   never carries an edit.
 * - A flag missing its quote or its why, with a kind outside its category's
 *   (`CRAFT_FLAG_KINDS`), or quoting more than a phrase is dropped and
 *   counted. The kind is never guessed.
 * - Only a root of the wrong shape (no `flags` array, or a `version` other
 *   than 1) rejects the reply. So does a register reply with flags and no
 *   `register` line: its flags have nothing they shift from (Slice 3c part
 *   2).
 *
 * Each note is held to the phrasing fence (`craftFlagPhrasing`). A why that
 * breaks it is replaced by the host's line for its kind, and a suggestion
 * that breaks it is withheld; the flag stays, and the notes withheld are
 * counted. Notes are clipped to their ceilings; a quote never is, because a
 * clipped quote would place the flag somewhere else.
 *
 * A register reply's `register` line, the register the narration keeps, is
 * a note too: held to the fence but for its digit rule (a period may be
 * named by its years), withheld and counted when it breaks it, clipped, and
 * carried on each of the reply's findings.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { FAMILIAR_PHRASE_DEFINITIONS } from '@shared/constants/familiarPhrasing';
import {
  CONTINUITY_DEFINITIONS,
  GESTURE_STRAIN_DEFINITIONS,
  REGISTER_SHIFT_DEFINITIONS,
  isCraftFlagKind,
  type ContinuityHolds,
  type CraftFlagCategory,
  type CraftFlagFinding,
  type CraftFlagKind
} from '@/domain/models/CraftFlag';
import { craftFlagPhrasingFault } from '@/utils/craftFlags/craftFlagPhrasing';
import { DraftEditFrameError, readDraftEditFrame, type DraftEditFrame, type DraftEditFrameSpec } from '@services/draftEdit/DraftEditResponseFrame';

export const CRAFT_FLAGS_OPENING_SENTINEL = '===CRAFT_FLAGS_V1===';
export const CRAFT_FLAGS_CLOSING_SENTINEL = '===END_CRAFT_FLAGS_V1===';

export const CRAFT_FLAGS_FRAME: DraftEditFrameSpec = {
  opening: CRAFT_FLAGS_OPENING_SENTINEL,
  closing: CRAFT_FLAGS_CLOSING_SENTINEL,
  responseCharacters: PROMPT_BUDGETS.craftFlags.responseCharacters
};

/** Read a Craft Flags reply's frame; throws `DraftEditFrameError` when it cannot be read. */
export function readCraftFlagsFrame(content: string): DraftEditFrame {
  return readDraftEditFrame(content, CRAFT_FLAGS_FRAME);
}

export interface CraftFlagsReply {
  readonly findings: readonly CraftFlagFinding[];
  /** Flags dropped as malformed. */
  readonly malformed: number;
  /** Flags whose why was replaced, or whose suggestion was withheld, by the phrasing fence. */
  readonly notesWithheld: number;
  /** Fields the format does not define, ignored. */
  readonly ignoredFields: number;
}

/** Every kind's definition: the shared familiar-phrase vocabulary, and register shift's and gesture strain's own. */
const CRAFT_FLAG_DEFINITIONS: Readonly<Record<CraftFlagKind, string>> = {
  cliche: FAMILIAR_PHRASE_DEFINITIONS.cliche,
  weighted: FAMILIAR_PHRASE_DEFINITIONS.weighted,
  ...REGISTER_SHIFT_DEFINITIONS,
  ...GESTURE_STRAIN_DEFINITIONS,
  ...CONTINUITY_DEFINITIONS
};

/** The host's why, for a flag whose own broke the fence: the definition of its kind. */
export function craftFlagHostWhy(kind: CraftFlagKind): string {
  const definition = CRAFT_FLAG_DEFINITIONS[kind];
  return `${definition[0].toUpperCase()}${definition.slice(1)}.`;
}

/** Each category's root fields; a register reply also names the register it reads shifts against. */
const ROOT_FIELDS: Readonly<Record<CraftFlagCategory, ReadonlySet<string>>> = {
  cliche: new Set(['version', 'flags']),
  register: new Set(['version', 'flags', 'register']),
  gesture: new Set(['version', 'flags']),
  continuity: new Set(['version', 'flags'])
};
const NOTE_FLAG_FIELDS: ReadonlySet<string> = new Set(['original', 'before', 'after', 'kind', 'why', 'suggestion']);
/** A continuity flag quotes its earlier side too, and says which side the chapter keeps; it offers no suggestion, which would pick a side. */
const PAIR_FLAG_FIELDS: ReadonlySet<string> = new Set(['original', 'before', 'after', 'kind', 'why', 'earlier', 'holds']);
const QUOTE_FIELDS: ReadonlySet<string> = new Set(['original', 'before', 'after']);
const HOLDS: Readonly<Record<string, ContinuityHolds | undefined>> = { earlier: 'earlier', later: 'later', neither: undefined };

/** Decode a frame's root for one category's call; throws `DraftEditFrameError` when the root has the wrong shape. */
export function decodeCraftFlagsReply(root: Record<string, unknown>, category: CraftFlagCategory): CraftFlagsReply {
  if (root.version !== undefined && root.version !== 1) {
    throw new DraftEditFrameError('The response must be version 1');
  }
  if (!Array.isArray(root.flags)) {
    throw new DraftEditFrameError('The response must have a flags array');
  }
  let ignoredFields = Object.keys(root).filter((key) => !ROOT_FIELDS[category].has(key)).length;
  let malformed = 0;
  let notesWithheld = 0;
  const ground = category === 'register' ? registerLine(root.register, root.flags.length > 0) : undefined;
  notesWithheld += ground?.withheld ? 1 : 0;
  const findings: CraftFlagFinding[] = [];
  for (const item of root.flags as unknown[]) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      malformed += 1;
      continue;
    }
    const flag = item as Record<string, unknown>;
    const fields = category === 'continuity' ? PAIR_FLAG_FIELDS : NOTE_FLAG_FIELDS;
    ignoredFields += Object.keys(flag).filter((key) => !fields.has(key)).length;
    const pair = category === 'continuity' ? decodePair(flag) : undefined;
    const decoded = pair === null ? undefined : decodeFlag(category === 'continuity' ? { ...flag, suggestion: undefined } : flag, category);
    if (!decoded) {
      malformed += 1;
      continue;
    }
    if (pair) {
      ignoredFields += pair.ignoredFields;
      decoded.finding = { ...decoded.finding, earlier: pair.earlier, ...(pair.holds ? { holds: pair.holds } : {}) };
    }
    findings.push(ground?.line !== undefined ? { ...decoded.finding, register: ground.line } : decoded.finding);
    notesWithheld += decoded.withheld ? 1 : 0;
  }
  return { findings, malformed, notesWithheld, ignoredFields };
}

function decodeFlag(flag: Record<string, unknown>, category: CraftFlagCategory): { finding: CraftFlagFinding; withheld: boolean } | undefined {
  const B = PROMPT_BUDGETS.craftFlags;
  const { kind, why, suggestion } = flag;
  if (!isCraftFlagKind(category, kind)) {
    return undefined;
  }
  const anchor = decodeQuote(flag);
  if (!anchor) {
    return undefined;
  }
  if (typeof why !== 'string' || why.trim().length === 0) {
    return undefined;
  }
  if (!optionalString(suggestion)) {
    return undefined;
  }
  const whyFits = craftFlagPhrasingFault(why) === undefined;
  const offered = typeof suggestion === 'string' && suggestion.trim().length > 0 ? suggestion.trim() : undefined;
  const suggestionFits = offered === undefined || craftFlagPhrasingFault(offered) === undefined;
  return {
    finding: {
      anchor,
      category,
      kind,
      why: whyFits ? clip(why.trim(), B.whyCharacters) : craftFlagHostWhy(kind),
      ...(offered !== undefined && suggestionFits ? { suggestion: clip(offered, B.suggestionCharacters) } : {})
    },
    withheld: !whyFits || !suggestionFits
  };
}

/**
 * A register reply's line naming the register the narration keeps. Required
 * when the reply has flags; held to the fence but for its digit rule, since a
 * period may be named by its years ("the 1920s"); a line that breaks it is
 * withheld, and the flags stay.
 */
function registerLine(value: unknown, hasFlags: boolean): { line?: string; withheld: boolean } | undefined {
  if (!hasFlags) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DraftEditFrameError('A register reply with flags must state the register the narration keeps');
  }
  const line = value.trim();
  const fault = craftFlagPhrasingFault(line);
  return fault === undefined || fault === 'figure'
    ? { line: clip(line, PROMPT_BUDGETS.craftFlags.registerCharacters), withheld: false }
    : { withheld: true };
}

/** A quote and its context, from a flag or a continuity pair's earlier side; undefined when either is malformed. */
function decodeQuote(source: Record<string, unknown>): CraftFlagFinding['anchor'] | undefined {
  const B = PROMPT_BUDGETS.craftFlags;
  const { original, before, after } = source;
  if (typeof original !== 'string' || original.trim().length === 0 || original.length > B.quoteCharacters) {
    return undefined;
  }
  if (!optionalString(before) || !optionalString(after)) {
    return undefined;
  }
  return {
    quote: original,
    ...(typeof before === 'string' && before.length > 0 ? { before: before.slice(-B.contextCharacters) } : {}),
    ...(typeof after === 'string' && after.length > 0 ? { after: after.slice(0, B.contextCharacters) } : {})
  };
}

/**
 * A continuity flag's earlier side and which side the chapter keeps; null
 * when either is malformed (no earlier quote, or a `holds` outside its
 * values), which drops the flag. `neither`, null or no `holds` keeps none.
 */
function decodePair(flag: Record<string, unknown>): { earlier: CraftFlagFinding['anchor']; holds?: ContinuityHolds; ignoredFields: number } | null {
  const { earlier, holds } = flag;
  if (typeof earlier !== 'object' || earlier === null || Array.isArray(earlier)) {
    return null;
  }
  const side = earlier as Record<string, unknown>;
  const anchor = decodeQuote(side);
  const known = holds === undefined || holds === null || (typeof holds === 'string' && holds in HOLDS);
  if (!anchor || !known) {
    return null;
  }
  const kept = typeof holds === 'string' ? HOLDS[holds] : undefined;
  return { earlier: anchor, ...(kept ? { holds: kept } : {}), ignoredFields: Object.keys(side).filter((key) => !QUOTE_FIELDS.has(key)).length };
}

function optionalString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function clip(text: string, limit: number): string {
  return text.length <= limit ? text : `${text.slice(0, limit - 1)}…`;
}
