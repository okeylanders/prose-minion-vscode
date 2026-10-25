/**
 * DraftEditApplier — the one door to `DocumentEditor.applyEdits` (ADR
 * 2026-10-21 D4, D10). It is model-free and knows no pass: what it checks
 * comes from the pass's policy row, never a branch on the pass.
 *
 * Given edits placed in the open document as it stands now:
 * 1. It refuses, and counts, an edit whose text is no longer its original,
 *    one inside a protected region of the live text, one that would change a
 *    line break (unless the policy allows it), and one overlapping an earlier
 *    edit. Edits that touch are joined into one, so every change the host
 *    makes belongs to exactly one of them.
 * 2. It asks the host once: one change, one undo step, reviewed or direct.
 * 3. It reads what landed from a watch begun at the edits' version, never
 *    from the host's answer (`reconcileEdits`): applied, still as it was, or
 *    unknown because the writer edited there meanwhile.
 * 4. A direct apply that found the document moved (the writer typed as it
 *    went out) follows its edits through the writer's edits and asks once
 *    more. A reviewed one never does: the writer was editing during review,
 *    and a second review would be a surprise.
 *
 * It returns the document as it stands after, with every change since the
 * edits' version, so the caller can move what it shows through them.
 */

import type {
  DocumentApplyOutcome,
  DocumentEditor,
  DocumentEditReview,
  DocumentSnapshot,
  DocumentTextChange,
  DocumentTextEdit,
  DocumentWatchResult
} from '@/platform/DocumentEditor';
import type { DraftEditPassPolicy, TextRange } from '@/domain/models/DraftEdit';
import { changesLineBreaks } from '@/utils/draftEdit/lineBreaks';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { reconcileEdits } from '@/utils/draftEdit/reconcileEdits';
import { shiftRanges } from '@/utils/draftEdit/shiftRanges';

/** One edit a caller asks for, in offsets of `DraftEditApplyRequest.document`. */
export interface DraftEditEdit extends TextRange {
  /** The caller's handle for it (an issue id). */
  readonly id: string;
  readonly original: string;
  readonly replacement: string;
  /** What it is, for the writer's review. */
  readonly label: string;
  readonly description?: string;
}

export interface DraftEditApplyRequest {
  /** The open document as it stands now: nothing awaited since it was read. */
  readonly document: DocumentSnapshot;
  readonly edits: readonly DraftEditEdit[];
  readonly review: DocumentEditReview;
  readonly policy: Pick<DraftEditPassPolicy, 'allowsNewlineChanges'>;
}

export type DraftEditRefusal = 'changed' | 'protected' | 'line-break' | 'overlapping';

/** The document after an apply, and every change it saw since the request's version. */
export interface DraftEditSettledDocument {
  readonly snapshot: DocumentSnapshot;
  readonly edits: ReadonlyArray<readonly DocumentTextChange[]>;
}

export interface DraftEditApplyResult {
  /**
   * The host's last answer. `nothing` when every edit was refused, so the
   * host was never asked; `changed` when the document had already moved.
   */
  readonly outcome: DocumentApplyOutcome['kind'] | 'nothing' | 'changed';
  readonly failure?: string;
  /** Edit ids that landed. */
  readonly applied: readonly string[];
  /** Edit ids still standing as they were (unticked, declined, refused by the host), at their place after. */
  readonly notApplied: ReadonlyArray<{ readonly id: string } & TextRange>;
  /** Edit ids whose text the writer changed meanwhile, or whose document closed. */
  readonly unknown: readonly string[];
  /** Edits refused before the host was asked, and why. */
  readonly refused: ReadonlyArray<{ readonly id: string; readonly reason: DraftEditRefusal }>;
  /** Absent when the document closed. */
  readonly settled?: DraftEditSettledDocument;
}

/** Edits that touch, joined: what the host is asked to make, and the edits it stands for. */
interface EditGroup extends TextRange {
  readonly members: readonly DraftEditEdit[];
  readonly original: string;
  readonly replacement: string;
}

export class DraftEditApplier {
  constructor(private readonly documents: DocumentEditor) {}

  async apply(request: DraftEditApplyRequest): Promise<DraftEditApplyResult> {
    const { document } = request;
    const refused: Array<{ id: string; reason: DraftEditRefusal }> = [];
    const accepted = this.check(request, refused);
    if (accepted.length === 0) {
      return { outcome: 'nothing', applied: [], notApplied: [], unknown: [], refused, settled: { snapshot: document, edits: [] } };
    }

    const initial = joinTouching(accepted);
    let groups = initial;
    let version = document.version;
    const history: Array<readonly DocumentTextChange[]> = [];
    for (let attempt = 1; ; attempt += 1) {
      const watch = this.documents.watch(document.uri, version);
      if (!watch) {
        return { outcome: 'changed', applied: [], notApplied: [], unknown: ids(groups), refused };
      }
      const outcome = await this.documents.applyEdits(document.uri, groups.map(toDocumentEdit), {
        expectedVersion: version,
        review: request.review
      });
      const settled = watch.settle();
      if (settled.kind === 'closed') {
        return { outcome: 'closed', applied: [], notApplied: [], unknown: ids(groups), refused };
      }
      history.push(...settled.edits);
      if (outcome.kind === 'stale' && request.review === 'direct' && attempt === 1 && settled.edits.length > 0) {
        // The writer typed as the edit went out: follow the edits through it, and ask once more.
        const followed = followGroups(groups, settled);
        if (followed.length > 0) {
          groups = followed;
          version = settled.snapshot.version;
          continue;
        }
      }
      // A retry's groups are the first's, followed: reconcile the first's through every change since.
      return reconcile(initial, outcome, settled.snapshot, history, refused);
    }
  }

