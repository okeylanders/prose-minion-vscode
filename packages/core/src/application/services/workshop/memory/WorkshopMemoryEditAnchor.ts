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
 * - **Planned by the shared planner** (`utils/textEdits/`, ADR 2026-11-05
 *   D3): summary and body are each one text it plans; title and kind are
 *   set whole.
 * - **The result** is held to the format's field rules (a replace can bring
 *   a line break into a summary, empty it, or take a body past its bound),
 *   and an edit that changes nothing is `unchanged`.
 *
 * The body is read trimmed, as the card and the sheet show it; the library
 * keeps a note's own bytes for an unchanged body.
 */

import type { WorkshopMemoryEditFields } from '@messages';
import type { ProjectMemoryKind } from '@shared/types/projectMemory';
import type { WorkshopMemoryEditDraft, WorkshopMemoryEditOperation } from '@/utils/workshopMemoryEditProtocol';
import { workshopMemoryFieldFault, type WorkshopMemoryFieldFault } from '@/utils/workshopMemoryProposalFields';
import { applyTextEdits, planTextEdits } from '@/utils/textEdits/planTextEdits';
import type { TextEditOperation, TextEditRules } from '@/utils/textEdits/textEditOperations';

export type WorkshopMemoryEditAnchorFault =
  | 'find-missing'
  | 'find-ambiguous'
  | 'replaces-overlap'
  // The decoder refuses these first; kept so the planner's every fault has a name.
  | 'conflicting-operations'
  | 'summary-emptied'
  | 'unchanged'
  | WorkshopMemoryFieldFault;

export type WorkshopMemoryEditAnchoring =
  | { readonly kind: 'anchored'; readonly before: WorkshopMemoryEditFields; readonly after: WorkshopMemoryEditFields }
  | { readonly kind: 'refused'; readonly reason: WorkshopMemoryEditAnchorFault };

/** The shared anchoring rule (ADR 2026-11-05 D3), where memory edits first had it. */
export { findExactlyOnce } from '@/utils/textEdits/findExactlyOnce';

const FIELD_RULES: TextEditRules = { allowsRewrite: true };

export function anchorWorkshopMemoryEdit(edit: WorkshopMemoryEditDraft, note: WorkshopMemoryEditFields): WorkshopMemoryEditAnchoring {
  const before: WorkshopMemoryEditFields = { title: note.title, kind: note.kind, summary: note.summary, body: note.body.trim() };
  const after = { ...before };
  // Each text field's operations, with each one's index in the edit.
  const fields: Record<'summary' | 'body', { operations: TextEditOperation[]; indexes: number[] }> = {
    summary: { operations: [], indexes: [] },
    body: { operations: [], indexes: [] }
  };
  edit.operations.forEach((operation, index) => {
    if (operation.op === 'rewrite' && operation.field === 'kind') {
      after.kind = operation.value as ProjectMemoryKind;
    } else if (operation.op === 'rewrite' && operation.field === 'title') {
      after.title = operation.value;
    } else {
      const [field, planned] = textOperationOf(operation);
      fields[field].operations.push(planned);
      fields[field].indexes.push(index);
    }
  });
  const plans = (['summary', 'body'] as const).map((field) => ({ field, plan: planTextEdits(before[field], fields[field].operations, FIELD_RULES) }));
  const faults = plans.flatMap(({ field, plan }) => plan.kind === 'faulted'
    ? plan.faults.map(({ index, fault }) => ({ index: fields[field].indexes[index], fault }))
    : []);
  // A quote not found exactly once, in the order written, before any overlap.
  const unfound = faults.filter(({ fault }) => fault === 'not-found' || fault === 'ambiguous').sort((left, right) => left.index - right.index)[0];
  if (unfound) {
    return refused(unfound.fault === 'not-found' ? 'find-missing' : 'find-ambiguous');
  }
  if (faults.some(({ fault }) => fault === 'overlapping')) {
    return refused('replaces-overlap');
  }
  if (faults.length > 0) {
    return refused('conflicting-operations');
  }
  for (const { field, plan } of plans) {
    if (plan.kind === 'planned' && plan.edits.length > 0) {
      after[field] = applyTextEdits(before[field], plan.edits);
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

/** A summary or body operation, as the planner takes it, and the field it plans against. */
function textOperationOf(operation: WorkshopMemoryEditOperation): ['summary' | 'body', TextEditOperation] {
  if (operation.op === 'rewrite') {
    return [operation.field === 'summary' ? 'summary' : 'body', { op: 'rewrite', text: operation.value }];
  }
  if (operation.op === 'replace') {
    return [operation.field, { op: 'replace', find: operation.find, with: operation.with }];
  }
  return ['body', { op: operation.op, text: operation.text }];
}

function refused(reason: WorkshopMemoryEditAnchorFault): WorkshopMemoryEditAnchoring {
  return { kind: 'refused', reason };
}
