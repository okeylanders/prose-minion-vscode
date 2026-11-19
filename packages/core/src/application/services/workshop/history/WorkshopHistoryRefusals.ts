/**
 * Why a `history.diff` is refused before or without git, in host words
 * (ADR 2026-11-19 D13, D14). Pure. The reason is a closed word the log and
 * the card's metadata carry; the words name the field, never its value.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export type WorkshopHistoryDiffRefusal =
  | 'ambiguous-commit'
  | 'commit-not-in-history'
  | 'same-commit'
  | 'commit-order'
  | 'diff-source-too-large';

export function workshopHistoryDiffRefusal(reason: WorkshopHistoryDiffRefusal, field: 'from' | 'to'): string {
  switch (reason) {
    case 'ambiguous-commit':
      return `The id in <${field}> starts more than one commit in this file's history. Copy the id exactly as history.log shows it.`;
    case 'commit-not-in-history':
      return `The id in <${field}> is not a commit in this file's history. Take ids from history.log for this file, exactly as it shows them.`;
    case 'same-commit':
      return '<from> and <to> name the same commit, so there is nothing to compare.';
    case 'commit-order':
      return '<from> must be older than <to>: history.log lists the newest first, so <from> is the one lower in the list.';
    case 'diff-source-too-large': {
      const mib = PROMPT_BUDGETS.workshopHistory.diffSourceBytes / (1024 * 1024);
      return `The version named in <${field}> is larger than ${mib.toLocaleString('en-US')} MiB, the most a diff compares.`;
    }
    default:
      return assertNever(reason);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history refusal: ${String(value)}`);
}
