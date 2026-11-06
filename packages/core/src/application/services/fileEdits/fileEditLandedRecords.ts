/**
 * The `landed` records of an Apply (ADR 2026-11-05 D10, N-01). Pure.
 *
 * For each landed operation: the text it replaced and the text it wrote, as
 * the plan placed them in the text the apply was planned against, and up to
 * `landedContextCharacters` on each side of the written text in that text
 * with every landed edit made, which anchors a deletion. Past
 * `revertCharacters` (either side), or with no version after, only the two
 * hashes are kept, and the operation is not revertible.
 *
 * The context is the planned text after, not a reading of the live buffer:
 * when the writer typed beside the edit as it went out (the applier's direct
 * retry), it may not stand there. A future Revert refuses when a record's
 * `after` and its context do not stand exactly once (D12), so a context the
 * writer moved only makes Revert refuse.
 */

import { createHash } from 'crypto';
import type { FileEditLandedRecord } from '@/domain/models/FileEdit';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { PlannedTextEdit, PlannedTextOperation } from '@/utils/textEdits/textEditOperations';

const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

export function fileEditLandedRecords(
  text: string,
  edits: readonly PlannedTextEdit[],
  operations: readonly PlannedTextOperation[],
  landed: ReadonlySet<number>,
  versionAfter: number | undefined
): FileEditLandedRecord[] {
  // Where each landed operation's text stands after: edits in order, each one's members written in turn.
  const placedAfter = new Map<number, number>();
  const madeEdits: PlannedTextEdit[] = [];
  let shift = 0;
  for (const edit of edits) {
    if (!edit.operations.every((index) => landed.has(index))) {
      continue;
    }
    let cursor = edit.start + shift;
    for (const index of edit.operations) {
      placedAfter.set(index, cursor);
      cursor += operations.find((operation) => operation.index === index)?.text.length ?? 0;
    }
    madeEdits.push(edit);
    shift += edit.text.length - (edit.end - edit.start);
  }
  const after = applyInOrder(text, madeEdits);
  return operations
    .filter((operation) => placedAfter.has(operation.index))
    .sort((left, right) => left.index - right.index)
    .map((operation): FileEditLandedRecord => {
      const before = text.slice(operation.start, operation.end);
      const written = operation.text;
      if (versionAfter === undefined || before.length > BOUNDS.revertCharacters || written.length > BOUNDS.revertCharacters) {
        return { operation: operation.index, beforeSha256: sha256(before), afterSha256: sha256(written) };
      }
      const start = placedAfter.get(operation.index) as number;
      const end = start + written.length;
      return {
        operation: operation.index,
        before,
        after: written,
        contextBefore: after.slice(Math.max(0, start - BOUNDS.landedContextCharacters), start),
        contextAfter: after.slice(end, end + BOUNDS.landedContextCharacters),
        versionAfter
      };
    });
}

function applyInOrder(text: string, edits: readonly PlannedTextEdit[]): string {
  let result = text;
  for (const edit of [...edits].reverse()) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
