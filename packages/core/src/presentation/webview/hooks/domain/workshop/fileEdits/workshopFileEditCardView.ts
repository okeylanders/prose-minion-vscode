/**
 * A file-edit card as drawn (ADR 2026-11-05 D8, D9; epic Slice 4b): pure
 * reads of the card the host's snapshot holds. Nothing here decides a
 * state; it only says what the host's state is, in the host's words
 * (`workshopFileEditCardWords`), and which actions a state offers.
 *
 * - **Actions only while `pending`** (D8: no blind retry). Every other state
 *   offers nothing.
 * - **The display path only.** A card names its file by `relativePath` (or
 *   what the frame named); the view never reads `documentUri`.
 */

import {
  workshopFileEditDisplayPath,
  type WorkshopFileEditClass,
  type WorkshopFileEditOperation,
  type WorkshopFileEditOperationOutcome,
  type WorkshopFileEditProposal
} from '@messages';
import { workshopFileEditCardWords } from '@shared/constants/workshopFileEditWords';
import { workshopFileEditWordDiff, type WorkshopFileEditDiffSegment } from '@utils/workshop/workshopFileEditWordDiff';

/** A card's key in the hook's busy, feedback and preview state: its turn and its index there. */
export function workshopFileEditCardKey(turnId: string, index: number): string {
  return `${turnId}#${index}`;
}

/** What a card's class reads as (D9): prose is a chapter, notes a note. */
export const WORKSHOP_FILE_EDIT_CLASS_LABELS: Readonly<Record<WorkshopFileEditClass, string>> = Object.freeze({
  prose: 'chapter',
  notes: 'note'
});

/** One operation's outcome on a settled card. */
export const WORKSHOP_FILE_EDIT_OUTCOME_LABELS: Readonly<Record<WorkshopFileEditOperationOutcome, string>> = Object.freeze({
  landed: 'Applied',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- outcome ids are kebab-case format literals.
  'not-applied': 'Not applied',
  unknown: 'Not known'
});

export type WorkshopFileEditOperationView =
  | { readonly kind: 'replace'; readonly segments: readonly WorkshopFileEditDiffSegment[]; readonly outcome?: WorkshopFileEditOperationOutcome }
  | { readonly kind: 'append' | 'prepend'; readonly text: string; readonly outcome?: WorkshopFileEditOperationOutcome }
  | { readonly kind: 'rewrite'; readonly text: string; readonly outcome?: WorkshopFileEditOperationOutcome; readonly landed?: { readonly before: string; readonly after: string } };

export interface WorkshopFileEditCardView {
  readonly path: string;
  /** "chapter" or "note"; absent on a card refused at staging. */
  readonly classLabel?: string;
  readonly why: string;
  /** The host's words for the card's state and reason. */
  readonly words: string;
  /** Apply, Review in editor… and Decline: only while `pending`. */
  readonly actionable: boolean;
  /** "1 of 2 changes applied." on a settled card with several operations. */
  readonly tally?: string;
  readonly operations: readonly WorkshopFileEditOperationView[];
}

export function workshopFileEditCardView(proposal: WorkshopFileEditProposal): WorkshopFileEditCardView {
  const outcomes = proposal.outcomes ?? [];
  const landed = outcomes.filter((outcome) => outcome === 'landed').length;
  const tally = outcomes.length > 1 || proposal.state === 'partial'
    ? `${landed} of ${outcomes.length} ${outcomes.length === 1 ? 'change' : 'changes'} applied.`
    : undefined;
  return {
    path: workshopFileEditDisplayPath(proposal),
    ...(proposal.class ? { classLabel: WORKSHOP_FILE_EDIT_CLASS_LABELS[proposal.class] } : {}),
    why: proposal.why,
    words: workshopFileEditCardWords(proposal.state, proposal.reason),
    actionable: proposal.state === 'pending',
    ...(tally && outcomes.length > 0 ? { tally } : {}),
    operations: proposal.operations.map((operation, at) => operationView(proposal, operation, at, outcomes[at]))
  };
}

function operationView(
  proposal: WorkshopFileEditProposal,
  operation: WorkshopFileEditOperation,
  at: number,
  outcome: WorkshopFileEditOperationOutcome | undefined
): WorkshopFileEditOperationView {
  const settled = outcome ? { outcome } : {};
  switch (operation.op) {
    case 'replace':
      return { kind: 'replace', segments: workshopFileEditWordDiff(operation.find, operation.with), ...settled };
    case 'append':
    case 'prepend':
      return { kind: operation.op, text: operation.text, ...settled };
    case 'rewrite': {
      // What a landed rewrite replaced, when its record kept the text (D10).
      const record = proposal.landed?.find((each) => each.operation === at);
      const kept = record && 'before' in record ? { landed: { before: record.before, after: record.after } } : {};
      return { kind: 'rewrite', text: operation.text, ...settled, ...kept };
    }
  }
}

/** How many of a turn's cards a stack heads: "2 suggested edits". */
export function workshopFileEditStackLabel(count: number): string {
  return count === 1 ? '1 suggested edit' : `${count} suggested edits`;
}
