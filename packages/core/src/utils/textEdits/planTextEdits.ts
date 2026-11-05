/**
 * The one edit planner (ADR 2026-11-05 D3). Pure, feature-free. It takes a
 * text, its operations in the order written and the target's rules, and
 * returns ranges to change in the text as given, or every operation's fault.
 * It writes nothing: a memory note applies the plan with `applyTextEdits`, a
 * project file through Draft Edit's applier.
 *
 * - **Anchoring** is `findExactlyOnce`'s. Every quote is found in the text as
 *   given, never in text another operation wrote. A quote that is not there
 *   is `not-found`; one there more than once, or an empty one, `ambiguous`.
 *   A match that would split a surrogate pair is no match.
 * - **No two operations overlap.** Replaces whose quotes overlap, or a
 *   passage whose insertion point falls strictly inside a quote, are
 *   `overlapping`. Ranges that only touch are joined into one edit.
 * - **A rewrite stands alone**, and append and prepend come at most once
 *   each: anything else is `conflicting-operations`. A rewrite the rules do
 *   not allow is `not-allowed`.
 * - **The content** is the text after the rules' leading skip, without the
 *   whitespace around it: a rewrite replaces it, a prepend goes before it and
 *   an append after it, so a file keeps its front matter and its last line
 *   break. A passage is joined by the separator only when something stands
 *   on its other side once the replaces are made (a prepend and an append
 *   to empty content are joined to each other).
 */

import { findExactlyOnce } from '@/utils/textEdits/findExactlyOnce';
import type {
  PlannedTextEdit,
  PlannedTextOperation,
  TextEditFault,
  TextEditFaultKind,
  TextEditOperation,
  TextEditPlan,
  TextEditRules
} from '@/utils/textEdits/textEditOperations';

const BLANK_LINE = '\n\n';

interface Found {
  readonly index: number;
  readonly start: number;
  readonly end: number;
  readonly with: string;
}

export function planTextEdits(text: string, operations: readonly TextEditOperation[], rules: TextEditRules): TextEditPlan {
  const faults: TextEditFault[] = [];
  const fault = (index: number, kind: TextEditFaultKind) => faults.push({ index, fault: kind });
  const separator = rules.separator ?? BLANK_LINE;
  const content = contentSpan(text, rules.skipLeading ?? 0);

  const counts = { rewrite: 0, append: 0, prepend: 0, replace: 0 };
  operations.forEach((operation) => { counts[operation.op] += 1; });
  operations.forEach((operation, index) => {
    if (operation.op === 'rewrite' && !rules.allowsRewrite) {
      fault(index, 'not-allowed');
    }
    const alone = counts.rewrite > 0 && operations.length > 1;
    if (alone || ((operation.op === 'append' || operation.op === 'prepend') && counts[operation.op] > 1)) {
      fault(index, 'conflicting-operations');
    }
  });

  const found: Found[] = [];
  operations.forEach((operation, index) => {
    if (operation.op !== 'replace') {
      return;
    }
    const where = operation.find ? findExactlyOnce(text, operation.find) : { count: 2 as const };
    if ('start' in where && !splitsPair(text, where.start) && !splitsPair(text, where.start + operation.find.length)) {
      found.push({ index, start: where.start, end: where.start + operation.find.length, with: operation.with });
    } else {
      fault(index, 'start' in where || where.count === 0 ? 'not-found' : 'ambiguous');
    }
  });
  const sorted = [...found].sort((left, right) => left.start - right.start || left.index - right.index);
  let reach = -1;
  for (const stretch of sorted) {
    if (stretch.start < reach) {
      fault(stretch.index, 'overlapping');
    }
    reach = Math.max(reach, stretch.end);
  }

  const prepend = operations.findIndex((operation) => operation.op === 'prepend');
  const append = operations.findIndex((operation) => operation.op === 'append');
  for (const [index, at] of [[prepend, content.start], [append, content.end]] as const) {
    if (index >= 0 && found.some((stretch) => stretch.start < at && at < stretch.end)) {
      fault(index, 'overlapping');
    }
  }

  if (faults.length > 0) {
    return { kind: 'faulted', faults: faults.sort((left, right) => left.index - right.index) };
  }

  const placed: Array<PlannedTextOperation & { readonly rank: number }> = [];
  const filled = contentAfterReplaces(content, found);
  operations.forEach((operation, index) => {
    if (operation.op === 'rewrite') {
      placed.push({ index, start: content.start, end: content.end, text: operation.text, rank: 1 });
    } else if (operation.op === 'prepend') {
      placed.push({ index, start: content.start, end: content.start, text: `${operation.text}${filled ? separator : ''}`, rank: 0 });
    } else if (operation.op === 'append') {
      const joined = filled || prepend >= 0;
      placed.push({ index, start: content.end, end: content.end, text: `${joined ? separator : ''}${operation.text}`, rank: 2 });
    }
  });
  for (const stretch of found) {
    placed.push({ index: stretch.index, start: stretch.start, end: stretch.end, text: stretch.with, rank: 1 });
  }
  // By place; at one place an insertion before a quote, a prepend before an append.
  placed.sort((left, right) => left.start - right.start || left.end - right.end || left.rank - right.rank);

  return {
    kind: 'planned',
    edits: joinTouching(placed),
    operations: placed
      .map(({ index, start, end, text: written }) => ({ index, start, end, text: written }))
      .sort((left, right) => left.index - right.index)
  };
}

/** The text with the plan's edits made, from the last so each earlier start still holds. */
export function applyTextEdits(text: string, edits: ReadonlyArray<{ readonly start: number; readonly end: number; readonly text: string }>): string {
  let result = text;
  for (const edit of [...edits].sort((left, right) => right.start - left.start || right.end - left.end)) {
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  }
  return result;
}

/**
 * The content: after the leading skip, without the whitespace around it.
 * Content that is only whitespace is an empty span at the skip's end.
 */
function contentSpan(text: string, skipLeading: number): { readonly start: number; readonly end: number } {
  const from = Math.min(Math.max(0, Math.floor(skipLeading)), text.length);
  const region = text.slice(from);
  const trimmedEnd = region.trimEnd().length;
  if (trimmedEnd === 0) {
    return { start: from, end: from };
  }
  return { start: from + region.length - region.trimStart().length, end: from + trimmedEnd };
}

/** Whether anything stands in the content once the replaces inside it are made. */
function contentAfterReplaces(content: { readonly start: number; readonly end: number }, found: readonly Found[]): boolean {
  let covered = 0;
  for (const stretch of found) {
    const start = Math.max(stretch.start, content.start);
    const end = Math.min(stretch.end, content.end);
    if (start < end) {
      if (stretch.with) {
        return true;
      }
      covered += end - start;
    }
  }
  return covered < content.end - content.start;
}

/** Whether `at` falls between the two halves of a surrogate pair. */
function splitsPair(text: string, at: number): boolean {
  if (at <= 0 || at >= text.length) {
    return false;
  }
  const before = text.charCodeAt(at - 1);
  const after = text.charCodeAt(at);
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff;
}

function joinTouching(placed: readonly PlannedTextOperation[]): PlannedTextEdit[] {
  const edits: Array<{ start: number; end: number; text: string; operations: number[] }> = [];
  for (const operation of placed) {
    const last = edits[edits.length - 1];
    if (last && operation.start <= last.end) {
      last.text += operation.text;
      last.end = Math.max(last.end, operation.end);
      last.operations.push(operation.index);
    } else {
      edits.push({ start: operation.start, end: operation.end, text: operation.text, operations: [operation.index] });
    }
  }
  return edits;
}
