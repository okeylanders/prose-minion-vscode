/**
 * The persona file-edit trailer's codec (ADR 2026-11-05 D2; epic Slice 3).
 * Pure. It decodes the inside of one `<prose-minion-file-edit>` frame the
 * tail extractor (`workshopReplyControls`) found, read by the shared trailer
 * reader (`workshopTrailerElements`), against closed element names and
 * `PROMPT_BUDGETS.workshopFileEdits`, and refuses the whole frame on any
 * fault, by reason. Faults are values, never thrown.
 *
 * - **The target:** `<group>` and `<path>`, exactly as `resource.read` takes
 *   them (a known group; a workspace-relative path within
 *   `workshopResource.pathCharacters`, by `isSafeConfiguredResourcePath`), or
 *   `<excerpt/>` for the room's excerpt document. Never both.
 * - **The operations,** in the order written, as the shared planner's
 *   (`TextEditOperation`):
 *   - `<rewrite>`: the file's content replaced whole; it stands alone;
 *   - `<find>` followed at once by `<replace-with>`: at most `editReplaces`
 *     pairs; the replacement may be empty;
 *   - `<append>` and `<prepend>`: each at most once, within `insertCharacters`
 *     (prose's `insertWords` is the gateway's policy, D5).
 *   A frame with no operation is refused (`empty-edit`).
 * - **`<why>`:** required, one line within `whyCharacters`.
 * - **Each element's text** is trimmed, and held to its own bound. A frame
 *   longer than `frameCharacters` never reaches this: the reply reader drops
 *   it whole, unread.
 *
 * The target is only what the frame named: the host stages it to an
 * identity (D4). Whether the class allows an operation (prose takes no
 * rewrite; D5), and whether each quote stands exactly once, is the
 * gateway's, against the live text. Reasons, never text: no caller logs
 * what a field held.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isContextPathGroup } from '@shared/types/context';
import type {
  WorkshopFileEditOperation,
  WorkshopFileEditRequestedTarget
} from '@shared/types/messages/workshop/fileEdits';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { isSafeConfiguredResourcePath } from '@/utils/configuredResourcePath';
import {
  readWorkshopTrailerElements,
  type WorkshopTrailerElement,
  type WorkshopTrailerReadFault
} from '@/utils/workshopTrailerElements';

export const WORKSHOP_FILE_EDIT_TAG = 'prose-minion-file-edit';

const BUDGETS = PROMPT_BUDGETS.workshopFileEdits;

/** Every element the frame reads; `excerpt` alone may close itself. */
export const WORKSHOP_FILE_EDIT_ELEMENTS = [
  'group', 'path', 'excerpt', 'why', 'rewrite', 'find', 'replace-with', 'append', 'prepend'
] as const;

export const WORKSHOP_FILE_EDIT_FAULTS = [
  'repeated-element',
  'missing-target',
  'conflicting-target',
  'missing-group',
  'missing-path',
  'unknown-group',
  'invalid-path',
  'path-too-long',
  'excerpt-not-empty',
  'missing-why',
  'why-not-one-line',
  'why-too-long',
  'empty-edit',
  'unpaired-find',
  'empty-find',
  'too-many-replaces',
  'conflicting-operations',
  'rewrite-too-long',
  'find-too-long',
  'replace-with-too-long',
  'insert-too-long'
] as const;
export type WorkshopFileEditFault = typeof WORKSHOP_FILE_EDIT_FAULTS[number] | WorkshopTrailerReadFault;

/** The faults naming a file can raise. */
export type WorkshopFileEditTargetFault = Extract<WorkshopFileEditFault,
  'missing-target' | 'conflicting-target' | 'missing-group' | 'missing-path' | 'unknown-group' | 'invalid-path' | 'path-too-long' | 'excerpt-not-empty'>;

/** What a valid frame carries; staging adds the identity, class and baseline, and the host its state. */
export interface WorkshopFileEditDraft {
  readonly target: WorkshopFileEditRequestedTarget;
  readonly operations: readonly WorkshopFileEditOperation[];
  readonly why: string;
}

export type WorkshopFileEditDecode =
  | { readonly kind: 'edit'; readonly edit: WorkshopFileEditDraft }
  | { readonly kind: 'rejected'; readonly fault: WorkshopFileEditFault };

const ONCE: readonly string[] = ['group', 'path', 'excerpt', 'why', 'rewrite', 'append', 'prepend'];
const NOT_ONE_LINE = /[\p{Cc}\u2028\u2029]/u;

/** Decode a frame's inside (between its opening and closing tags). */
export function decodeWorkshopFileEdit(inner: string): WorkshopFileEditDecode {
  const read = readWorkshopTrailerElements(inner, { elements: WORKSHOP_FILE_EDIT_ELEMENTS, empty: ['excerpt'] });
  if (read.kind === 'fault') {
    return reject(read.fault);
  }
  const elements = read.elements;
  const seen = new Set<string>();
  for (const { name } of elements) {
    if (ONCE.includes(name) && seen.has(name)) {
      return reject('repeated-element');
    }
    seen.add(name);
  }
  const target = decodeWorkshopFileEditTarget(elements);
  if (typeof target === 'string') {
    return reject(target);
  }
  const why = elements.find((element) => element.name === 'why')?.content.trim() ?? '';
  const whyFault = !why
    ? 'missing-why'
    : NOT_ONE_LINE.test(why) ? 'why-not-one-line' : why.length > BUDGETS.whyCharacters ? 'why-too-long' : undefined;
  if (whyFault) {
    return reject(whyFault);
  }
  const operations = decodeOperations(elements);
  if (typeof operations === 'string') {
    return reject(operations);
  }
  return { kind: 'edit', edit: { target, operations, why } };
}

