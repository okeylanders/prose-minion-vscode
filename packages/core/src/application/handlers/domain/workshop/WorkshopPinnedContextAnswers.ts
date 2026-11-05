/**
 * The Pinned context tab's answers in words and shapes (Pinned Context
 * Slice 3): the list payload built from the library's description, and
 * Attach missing's result line. Pure; `WorkshopPinnedContextHandler` posts
 * them.
 */

import type { WorkshopPinnedContextDescription } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';
import type { WorkshopPinnedContextPayload } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const NOTHING_MISSING = 'Every pinned file is already in this conversation.';

/** A pinned file Attach missing left out, and why (PR #210 F06). */
export interface WorkshopPinnedAttachLeftOut {
  readonly label: string;
  readonly reason: 'missing' | 'unreadable' | 'over-budget';
}

/** The answer's list, from the library's description. Pure. */
export function workshopPinnedContextPayloadOf(
  description: WorkshopPinnedContextDescription,
  platform: WorkshopPinnedContextPayload['platform'],
  requestId: string | null
): WorkshopPinnedContextPayload {
  const totals = (files: number, words: number) => ({
    words,
    budgetWords: PROMPT_BUDGETS.contextAttachments.words,
    files,
    maxFiles: PROMPT_BUDGETS.workshopPinnedContext.files
  });
  const base = { requestId, platform, entries: [], totals: totals(0, 0), revision: null };
  switch (description.state) {
    case 'listed':
      return {
        ...base,
        availability: { available: true },
        file: { state: description.absent ? 'absent' : 'ok' },
        revision: description.revision,
        entries: description.rows.map((row) => ({
          path: row.path,
          label: row.label,
          ...(row.source?.kind === 'catalog' ? { group: row.source.group } : {}),
          ...(row.state === 'ready' || row.state === 'head-sliced' ? { words: row.words } : {}),
          state: row.state,
          ...(row.stateWords ? { stateWords: row.stateWords } : {}),
          ...(row.state === 'head-sliced' && row.totalWords !== undefined
            ? { truncation: { keptWords: row.words, totalWords: row.totalWords } }
            : {})
        })),
        totals: totals(description.rows.length, description.words)
      };
    case 'unreadable':
      return { ...base, availability: { available: true }, file: { state: 'unreadable', words: description.words } };
    case 'unavailable':
      // The folder changed under the read (PR #208 F01): the list is there, just not readable this moment.
      return description.reason === 'workspace-changed'
        ? { ...base, availability: { available: true }, file: { state: 'io', words: description.words } }
        : { ...base, availability: { available: false, reason: description.reason, words: description.words }, file: { state: 'absent' } };
    case 'busy':
    case 'io':
      return { ...base, availability: { available: true }, file: { state: description.state, words: description.words } };
  }
}

export function workshopPinnedAttachResultWords(attached: readonly string[], leftOut: readonly WorkshopPinnedAttachLeftOut[]): string {
  if (attached.length === 0 && leftOut.length === 0) {
    return NOTHING_MISSING;
  }
  const files = (count: number) => `${count} pinned ${count === 1 ? 'file' : 'files'}`;
  const reason = (why: WorkshopPinnedAttachLeftOut['reason']): string => {
    switch (why) {
      case 'missing':
        return 'not found';
      case 'unreadable':
        return 'couldn’t be read';
      case 'over-budget':
        return `doesn’t fit in the ${PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US')}-word context limit`;
    }
  };
  const left = leftOut.length > 0
    ? ` Not attached: ${leftOut.map((entry) => `${entry.label} (${reason(entry.reason)})`).join(', ')}.`
    : '';
  return attached.length > 0
    ? `Attached ${files(attached.length)} to this conversation.${left}`
    : `Nothing was attached.${left}`;
}
