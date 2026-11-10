/**
 * The rules the planner does not make (ADR 2026-11-05 D5, D6). Pure. The
 * gateway runs freshness and the ceiling on every attempt, against the live
 * text (D7.6).
 *
 * - **Freshness.** A rewrite is fresh while the live content's SHA-256 is the
 *   baseline's; a replace while each quote stands exactly once; an append or
 *   prepend always.
 * - **Insertions** (prose): each append or prepend at most `words` words
 *   (`/\S+/gu`) and `characters` characters.
 * - **Notes rewrites:** refused when the content holds protected syntax
 *   (links, images, code, HTML), so the writer's markup is never re-typed by
 *   a model, and past `rewriteFileBytes`.
 * - **The rewrite ceiling** (prose): `changed` is, summed over the replaces,
 *   the characters each changes past the common start and end of its quote
 *   and replacement; `touched` the characters of the distinct blank-line
 *   paragraphs any of them overlaps. Refused when `changed` passes both the
 *   floor and `share × touched`. Insertions are never counted.
 * - **An intent's policy** (ADR 2026-11-10 D6, `intentFaults`): for `fixes`,
 *   every operation is a replace, each changes at most `changedCharacters`
 *   on each side past the common start and end of its quote and replacement
 *   (`changedCharacters`, the ceiling's own measure), and none changes a
 *   line break. It reads only the operations, so staging runs it with no
 *   file text and the gateway on every attempt.
 */

import { FILE_EDIT_MORE_THAN_A_FIX, type FileEditClassPolicy, type FileEditIntentPolicy, type FileEditOperationFault } from '@/domain/models/FileEdit';
import type { FileEditBaseline } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { splitBlankLineParagraphs } from '@/utils/blankLineParagraphs';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { findExactlyOnce } from '@/utils/textEdits/findExactlyOnce';
import { textEditContentSpan } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation } from '@/utils/textEdits/textEditOperations';
import { fileEditBaseline, fileEditSkipLeading } from './fileEditIdentity';

export interface OperationFault {
  readonly index: number;
  readonly fault: FileEditOperationFault;
}

export function countWords(text: string): number {
  return text.match(/\S+/gu)?.length ?? 0;
}

/** Each operation not fresh against the live text (D6). */
export function freshnessFaults(text: string, fsPath: string, operations: readonly TextEditOperation[], baseline: FileEditBaseline): OperationFault[] {
  const faults: OperationFault[] = [];
  operations.forEach((operation, index) => {
    if (operation.op === 'rewrite') {
      const live = fileEditBaseline(text, fsPath);
      if (live.sha256 !== baseline.sha256 || live.length !== baseline.length) {
        faults.push({ index, fault: 'baseline-changed' });
      }
    } else if (operation.op === 'replace' && operation.find) {
      const where = findExactlyOnce(text, operation.find);
      if (!('start' in where)) {
        faults.push({ index, fault: where.count === 0 ? 'not-found' : 'ambiguous' });
      }
    }
  });
  return faults;
}

/** What the class policy refuses, by operation, before the ceiling. */
export function policyFaults(
  text: string,
  fsPath: string,
  languageId: string,
  operations: readonly TextEditOperation[],
  policy: FileEditClassPolicy
): OperationFault[] {
  const faults: OperationFault[] = [];
  operations.forEach((operation, index) => {
    if ((operation.op === 'append' || operation.op === 'prepend') && policy.insertion
      && (countWords(operation.text) > policy.insertion.words || operation.text.length > policy.insertion.characters)) {
      faults.push({ index, fault: 'insertion-too-long' });
    }
    if (operation.op === 'rewrite' && policy.allowsRewrite) {
      const span = textEditContentSpan(text, fileEditSkipLeading(text, fsPath));
      if (Buffer.byteLength(text.slice(span.start, span.end), 'utf8') > PROMPT_BUDGETS.workshopFileEdits.rewriteFileBytes) {
        faults.push({ index, fault: 'rewrite-too-large' });
      } else if (findProtectedRegions(text, languageId).some((region) => region.start < span.end && span.start < region.end)) {
        faults.push({ index, fault: 'rewrite-protected' });
      }
    }
  });
  return faults;
}

/**
 * The characters a replace changes: past the common start and end of its
 * quote and replacement, the longer side's.
 */
export function changedCharacters(before: string, after: string): number {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return Math.max(before.length, after.length) - prefix - suffix;
}

/** Whether a replace changes a line break: one stands in what differs between its quote and replacement. */
function changesLineBreak(before: string, after: string): boolean {
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < before.length - prefix && suffix < after.length - prefix
    && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return /[\r\n]/.test(before.slice(prefix, before.length - suffix) + after.slice(prefix, after.length - suffix));
}

/** What an intent's policy refuses, by operation (D6). Pure over the operations. */
export function intentFaults(operations: readonly TextEditOperation[], policy: FileEditIntentPolicy | undefined): OperationFault[] {
  if (!policy) {
    return [];
  }
  return operations.flatMap((operation, index) => {
    const breaks = !policy.operations.has(operation.op)
      || (operation.op === 'replace' && (
        changedCharacters(operation.find, operation.with) > policy.changedCharacters
        || (!policy.allowsNewlineChanges && changesLineBreak(operation.find, operation.with))));
    return breaks ? [{ index, fault: FILE_EDIT_MORE_THAN_A_FIX }] : [];
  });
}

/**
 * Whether replaces, as they now sit in `text`, pass the rewrite ceiling:
 * `changed` (summed over them) at most the floor, or at most `share` of the
 * characters of the distinct blank-line paragraphs their ranges overlap.
 */
export function passesRewriteCeiling(
  text: string,
  replaces: ReadonlyArray<{ readonly start: number; readonly end: number; readonly changed: number }>,
  ceiling: FileEditClassPolicy['ceiling']
): boolean {
  if (!ceiling) {
    return true;
  }
  const changed = replaces.reduce((sum, replace) => sum + replace.changed, 0);
  if (changed <= ceiling.floorCharacters) {
    return true;
  }
  const paragraphs = splitBlankLineParagraphs(text);
  const touched = new Set<number>();
  for (const replace of replaces) {
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.start < replace.end && replace.start < paragraph.end) {
        touched.add(index);
      }
    });
  }
  const touchedCharacters = [...touched].reduce((sum, index) => sum + paragraphs[index].end - paragraphs[index].start, 0);
  return changed <= ceiling.share * touchedCharacters;
}
