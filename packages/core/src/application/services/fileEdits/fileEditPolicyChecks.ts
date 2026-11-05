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
 * - **The rewrite ceiling** (prose): `replaced` is the UTF-16 characters the
 *   replace edits remove; `touched` the characters of the distinct blank-line
 *   paragraphs any of them overlaps. Refused when `replaced` passes the floor
 *   and `share × touched`. Insertions remove nothing, so they never count.
 */

import type { FileEditClassPolicy, FileEditOperationFault } from '@/domain/models/FileEdit';
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

/** Whether replace edits, as they now sit in `text`, pass the rewrite ceiling. */
export function passesRewriteCeiling(
  text: string,
  edits: ReadonlyArray<{ readonly start: number; readonly end: number; readonly original: string }>,
  ceiling: FileEditClassPolicy['ceiling']
): boolean {
  if (!ceiling) {
    return true;
  }
  const replaced = edits.reduce((sum, edit) => sum + edit.original.length, 0);
  if (replaced <= ceiling.floorCharacters) {
    return true;
  }
  const paragraphs = splitBlankLineParagraphs(text);
  const touched = new Set<number>();
  for (const edit of edits.filter((each) => each.original.length > 0)) {
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.start < edit.end && edit.start < paragraph.end) {
        touched.add(index);
      }
    });
  }
  const touchedCharacters = [...touched].reduce((sum, index) => sum + paragraphs[index].end - paragraphs[index].start, 0);
  return replaced <= ceiling.share * touchedCharacters;
}
