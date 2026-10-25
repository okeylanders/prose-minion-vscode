/**
 * DraftEditApplier — the one door to `DocumentEditor.applyEdits` (ADR
 * 2026-10-21 D4, D10). It is model-free and knows no pass: what it checks
 * comes from the pass's policy row, never a branch on the pass.
 *
 * Given edits placed in the open document as it stands now:
 * 1. It refuses, and counts, an edit whose text is no longer its original,
 *    one inside a protected region of the live text, one that would change a
 *    line break, one overlapping an earlier edit, and edits that would change
 *    the document's Markdown structure (unless the policy allows either;
 *    `editsChangingStructure`, PR #172 F-03). Edits that touch are joined
 *    into one, so every change the host makes belongs to exactly one of them.
 * 2. It asks the host once: one change, one undo step, reviewed or direct.
 * 3. It reads what landed from a watch begun at the edits' version, never
 *    from the host's answer (`reconcileEdits`): applied, still as it was, or
 *    unknown because the writer edited there meanwhile. The host's changes
 *    may be smaller than the edits, or one change spanning a thousand of
 *    them (PR #172 F-04); both read back as the edits they are.
 * 4. A direct apply that found the document moved (the writer typed as it
 *    went out) follows its edits through the writer's edits, checks every
 *    one again against the document as it now stands (it may now be in
 *    code: PR #172 F-01), and asks once more. A reviewed one never does: the
 *    writer was editing during review, and a second review would be a
 *    surprise.
 *
 * It returns the document as it stands after, with every change since the
 * edits' version (each host change that reads as these edits given as
 * exactly those edits), so the caller can move what it shows through them.
 */

import type {
  DocumentApplyOutcome,
  DocumentEditor,
  DocumentEditReview,
  DocumentSnapshot,
  DocumentTextChange,
  DocumentTextEdit
} from '@/platform/DocumentEditor';
import type { DraftEditPassPolicy, TextRange } from '@/domain/models/DraftEdit';
import { changesLineBreaks } from '@/utils/draftEdit/lineBreaks';
import { editsChangingStructure } from '@/utils/draftEdit/markdownStructure';
import { findProtectedRegions } from '@/utils/draftEdit/protectedRegions';
import { reconcileEdits } from '@/utils/draftEdit/reconcileEdits';

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
  readonly policy: Pick<DraftEditPassPolicy, 'allowsNewlineChanges' | 'preservesMarkdownStructure'>;
}

export type DraftEditRefusal = 'changed' | 'protected' | 'line-break' | 'overlapping' | 'markup';

/**
 * The document after an apply, and every change it saw since the request's
 * version, each host change that reads as the request's edits given as
 * exactly those edits.
 */
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
    const refused: Array<{ id: string; reason: DraftEditRefusal }> = [];
    let document = request.document;
    let members = check(document, request.edits, request.policy, refused);
    if (members.length === 0) {
      return { outcome: 'nothing', applied: [], notApplied: [], unknown: [], refused, settled: { snapshot: document, edits: [] } };
    }

    const applied: string[] = [];
    const unknown: string[] = [];
    const history: Array<readonly DocumentTextChange[]> = [];
    for (let attempt = 1; ; attempt += 1) {
      const groups = joinTouching(members);
      const watch = this.documents.watch(document.uri, document.version);
      if (!watch) {
        return { outcome: 'changed', applied, notApplied: [], unknown: [...unknown, ...ids(groups)], refused };
      }
      const outcome = await this.documents.applyEdits(document.uri, groups.map(toDocumentEdit), {
        expectedVersion: document.version,
        review: request.review
      });
      const settled = watch.settle();
      if (settled.kind === 'closed') {
        return { outcome: 'closed', applied, notApplied: [], unknown: [...unknown, ...ids(groups)], refused };
      }
      const read = reconcileEdits(groups, document.text, settled.edits);
      history.push(...read.events);
      const standing: DraftEditEdit[] = [];
      for (const landing of read.landings) {
        if (landing.landing === 'applied') {
          applied.push(...landing.edit.members.map((member) => member.id));
        } else if (landing.landing === 'unknown') {
          unknown.push(...landing.edit.members.map((member) => member.id));
        } else {
          standing.push(...placeMembers(landing.edit, landing.range));
        }
      }
      if (outcome.kind === 'stale' && request.review === 'direct' && attempt === 1 && settled.edits.length > 0 && standing.length > 0) {
        // The writer typed as the edit went out. What still stands is checked again, every rule, against the document as it is now.
        document = settled.snapshot;
        members = check(document, standing, request.policy, refused);
        if (members.length > 0) {
          continue;
        }
        return result(outcome, applied, [], unknown, refused, settled.snapshot, history);
      }
      return result(outcome, applied, standing, unknown, refused, settled.snapshot, history);
    }
  }
}

/** The edits that may be asked for in `document`; the rest are refused, each with its reason. */
function check(
  document: DocumentSnapshot,
  edits: readonly DraftEditEdit[],
  policy: DraftEditApplyRequest['policy'],
  refused: Array<{ id: string; reason: DraftEditRefusal }>
): DraftEditEdit[] {
  const protectedRegions = findProtectedRegions(document.text, document.languageId);
  const accepted: DraftEditEdit[] = [];
  for (const edit of [...edits].sort((a, b) => a.start - b.start || a.end - b.end)) {
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
  if (!policy.preservesMarkdownStructure) {
    return accepted;
  }
  // Together, as they would land: two edits can make structure neither makes alone.
  const unsafe = editsChangingStructure(document.text, document.languageId, accepted);
  accepted.filter((_, index) => unsafe.has(index)).forEach((edit) => refused.push({ id: edit.id, reason: 'markup' }));
  return accepted.filter((_, index) => !unsafe.has(index));
}

function result(
  outcome: DocumentApplyOutcome,
  applied: readonly string[],
  standing: readonly DraftEditEdit[],
  unknown: readonly string[],
  refused: ReadonlyArray<{ id: string; reason: DraftEditRefusal }>,
  snapshot: DocumentSnapshot,
  history: ReadonlyArray<readonly DocumentTextChange[]>
): DraftEditApplyResult {
  return {
    outcome: outcome.kind,
    ...(outcome.kind === 'failed' ? { failure: outcome.message } : {}),
    applied,
    notApplied: standing.map(({ id, start, end }) => ({ id, start, end })),
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

/** A group still standing as it was, split back into its members at their places now. */
function placeMembers(group: EditGroup, range: TextRange): DraftEditEdit[] {
  let at = range.start;
  return group.members.map((member) => {
    const start = at;
    at += member.original.length;
    return { ...member, start, end: at };
  });
}
