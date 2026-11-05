/**
 * The policy checks the planner does not make (ADR 2026-11-05 D5): a
 * prose passage's word bound and the rewrite ceiling. Pure.
 *
 * - **Passages.** An append or prepend adds at most `passageWords` words.
 * - **The rewrite ceiling.** Together, a plan's replaces may change at most
 *   `rewriteCeilingShare` of the characters of the paragraphs they touch
 *   (blank-line paragraphs, the Lightbox's and Draft Edit's rule). A
 *   replace's change is what differs between its quote and its replacement,
 *   past their common start and end. Past the ceiling, every replace is
 *   refused: the persona is rewriting the passage, not editing it.
 */

import type { FileEditOperationFault, FileEditTargetPolicy } from '@/domain/models/FileEdit';
import { splitBlankLineParagraphs } from '@/utils/blankLineParagraphs';
import type { PlannedTextOperation, TextEditOperation } from '@/utils/textEdits/textEditOperations';

export function fileEditPolicyFaults(
  text: string,
  operations: readonly TextEditOperation[],
  placed: readonly PlannedTextOperation[],
  policy: FileEditTargetPolicy
): Array<{ readonly index: number; readonly fault: FileEditOperationFault }> {
  const faults: Array<{ index: number; fault: FileEditOperationFault }> = [];
  if (policy.passageWords !== undefined) {
    operations.forEach((operation, index) => {
      if ((operation.op === 'append' || operation.op === 'prepend') && countWords(operation.text) > (policy.passageWords as number)) {
        faults.push({ index, fault: 'passage-too-long' });
      }
    });
  }
  if (policy.rewriteCeilingShare !== undefined) {
    const replaces = placed.filter((planned) => operations[planned.index]?.op === 'replace');
    if (replaces.length > 0 && rewriteShare(text, replaces) > policy.rewriteCeilingShare) {
      replaces.forEach(({ index }) => faults.push({ index, fault: 'over-rewrite-ceiling' }));
    }
  }
  return faults.sort((left, right) => left.index - right.index);
}

export function countWords(text: string): number {
  const words = text.trim().split(/\s+/u);
  return words[0] === '' ? 0 : words.length;
}

/** The changed characters of `replaces` over the characters of the paragraphs they touch. */
export function rewriteShare(text: string, replaces: readonly PlannedTextOperation[]): number {
  const paragraphs = splitBlankLineParagraphs(text);
  const touched = new Set<number>();
  let changed = 0;
  for (const replace of replaces) {
    paragraphs.forEach((paragraph, index) => {
      if (paragraph.start < replace.end && replace.start < paragraph.end) {
        touched.add(index);
      }
    });
    changed += changedCharacters(text.slice(replace.start, replace.end), replace.text);
  }
  const total = [...touched].reduce((sum, index) => sum + paragraphs[index].end - paragraphs[index].start, 0);
  // A replace touching no paragraph stands in white space: all of it is change.
  return total === 0 ? (changed > 0 ? 1 : 0) : changed / total;
}

function changedCharacters(before: string, after: string): number {
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
