/**
 * What became of each edit a host was asked to make (ADR 2026-10-21 D4 step
 * 7). A host's "applied" never says which edits landed: the writer may tick
 * only some in review, and type meanwhile. So each edit is followed, by its
 * range, through every change the document saw since the edits were placed,
 * and then read where it stands. Nothing is searched for.
 *
 * - A change inside an edit's range, its edges included, is taken into it.
 *   That is where the host's own change lands, and VS Code may split one
 *   replacement into smaller ones inside it before applying it.
 * - A change wholly before it moves it; one wholly after it leaves it.
 * - A change across one of its edges breaks it: what stands there is no
 *   longer the edit's or the original's alone.
 *
 * Then: the replacement stands there → `applied`; the original → `not-applied`;
 * anything else, or a broken range → `unknown`.
 *
 * Edits must not overlap or touch: a change at a shared edge could belong to
 * either. The applier joins touching edits into one before asking.
 */

import type { TextRange } from '@/domain/models/DraftEdit';
import type { TextChange } from '@/utils/draftEdit/shiftRanges';

export interface ReconcilableEdit extends TextRange {
  readonly original: string;
  readonly replacement: string;
}

export type EditLanding<T extends ReconcilableEdit> =
  | { readonly edit: T; readonly landing: 'applied' | 'not-applied'; readonly range: TextRange }
  | { readonly edit: T; readonly landing: 'unknown' };

export function reconcileEdits<T extends ReconcilableEdit>(
  edits: readonly T[],
  events: ReadonlyArray<readonly TextChange[]>,
  liveText: string
): Array<EditLanding<T>> {
  const tracked = edits.map((edit) => ({ edit, start: edit.start, end: edit.end, broken: false }));
  for (const changes of events) {
    // An event's changes all refer to the text before it: apply them from the last, so none moves another's offset.
    for (const change of [...changes].sort((a, b) => b.offset - a.offset)) {
      const changeEnd = change.offset + change.length;
      const delta = change.text.length - change.length;
      for (const each of tracked) {
        if (each.broken) {
          continue;
        }
        if (change.offset >= each.start && changeEnd <= each.end) {
          each.end += delta;
        } else if (changeEnd <= each.start) {
          each.start += delta;
          each.end += delta;
        } else if (change.offset < each.end) {
          each.broken = true;
        }
      }
    }
  }
  return tracked.map(({ edit, start, end, broken }): EditLanding<T> => {
    if (broken) {
      return { edit, landing: 'unknown' };
    }
    const standing = liveText.slice(start, end);
    if (standing === edit.replacement) {
      return { edit, landing: 'applied', range: { start, end } };
    }
    if (standing === edit.original) {
      return { edit, landing: 'not-applied', range: { start, end } };
    }
    return { edit, landing: 'unknown' };
  });
}
