/**
 * An edit suggestion anchored against the note as it stands (epic Slice 6c;
 * ADR 2026-11-04 addendum of 2026-11-05). Pure. The model quotes; host code
 * finds each quote, never an offset a model gave.
 *
 * - **Exactly once.** A `find` must occur exactly once in its field of the
 *   note (occurrences counted overlapping, so `aa` is twice in `aaa`): none
 *   is `find-missing`, more is `find-ambiguous`. Every quote is found in the
 *   note as it stands, never in a field an earlier replace changed, and no
 *   two found stretches of one field may overlap (`replaces-overlap`).
 * - **Then applied**, rewrites, replaces, then prepend and append to the
 *   body, a blank line between passages.
 * - **The result** is held to the format's field rules (a replace can bring
 *   a line break into a summary, empty it, or take a body past its bound),
 *   and an edit that changes nothing is `unchanged`.
 *
 * The body is read trimmed, as the card and the sheet show it; the library
 * keeps a note's own bytes for an unchanged body.
 */

import type { WorkshopMemoryEditFields } from '@messages';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import type { WorkshopMemoryEditDraft } from '@/utils/workshopMemoryEditProtocol';
import { workshopMemoryFieldFault, type WorkshopMemoryFieldFault } from '@/utils/workshopMemoryProposalFields';

export type WorkshopMemoryEditAnchorFault =
  | 'find-missing'
  | 'find-ambiguous'
  | 'replaces-overlap'
  | 'summary-emptied'
  | 'unchanged'
  | WorkshopMemoryFieldFault;

export type WorkshopMemoryEditAnchoring =
  | { readonly kind: 'anchored'; readonly before: WorkshopMemoryEditFields; readonly after: WorkshopMemoryEditFields }
  | { readonly kind: 'refused'; readonly reason: WorkshopMemoryEditAnchorFault };

/**
 * Where `find` stands in `text`: its one start, or how many times it occurs
 * when that is not once (counting stops at two).
 */
export function findExactlyOnce(text: string, find: string): { readonly start: number } | { readonly count: 0 | 2 } {
  const first = text.indexOf(find);
  if (first < 0) {
    return { count: 0 };
  }
  return text.indexOf(find, first + 1) < 0 ? { start: first } : { count: 2 };
}

export function anchorWorkshopMemoryEdit(edit: WorkshopMemoryEditDraft, note: WorkshopMemoryEditFields): WorkshopMemoryEditAnchoring {
  const before: WorkshopMemoryEditFields = { title: note.title, kind: note.kind, summary: note.summary, body: note.body.trim() };
  const after = { ...before };
  const found: Record<'summary' | 'body', Array<{ start: number; end: number; with: string }>> = { summary: [], body: [] };
  for (const operation of edit.operations) {
    if (operation.op === 'rewrite') {
      if (operation.field === 'kind') {
        after.kind = operation.value as ProjectMemoryKind;
      } else {
        after[operation.field] = operation.value;
      }
    } else if (operation.op === 'replace') {
      const where = findExactlyOnce(before[operation.field], operation.find);
      if (!('start' in where)) {
        return refused(where.count === 0 ? 'find-missing' : 'find-ambiguous');
      }
      found[operation.field].push({ start: where.start, end: where.start + operation.find.length, with: operation.with });
    }
  }
  for (const field of ['summary', 'body'] as const) {
    const stretches = found[field].sort((left, right) => left.start - right.start);
    if (stretches.some((stretch, index) => index > 0 && stretch.start < stretches[index - 1].end)) {
      return refused('replaces-overlap');
    }
    // Applied from the last, so each earlier start still holds.
    for (const stretch of [...stretches].reverse()) {
      after[field] = `${after[field].slice(0, stretch.start)}${stretch.with}${after[field].slice(stretch.end)}`;
    }
  }
  for (const operation of edit.operations) {
    if (operation.op === 'prepend') {
      after.body = joinPassages(operation.text, after.body);
    } else if (operation.op === 'append') {
      after.body = joinPassages(after.body, operation.text);
    }
  }
  after.summary = after.summary.trim();
  after.body = after.body.trim();
  const fault = workshopMemoryFieldFault('summary', after.summary) ?? workshopMemoryFieldFault('body', after.body);
  if (fault) {
    return refused(fault);
  }
  if (!after.summary) {
    return refused('summary-emptied');
  }
  const unchanged = (['title', 'kind', 'summary', 'body'] as const).every((field) => after[field] === before[field]);
  return unchanged ? refused('unchanged') : { kind: 'anchored', before, after };
}

function joinPassages(first: string, second: string): string {
  return first && second ? `${first}\n\n${second}` : first || second;
}

function refused(reason: WorkshopMemoryEditAnchorFault): WorkshopMemoryEditAnchoring {
  return { kind: 'refused', reason };
}
