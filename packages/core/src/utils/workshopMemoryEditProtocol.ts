/**
 * A proposed change to a saved memory, as its trailer writes it (epic Slice
 * 6c; ADR 2026-11-04 addendum of 2026-11-05). Pure. The frame is the same
 * `<prose-minion-memory-proposal>`; an `<edit>` element naming the memory
 * marks it as an edit, and its other elements are operations, read in the
 * order written:
 *
 * - **rewrite**: `<title>`, `<kind>`, `<summary>` or `<body>` replaces that
 *   field whole (a body may be emptied; the others may not);
 * - **replace**: `<find-in-summary>` or `<find-in-body>`, followed at once by
 *   `<replace-with>`: a quote of the field as the note says it, and what
 *   takes its place (which may be empty). At most `editReplaces` pairs;
 * - **append** / **prepend**: `<append>` or `<prepend>`, a passage added at
 *   the end or the start of the body, each at most once.
 *
 * A field rewritten whole takes no other operation (`conflicting-operations`),
 * so every quote is anchored against the note as it stands. An edit names
 * nothing it replaces (`edit-supersedes`): that is a new note's. Anchoring
 * the quotes is the host's, against the note, when the reply is read
 * (`WorkshopMemoryEditAnchor`); this only reads the trailer.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_ID } from '@shared/types/projectMemory';
import {
  workshopMemoryFieldFault,
  type WorkshopMemoryFieldFault,
  type WorkshopMemoryFieldName
} from '@/utils/workshopMemoryProposalFields';

/** The elements only an edit holds; a frame without `<edit>` refuses them. */
export const WORKSHOP_MEMORY_EDIT_ELEMENTS = ['edit', 'find-in-summary', 'find-in-body', 'replace-with', 'append', 'prepend'] as const;

export const WORKSHOP_MEMORY_EDIT_REPLACES = PROMPT_BUDGETS.workshopProjectMemory.editReplaces;

export const WORKSHOP_MEMORY_EDIT_FAULTS = [
  'invalid-edit-target',
  'edit-supersedes',
  // A change cites no turns: it keeps its note's sources (Bookmark Recall D10).
  'edit-cites',
  'empty-edit',
  'unpaired-find',
  'empty-find',
  'too-many-replaces',
  'conflicting-operations'
] as const;
/** An edit's own faults, and the shared ones it can meet (a repeated element, a field left empty). */
export type WorkshopMemoryEditFault =
  | typeof WORKSHOP_MEMORY_EDIT_FAULTS[number]
  | WorkshopMemoryFieldFault
  | 'repeated-element'
  | 'missing-title'
  | 'missing-kind'
  | 'missing-summary';

export type WorkshopMemoryEditOperation =
  | { readonly op: 'rewrite'; readonly field: WorkshopMemoryFieldName; readonly value: string }
  | { readonly op: 'replace'; readonly field: 'summary' | 'body'; readonly find: string; readonly with: string }
  | { readonly op: 'append' | 'prepend'; readonly text: string };

/** A decoded edit: the memory it names, and its operations in the order written. */
export interface WorkshopMemoryEditDraft {
  readonly proposes: 'edit';
  readonly target: string;
  readonly operations: readonly WorkshopMemoryEditOperation[];
}

export type WorkshopMemoryEditDecode =
  | { readonly kind: 'edit'; readonly edit: WorkshopMemoryEditDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopMemoryEditFault };

const REWRITES: readonly string[] = ['title', 'kind', 'summary', 'body'];

/** Decode an edit frame's elements (the frame holds `<edit>`). */
export function decodeWorkshopMemoryEdit(
  elements: ReadonlyArray<{ readonly name: string; readonly content: string }>
): WorkshopMemoryEditDecode {
  const targets = elements.filter((element) => element.name === 'edit');
  if (targets.length > 1) {
    return reject('repeated-element');
  }
  const target = targets[0].content.trim();
  if (!PROJECT_MEMORY_ID.test(target)) {
    return reject('invalid-edit-target');
  }
  const operations: WorkshopMemoryEditOperation[] = [];
  const seen = new Set<string>();
  let replaces = 0;
  for (let index = 0; index < elements.length; index += 1) {
    const { name, content } = elements[index];
    if (name === 'edit') {
      continue;
    }
    if (name === 'supersedes') {
      return reject('edit-supersedes');
    }
    if (name === 'cites-turn') {
      return reject('edit-cites');
    }
    if (name === 'replace-with') {
      return reject('unpaired-find');
    }
    if (REWRITES.includes(name) || name === 'append' || name === 'prepend') {
      if (seen.has(name)) {
        return reject('repeated-element');
      }
      seen.add(name);
    }
    if (REWRITES.includes(name)) {
      const field = name as WorkshopMemoryFieldName;
      const value = content.trim();
      if (!value && field !== 'body') {
        return reject(`missing-${field}` as WorkshopMemoryEditFault);
      }
      const fault = workshopMemoryFieldFault(field, value);
      if (fault) {
        return reject(fault);
      }
      operations.push({ op: 'rewrite', field, value });
      continue;
    }
    if (name === 'append' || name === 'prepend') {
      const text = content.trim();
      if (!text) {
        return reject('empty-edit');
      }
      operations.push({ op: name, text });
      continue;
    }
    // find-in-summary or find-in-body, then replace-with at once.
    const next = elements[index + 1];
    if (next?.name !== 'replace-with') {
      return reject('unpaired-find');
    }
    const find = content.trim();
    if (!find) {
      return reject('empty-find');
    }
    replaces += 1;
    if (replaces > WORKSHOP_MEMORY_EDIT_REPLACES) {
      return reject('too-many-replaces');
    }
    operations.push({ op: 'replace', field: name === 'find-in-summary' ? 'summary' : 'body', find, with: next.content.trim() });
    index += 1;
  }
  if (operations.length === 0) {
    return reject('empty-edit');
  }
  if (conflicts(operations)) {
    return reject('conflicting-operations');
  }
  return { kind: 'edit', edit: { proposes: 'edit', target, operations } };
}

/** A field rewritten whole that another operation also touches. */
function conflicts(operations: readonly WorkshopMemoryEditOperation[]): boolean {
  const rewritten = new Set(operations.flatMap((operation) => operation.op === 'rewrite' ? [operation.field] : []));
  return operations.some((operation) => operation.op === 'replace'
    ? rewritten.has(operation.field)
    : operation.op !== 'rewrite' && rewritten.has('body'));
}

/** Whether a decoded trailer is an edit rather than a new note. */
export function isWorkshopMemoryEditDraft(draft: object): draft is WorkshopMemoryEditDraft {
  return (draft as { proposes?: unknown }).proposes === 'edit';
}

function reject(fault: WorkshopMemoryEditFault): WorkshopMemoryEditDecode {
  return { kind: 'rejected', fault };
}