  private check(request: DraftEditApplyRequest, refused: Array<{ id: string; reason: DraftEditRefusal }>): DraftEditEdit[] {
    const { document, policy } = request;
    const protectedRegions = findProtectedRegions(document.text, document.languageId);
    const accepted: DraftEditEdit[] = [];
    for (const edit of [...request.edits].sort((a, b) => a.start - b.start || a.end - b.end)) {
      const last = accepted[accepted.length - 1];
      const reason: DraftEditRefusal | undefined = document.text.slice(edit.start, edit.end) !== edit.original
        ? 'changed'
        : protectedRegions.some((range) => range.start < edit.end && edit.start < range.end)
          ? 'protected'
          : !policy.allowsNewlineChanges && changesLineBreaks(edit.original, edit.replacement)
            ? 'line-break'
            : last && edit.start < last.end
              ? 'overlapping'
              : undefined;
      if (reason) {
        refused.push({ id: edit.id, reason });
      } else {
        accepted.push(edit);
      }
    }
    return accepted;
  }
}

function reconcile(
  groups: readonly EditGroup[],
  outcome: DocumentApplyOutcome,
  snapshot: DocumentSnapshot,
  history: ReadonlyArray<readonly DocumentTextChange[]>,
  refused: ReadonlyArray<{ id: string; reason: DraftEditRefusal }>
): DraftEditApplyResult {
  const applied: string[] = [];
  const notApplied: Array<{ id: string } & TextRange> = [];
  const unknown: string[] = [];
  for (const landing of reconcileEdits(groups, history, snapshot.text)) {
    if (landing.landing === 'applied') {
      applied.push(...landing.edit.members.map((member) => member.id));
    } else if (landing.landing === 'not-applied') {
      notApplied.push(...placeMembers(landing.edit, landing.range));
    } else {
      unknown.push(...landing.edit.members.map((member) => member.id));
    }
  }
  return {
    outcome: outcome.kind,
    ...(outcome.kind === 'failed' ? { failure: outcome.message } : {}),
    applied,
    notApplied,
    unknown,
    refused,
    settled: { snapshot, edits: history }
  };
}

function ids(groups: readonly EditGroup[]): string[] {
  return groups.flatMap((group) => group.members.map((member) => member.id));
}

/** Join edits that touch (one ends where the next starts) into one group; `edits` are sorted and do not overlap. */
function joinTouching(edits: readonly DraftEditEdit[]): EditGroup[] {
  const groups: EditGroup[] = [];
  for (const edit of edits) {
    const last = groups[groups.length - 1];
    if (last && last.end === edit.start) {
      groups[groups.length - 1] = {
        start: last.start,
        end: edit.end,
        members: [...last.members, edit],
        original: last.original + edit.original,
        replacement: last.replacement + edit.replacement
      };
    } else {
      groups.push({ start: edit.start, end: edit.end, members: [edit], original: edit.original, replacement: edit.replacement });
    }
  }
  return groups;
}

function toDocumentEdit(group: EditGroup): DocumentTextEdit {
  const labels = [...new Set(group.members.map((member) => member.label))];
  const descriptions = group.members.map((member) => member.description).filter((text): text is string => text !== undefined);
  return {
    start: group.start,
    end: group.end,
    newText: group.replacement,
    label: labels.join(' · '),
    ...(descriptions.length > 0 ? { description: descriptions.join(' ') } : {})
  };
}

/** Groups moved through the writer's edits; one an edit touched is left out (its text is no longer the original). */
function followGroups(groups: readonly EditGroup[], settled: Extract<DocumentWatchResult, { kind: 'open' }>): EditGroup[] {
  return settled.edits
    .reduce<EditGroup[]>((current, changes) => shiftRanges(current, changes), [...groups])
    .filter((group) => settled.snapshot.text.slice(group.start, group.end) === group.original);
}

/** A group that did not land, split back into its members at their places after. */
function placeMembers(group: EditGroup, range: TextRange): Array<{ id: string } & TextRange> {
  let at = range.start;
  return group.members.map((member) => {
    const start = at;
    at += member.original.length;
    return { id: member.id, start, end: at };
  });
}
