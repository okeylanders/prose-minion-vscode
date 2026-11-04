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
 */

import {
  PROJECT_MEMORY_FIELD_CHARACTERS,
  PROJECT_MEMORY_ID,
  PROJECT_MEMORY_KINDS,
  PROJECT_MEMORY_LIST_ENTRIES,
  type ProjectMemoryKind
} from '@shared/types/projectMemory';

export const WORKSHOP_MEMORY_PROPOSAL_TAG = 'prose-minion-memory-proposal';

/** What a valid trailer carries; the host adds provenance and standing. */
export interface WorkshopMemoryProposalDraft {
  readonly title: string;
  readonly kind: ProjectMemoryKind;
  readonly summary: string;
  readonly body: string;
  /** Memory ids, deduplicated, in the order written. */
  readonly supersedes: readonly string[];
}

export const WORKSHOP_MEMORY_PROPOSAL_FAULTS = [
  'stray-text',
  'unknown-element',
  'provenance',
  'unclosed-element',
  'repeated-element',
  'missing-title',
  'missing-kind',
  'missing-summary',
  'invalid-kind',
  'title-not-one-line',
  'summary-not-one-line',
  'title-too-long',
  'summary-too-long',
  'body-too-long',
  'invalid-supersedes',
  'too-many-supersedes'
] as const;
export type WorkshopMemoryProposalFault = typeof WORKSHOP_MEMORY_PROPOSAL_FAULTS[number];

export type WorkshopMemoryProposalDecode =
  | { readonly kind: 'proposal'; readonly proposal: WorkshopMemoryProposalDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopMemoryProposalFault };

const FIELDS = ['title', 'kind', 'summary', 'body', 'supersedes'] as const;
type Field = typeof FIELDS[number];

/** Frontmatter keys the host fills; a trailer naming one is refused (D6). */
const PROVENANCE = new Set([
  'id', 'created', 'updated', 'origin', 'status', 'pinned', 'format',
  'proposed-by', 'source-session', 'source-turns'
]);

const OPENING = /<([a-z][a-z0-9-]*)\s*>/iy;
const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopMemoryProposal(inner: string): WorkshopMemoryProposalDecode {
  const values = new Map<Field, string[]>();
  let at = 0;
  while (true) {
    while (at < inner.length && /\s/.test(inner[at])) {
      at += 1;
    }
    if (at >= inner.length) {
      break;
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
    if (!isField(name)) {
      return reject('unknown-element');
    }
    const contentStart = at + opening[0].length;
    const close = closingTag(name).exec(inner.slice(contentStart));
    if (!close) {
      return reject('unclosed-element');
    }
    const content = inner.slice(contentStart, contentStart + close.index);
    if (name !== 'supersedes' && values.has(name)) {
      return reject('repeated-element');
    }
    values.set(name, [...(values.get(name) ?? []), content]);
    at = contentStart + close.index + close[0].length;
  }
  return check(values);
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
  if (!(PROJECT_MEMORY_KINDS as readonly string[]).includes(kind)) {
    return reject('invalid-kind');
  }
  if (NOT_ONE_LINE.test(title)) {
    return reject('title-not-one-line');
  }
  if (NOT_ONE_LINE.test(summary)) {
    return reject('summary-not-one-line');
  }
  if (title.length > PROJECT_MEMORY_FIELD_CHARACTERS.title) {
    return reject('title-too-long');
  }
  if (summary.length > PROJECT_MEMORY_FIELD_CHARACTERS.summary) {
    return reject('summary-too-long');
  }
  if (body.length > PROJECT_MEMORY_FIELD_CHARACTERS.body) {
    return reject('body-too-long');
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
  return { kind: 'proposal', proposal: { title, kind: kind as ProjectMemoryKind, summary, body, supersedes } };
}

function isField(name: string): name is Field {
  return (FIELDS as readonly string[]).includes(name);
}

function closingTag(name: string): RegExp {
  return new RegExp(`</${name}\\s*>`, 'i');
}

function reject(fault: WorkshopMemoryProposalFault): WorkshopMemoryProposalDecode {
  return { kind: 'rejected', fault };
}
