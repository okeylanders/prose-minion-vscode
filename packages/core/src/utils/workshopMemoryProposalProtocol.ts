/**
 * The project-memory proposal trailer's codec (ADR 2026-11-04 D6, D11;
 * epic Slice 3). Pure. It decodes the inside of the one eligible
 * `<prose-minion-memory-proposal>` frame the tail extractor
 * (`workshopReplyControls`) found, against closed element names and the
 * format's bounds, and rejects the whole proposal on any fault, by reason.
 *
 * - **Closed elements:** `title`, `kind`, `summary`, `body` once each, and
 *   `supersedes` repeated at most `PROJECT_MEMORY_LIST_ENTRIES.supersedes`
 *   times. Each element is alone on its own text: anything between elements
 *   but whitespace is stray text.
 * - **Provenance is the host's** (D6): an element naming any frontmatter key
 *   the host fills (`id`, `created`, `updated`, `origin`, `status`,
 *   `pinned`, `proposed-by`, `source-session`, `source-turns`, `format`)
 *   rejects the proposal as `provenance`.
 * - **Bounds** are the codec's (D4, D11): title and summary one line within
 *   their characters, the body within its characters, a kind from the
 *   closed list, each `supersedes` a memory id.
 * - **Reasons, never text.** A rejection names its reason and, at most, an
 *   element name; no caller logs what a field held (D9).
 * - **Cited turns** (ADR 2026-11-05 D10): `cites-turn`, repeated at most
 *   `citedTurns` times, names an open-room turn the suggestion came from, by
 *   the turn id `transcript.bookmarks` shows. The codec checks only that each
 *   is one token; the host keeps a cited turn only when the open room holds
 *   it and the proposing persona could see it, at save time
 *   (`workshopProposalProvenance`), and drops anything else by id.
 * - **An edit** (Slice 6c): a frame holding `<edit>` proposes a change to
 *   the memory it names, decoded by `workshopMemoryEditProtocol` from the
 *   same elements, in the order written. Its operations' elements in a frame
 *   without `<edit>` reject it as `edit-element`.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  PROJECT_MEMORY_ID,
  PROJECT_MEMORY_LIST_ENTRIES,
  type ProjectMemoryKind
} from '@shared/types/projectMemory';

import {
  decodeWorkshopMemoryEdit,
  WORKSHOP_MEMORY_EDIT_ELEMENTS,
  type WorkshopMemoryEditDraft,
  type WorkshopMemoryEditFault
} from '@/utils/workshopMemoryEditProtocol';
import { workshopMemoryFieldFault, type WorkshopMemoryFieldFault } from '@/utils/workshopMemoryProposalFields';

export const WORKSHOP_MEMORY_PROPOSAL_TAG = 'prose-minion-memory-proposal';

/** What a valid trailer carries; the host adds provenance and standing. */
export interface WorkshopMemoryProposalDraft {
  readonly title: string;
  readonly kind: ProjectMemoryKind;
  readonly summary: string;
  readonly body: string;
  /** Memory ids, deduplicated, in the order written. */
  readonly supersedes: readonly string[];
  /** Open-room turns it cites (D10), deduplicated, in the order written; absent when it cites none. */
  readonly cites?: readonly string[];
}

/**
 * What a `cites-turn` may hold: one token, as a turn id or a bookmark ref is
 * written. Whether it names a turn the persona could see is the host's
 * check; a ref of another shape survives to be dropped there, by id.
 */
export const WORKSHOP_MEMORY_CITED_TURN = /^[A-Za-z0-9@][A-Za-z0-9@/._:-]{0,199}$/;

export const WORKSHOP_MEMORY_PROPOSAL_FAULTS = [
  'stray-text',
  'unknown-element',
  'provenance',
  'unclosed-element',
  'repeated-element',
  'missing-title',
  'missing-kind',
  'missing-summary',
  'invalid-supersedes',
  'too-many-supersedes',
  // A `cites-turn` that isn't one token, or more of them than `citedTurns` (D10).
  'invalid-cites',
  'too-many-cites',
  // An edit's element in a frame without `<edit>` (Slice 6c).
  'edit-element'
] as const;
/** Every reason a frame's inside is refused: its own, a field's, or an edit's (Slice 6c). */
export type WorkshopMemoryProposalFault =
  | typeof WORKSHOP_MEMORY_PROPOSAL_FAULTS[number]
  | WorkshopMemoryFieldFault
  | WorkshopMemoryEditFault;

export type WorkshopMemoryProposalDecode =
  | { readonly kind: 'proposal'; readonly proposal: WorkshopMemoryProposalDraft }
  | { readonly kind: 'edit'; readonly edit: WorkshopMemoryEditDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopMemoryProposalFault };

