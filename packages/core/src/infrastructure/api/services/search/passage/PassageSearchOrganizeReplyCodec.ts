/**
 * The organizing pass's reply, as written (ADR 2026-11-20 D12, D13): asks,
 * not gates.
 *
 * ```json
 * { "headline": "…", "sections": [ { "title": "…", "claims": [ { "text": "…", "cites": [4, 12] } ] } ] }
 * ```
 *
 * - The JSON is read by the shared parser (`parseModelJson`). Each repair is
 *   reported by kind, never with text.
 * - **Every field is read whole.** The host's checks read a headline, a
 *   title and a claim for what they quote, so nothing is clipped here; the
 *   checks clip what they keep, after they have read it.
 * - The counts the prompt states (`sections`, `claims`) are asks: every
 *   section and claim written is read.
 * - A headline or title that is missing, empty or not text is absent, and
 *   the host writes its own. A claim with no text, or an entry that is not
 *   an object, is counted `malformed` and left out; so is a section whose
 *   `claims` is not a list. `cites` keeps the whole numbers it holds, each
 *   once (a number written as digits in a string counts); anything else in
 *   it is counted as a cite of nothing shown.
 * - Fields the format does not define are ignored and counted.
 * - A reply cut off at its output ceiling is not salvaged: a claim list
 *   that stops mid-thought is no analysis (`cut`). A reply longer than
 *   `responseCharacters`, one that does not parse, or one whose root has no
 *   `sections` list is `malformed`.
 *
 * Pure. An error carries a closed kind and no text of the reply.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ModelJsonParseError, parseModelJson, type ModelJsonRepairKind } from '@parsers/ModelJsonRepair';

export interface PassageSearchOrganizeReplyClaim {
  readonly text: string;
  /** Whole numbers the claim cites, each once, in the order written. */
  readonly cites: readonly number[];
  /** Entries of `cites` that are not a whole number. */
  readonly badCites: number;
}

export interface PassageSearchOrganizeReplySection {
  /** Absent when the reply gave none that can be read. */
  readonly title?: string;
  readonly claims: readonly PassageSearchOrganizeReplyClaim[];
}

export interface PassageSearchOrganizeReply {
  /** Absent when the reply gave none that can be read. */
  readonly headline?: string;
  readonly sections: readonly PassageSearchOrganizeReplySection[];
  /** Claims with no text or not written as an object, and sections not written as one. */
  readonly malformedClaims: number;
  readonly malformedSections: number;
  /** Fields the format does not define, at every level. */
  readonly ignoredFields: number;
  readonly repairs: readonly ModelJsonRepairKind[];
}

export type PassageSearchOrganizeReplyFault = 'cut' | 'too-long' | 'unparseable' | 'no-sections';

/** The reply cannot be read: the pass left no analysis. */
export class PassageSearchOrganizeReplyError extends Error {
  constructor(readonly fault: PassageSearchOrganizeReplyFault) {
    super(`The organizing pass's reply could not be read (${fault}).`);
    this.name = 'PassageSearchOrganizeReplyError';
  }
}

const ROOT_FIELDS = new Set(['headline', 'sections']);
const SECTION_FIELDS = new Set(['title', 'claims']);
const CLAIM_FIELDS = new Set(['text', 'cites']);
const DIGITS = /^[0-9]{1,9}$/;

/** Read a reply's content; `cutOff` when the provider stopped it at the output ceiling. */
export function readPassageSearchOrganizeReply(
  content: string,
  cutOff: boolean,
  bounds: Pick<typeof PROMPT_BUDGETS.passageSearch, 'responseCharacters'> = PROMPT_BUDGETS.passageSearch
): PassageSearchOrganizeReply {
  if (cutOff) {
    throw new PassageSearchOrganizeReplyError('cut');
  }
  if (content.length > bounds.responseCharacters) {
    throw new PassageSearchOrganizeReplyError('too-long');
  }
  const { root, repairs } = rootOf(content);
  if (!Array.isArray(root.sections)) {
    throw new PassageSearchOrganizeReplyError('no-sections');
  }
  let ignoredFields = unknownFields(root, ROOT_FIELDS);
  let malformedClaims = 0;
  let malformedSections = 0;
  const sections: PassageSearchOrganizeReplySection[] = [];
  for (const item of root.sections) {
    if (!isRecord(item) || !Array.isArray(item.claims)) {
      malformedSections += 1;
      continue;
    }
    ignoredFields += unknownFields(item, SECTION_FIELDS);
    const claims: PassageSearchOrganizeReplyClaim[] = [];
    for (const entry of item.claims) {
      const text = isRecord(entry) ? textOf(entry.text) : undefined;
      if (!isRecord(entry) || text === undefined) {
        malformedClaims += 1;
        continue;
      }
      ignoredFields += unknownFields(entry, CLAIM_FIELDS);
      claims.push({ text, ...citesOf(entry.cites) });
    }
    const title = textOf(item.title);
    sections.push({ ...(title !== undefined ? { title } : {}), claims });
  }
  const headline = textOf(root.headline);
  return { ...(headline !== undefined ? { headline } : {}), sections, malformedClaims, malformedSections, ignoredFields, repairs };
}

function rootOf(content: string): { root: Record<string, unknown>; repairs: readonly ModelJsonRepairKind[] } {
  try {
    const parsed = parseModelJson(content);
    if (!isRecord(parsed.value)) {
      throw new PassageSearchOrganizeReplyError('no-sections');
    }
    return { root: parsed.value, repairs: parsed.repairs };
  } catch (error) {
    if (error instanceof ModelJsonParseError) {
      throw new PassageSearchOrganizeReplyError('unparseable');
    }
    throw error;
  }
}

/** Non-empty text on one line, whole; undefined for anything else. */
function textOf(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const written = value.replace(/\s+/g, ' ').trim();
  return written.length > 0 ? written : undefined;
}

function citesOf(value: unknown): { cites: number[]; badCites: number } {
  const cites = new Set<number>();
  let badCites = 0;
  for (const entry of Array.isArray(value) ? value : []) {
    const cite = typeof entry === 'string' && DIGITS.test(entry.trim()) ? Number(entry.trim()) : entry;
    if (typeof cite === 'number' && Number.isSafeInteger(cite)) {
      cites.add(cite);
    } else {
      badCites += 1;
    }
  }
  return { cites: [...cites], badCites };
}

const unknownFields = (record: Record<string, unknown>, known: ReadonlySet<string>): number =>
  Object.keys(record).filter((key) => !known.has(key)).length;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