/**
 * The file a frame names, from its elements: `<excerpt/>` alone, or `<group>`
 * and `<path>` by `resource.read`'s rule. Shared with the edit-offer codec
 * (ADR 2026-11-10 D1), which names its file exactly as a file edit does.
 */
export function decodeWorkshopFileEditTarget(elements: readonly WorkshopTrailerElement[]): WorkshopFileEditRequestedTarget | WorkshopFileEditTargetFault {
  const group = elements.find((element) => element.name === 'group')?.content.trim();
  const path = elements.find((element) => element.name === 'path')?.content.trim();
  const excerpt = elements.find((element) => element.name === 'excerpt');
  if (excerpt) {
    if (group !== undefined || path !== undefined) {
      return 'conflicting-target';
    }
    return excerpt.content.trim() ? 'excerpt-not-empty' : { kind: 'excerpt' };
  }
  if (group === undefined && path === undefined) {
    return 'missing-target';
  }
  if (!group) {
    return 'missing-group';
  }
  if (!path) {
    return 'missing-path';
  }
  const fault = workshopFileEditResourceFault(group, path);
  return fault ?? (isContextPathGroup(group) ? { kind: 'resource', group, path } : 'unknown-group');
}

/** A resource target's group and path against `resource.read`'s rule, or the fault. */
export function workshopFileEditResourceFault(group: string, path: string): WorkshopFileEditTargetFault | undefined {
  if (!isContextPathGroup(group)) {
    return 'unknown-group';
  }
  if (path.length > PROMPT_BUDGETS.workshopResource.pathCharacters) {
    return 'path-too-long';
  }
  return isSafeConfiguredResourcePath(path) ? undefined : 'invalid-path';
}

function decodeOperations(elements: readonly WorkshopTrailerElement[]): WorkshopFileEditOperation[] | WorkshopFileEditFault {
  const operations: WorkshopFileEditOperation[] = [];
  for (let index = 0; index < elements.length; index += 1) {
    const { name, content } = elements[index];
    switch (name) {
      case 'replace-with':
        return 'unpaired-find';
      case 'rewrite':
      case 'append':
      case 'prepend':
        operations.push({ op: name, text: content.trim() });
        break;
      case 'find': {
        const next = elements[index + 1];
        if (next?.name !== 'replace-with') {
          return 'unpaired-find';
        }
        operations.push({ op: 'replace', find: content.trim(), with: next.content.trim() });
        index += 1;
        break;
      }
      default:
        // The target and the why, read above.
        break;
    }
  }
  return workshopFileEditOperationsFault(operations) ?? operations;
}

/**
 * Operations against the format's rules, or the first fault, in the order
 * written: the decoder's check, and the session codec's for a saved card.
 * A rewrite stands alone; at most `editReplaces` pairs; an append and a
 * prepend at most once each; every text but a replacement non-empty; each
 * within its bound.
 */
export function workshopFileEditOperationsFault(
  operations: readonly WorkshopFileEditOperation[]
): WorkshopFileEditFault | undefined {
  if (operations.length === 0) {
    return 'empty-edit';
  }
  let replaces = 0;
  const seen = new Set<string>();
  for (const operation of operations) {
    if (operation.op !== 'replace') {
      if (seen.has(operation.op)) {
        return 'repeated-element';
      }
      seen.add(operation.op);
    }
    if (operation.op === 'replace') {
      replaces += 1;
    }
    const fault = operationFault(operation, replaces);
    if (fault) {
      return fault;
    }
  }
  return seen.has('rewrite') && operations.length > 1 ? 'conflicting-operations' : undefined;
}

function operationFault(operation: WorkshopFileEditOperation, replaces: number): WorkshopFileEditFault | undefined {
  switch (operation.op) {
    case 'rewrite':
      return !operation.text ? 'empty-edit' : operation.text.length > BUDGETS.rewriteCharacters ? 'rewrite-too-long' : undefined;
    case 'append':
    case 'prepend':
      return !operation.text ? 'empty-edit' : operation.text.length > BUDGETS.insertCharacters ? 'insert-too-long' : undefined;
    case 'replace':
      if (replaces > BUDGETS.editReplaces) {
        return 'too-many-replaces';
      }
      if (!operation.find) {
        return 'empty-find';
      }
      if (operation.find.length > BUDGETS.findCharacters) {
        return 'find-too-long';
      }
      return operation.with.length > BUDGETS.replaceWithCharacters ? 'replace-with-too-long' : undefined;
  }
}

/** The shared planner's operations (ADR D3): one shape, so a card plans exactly as written. */
export function workshopFileEditTextOperations(operations: readonly WorkshopFileEditOperation[]): readonly TextEditOperation[] {
  return operations;
}

/**
 * Two targets that may name one file: the same group and the same path
 * ignoring letter case (the catalog lookup admits a unique case-folded
 * match), or both the excerpt. One reply edits a file at most once (D2).
 */
export function sameWorkshopFileEditTarget(left: WorkshopFileEditRequestedTarget, right: WorkshopFileEditRequestedTarget): boolean {
  return left.kind === 'excerpt' || right.kind === 'excerpt'
    ? left.kind === right.kind
    : left.group === right.group && left.path.toLowerCase() === right.path.toLowerCase();
}

function reject(fault: WorkshopFileEditFault): Extract<WorkshopFileEditDecode, { kind: 'rejected' }> {
  return { kind: 'rejected', fault };
}