const FIELDS = ['title', 'kind', 'summary', 'body', 'supersedes', 'cites-turn'] as const;
/** Elements a frame may repeat. */
const REPEATED: readonly string[] = ['supersedes', 'cites-turn'];
type Field = typeof FIELDS[number];
const ELEMENTS: readonly string[] = [...FIELDS, ...WORKSHOP_MEMORY_EDIT_ELEMENTS];

/** One element of a frame, in the order written: its name and what it holds, untrimmed. */
export interface WorkshopMemoryProposalElement {
  readonly name: string;
  readonly content: string;
}

/** Frontmatter keys the host fills; a trailer naming one is refused (D6). */
const PROVENANCE = new Set([
  'id', 'created', 'updated', 'origin', 'status', 'pinned', 'format',
  'proposed-by', 'source-session', 'source-turns'
]);

const OPENING = /<([a-z][a-z0-9-]*)\s*>/iy;

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopMemoryProposal(inner: string): WorkshopMemoryProposalDecode {
  const elements = readElements(inner);
  if (!Array.isArray(elements)) {
    return elements;
  }
  if (elements.some((element) => element.name === 'edit')) {
    return decodeWorkshopMemoryEdit(elements);
  }
  const values = new Map<Field, string[]>();
  for (const { name, content } of elements) {
    if (!isField(name)) {
      return reject('edit-element');
    }
    if (!REPEATED.includes(name) && values.has(name)) {
      return reject('repeated-element');
    }
    values.set(name, [...(values.get(name) ?? []), content]);
  }
  return check(values);
}

/** A frame's elements in order, or the fault that stops reading it. */
function readElements(inner: string): WorkshopMemoryProposalElement[] | WorkshopMemoryProposalDecode {
  const elements: WorkshopMemoryProposalElement[] = [];
  let at = 0;
  while (true) {
    while (at < inner.length && /\s/.test(inner[at])) {
      at += 1;
    }
    if (at >= inner.length) {
      return elements;
    }
    OPENING.lastIndex = at;
    const opening = OPENING.exec(inner);
    if (!opening) {
      return reject('stray-text');
    }
    const name = opening[1].toLowerCase();
    if (PROVENANCE.has(name)) {
      return reject('provenance');
    }
    if (!ELEMENTS.includes(name)) {
      return reject('unknown-element');
    }
    const contentStart = at + opening[0].length;
    const close = closingTag(name).exec(inner.slice(contentStart));
    if (!close) {
      return reject('unclosed-element');
    }
    elements.push({ name, content: inner.slice(contentStart, contentStart + close.index) });
    at = contentStart + close.index + close[0].length;
  }
}

function check(values: ReadonlyMap<Field, string[]>): WorkshopMemoryProposalDecode {
  const title = values.get('title')?.[0]?.trim() ?? '';
  const kind = values.get('kind')?.[0]?.trim() ?? '';
  const summary = values.get('summary')?.[0]?.trim() ?? '';
  const body = values.get('body')?.[0]?.trim() ?? '';
  if (!title) {
    return reject('missing-title');
  }
  if (!kind) {
    return reject('missing-kind');
  }
  if (!summary) {
    return reject('missing-summary');
  }
  const fault = workshopMemoryFieldFault('kind', kind) ?? workshopMemoryFieldFault('title', title)
    ?? workshopMemoryFieldFault('summary', summary) ?? workshopMemoryFieldFault('body', body);
  if (fault) {
    return reject(fault);
  }
  const supersedes: string[] = [];
  for (const raw of values.get('supersedes') ?? []) {
    const id = raw.trim();
    if (!PROJECT_MEMORY_ID.test(id)) {
      return reject('invalid-supersedes');
    }
    if (!supersedes.includes(id)) {
      supersedes.push(id);
    }
  }
  if (supersedes.length > PROJECT_MEMORY_LIST_ENTRIES.supersedes) {
    return reject('too-many-supersedes');
  }
  const cites: string[] = [];
  for (const raw of values.get('cites-turn') ?? []) {
    const id = raw.trim();
    if (!WORKSHOP_MEMORY_CITED_TURN.test(id)) {
      return reject('invalid-cites');
    }
    if (!cites.includes(id)) {
      cites.push(id);
    }
  }
  if (cites.length > PROMPT_BUDGETS.workshopProjectMemory.citedTurns) {
    return reject('too-many-cites');
  }
  return {
    kind: 'proposal',
    proposal: { title, kind: kind as ProjectMemoryKind, summary, body, supersedes, ...(cites.length > 0 ? { cites } : {}) }
  };
}

function isField(name: string): name is Field {
  return (FIELDS as readonly string[]).includes(name);
}

function closingTag(name: string): RegExp {
  return new RegExp(`</${name}\\s*>`, 'i');
}

function reject(fault: WorkshopMemoryProposalFault): Extract<WorkshopMemoryProposalDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
