/**
 * Pinned context's states in the writer's words, as ADR 2026-11-04 D8 and
 * Slice 0d's boards draw them. Pure; the library and its tests read these,
 * and Slice 3's tab shows them.
 */

import type { WorkshopPinnedContextUnavailableReason } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import type { WorkshopPinnedFileFault } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PINNED_CONTEXT_FILES, type WorkshopPinnedContextRefusal } from '@shared/types/workshopPinnedContext';

function sizeWords(bytes: number): string {
  const mib = bytes / (1024 * 1024);
  return mib >= 1 ? `${Number.isInteger(mib) ? mib : mib.toFixed(1)} MiB` : `${Math.round(bytes / 1024)} KiB`;
}

/** Why a pinned file can't be read, after "Can't read: ". */
export function workshopPinnedFileFaultWords(fault: WorkshopPinnedFileFault): string {
  switch (fault) {
    case 'not-a-file':
      return 'it isn’t a file.';
    case 'too-large':
      return `it’s larger than ${sizeWords(PROMPT_BUDGETS.contextAttachments.fileBytes)}.`;
    case 'empty':
      return 'it’s empty.';
    case 'refused':
      return 'it’s outside this project, or reached through a link.';
    case 'read-failed':
      return 'the file couldn’t be read.';
  }
}

/** The unreadable-list notice: "pinned-context.json can't be read. <reason> Nothing is attached …". */
export function workshopPinnedListRefusalWords(
  refusal: WorkshopPinnedContextRefusal,
  entry: number | undefined,
  fileBytes: number
): string {
  const which = entry === undefined ? '' : ` (entry ${entry + 1})`;
  const reason = ((): string => {
    switch (refusal) {
      case 'json':
        return 'It isn’t valid JSON.';
      case 'format':
        return 'It isn’t a format 1 pinned-context list.';
      case 'unknown-key':
        return `It has a key format 1 doesn’t define${which}.`;
      case 'path':
        return `A path isn’t a project-relative path${which}.`;
      case 'duplicate':
        return `It names one file twice${which}.`;
      case 'too-many':
        return `It lists more than ${WORKSHOP_PINNED_CONTEXT_FILES} files.`;
      case 'too-large':
        return `It’s larger than ${sizeWords(fileBytes)}.`;
    }
  })();
  return `pinned-context.json can’t be read. ${reason} Nothing is attached from it until it’s fixed. Fix it in the editor.`;
}

/** The unavailable notice, as the Memory tab's. */
export function workshopPinnedListUnavailableWords(reason: WorkshopPinnedContextUnavailableReason): string {
  const why = reason === 'no-workspace'
    ? 'No folder is open, so there’s no project to pin files in. Open a single folder to use pinned context.'
    : 'This workspace has several folders, so pinned context can’t tell which project it belongs to.';
  return `Pinned context isn’t available here. ${why}`;
}

const BUDGET_WORDS = PROMPT_BUDGETS.contextAttachments.words.toLocaleString('en-US');

/** "about 104,000": hundreds from a thousand up, as the result line rounds. */
function aboutWords(words: number): string {
  const step = words >= 1000 ? 100 : 10;
  const rounded = Math.round(words / step) * step;
  return `about ${(rounded > 0 ? rounded : words).toLocaleString('en-US')}`;
}

/**
 * The tab's own lines (Slice 3). The refusals are 0d's, and `busy` and `io`
 * are Slice 2b's words for states 0d doesn't draw.
 */
export const WORKSHOP_PINNED_WORDS = {
  busy: 'Pinned context is being changed in another window. Try again in a moment.',
  io: 'pinned-context.json couldn’t be read. Try again, or check the project folder.',
  tooManyFiles: `Pinned context holds at most ${WORKSHOP_PINNED_CONTEXT_FILES} files. Unpin a file to make room.`,
  outsideProject: 'Only files inside this project can be pinned.',
  notInCatalog: 'That file isn’t in your project’s context folders any more. Nothing was pinned.',
  catalogUnreadable: 'Your project’s context folders couldn’t be read just now. Nothing was pinned.',
  notListed: 'That file isn’t pinned any more. This is the current list.',
  notReady: 'Wait for the room to finish loading, then try again.',
  noListFile: 'There’s no pinned-context.json yet. The file is made when you pin the first file.',
  readFailed: 'The pinned files couldn’t be read just now. Nothing was changed.',
  invalid: 'That change can’t be saved as a pinned-context list. Nothing was changed.',
  listUnreadable: 'pinned-context.json can’t be read, so this tab can’t change it. Fix it in the editor.',
  workspaceChanged: 'The workspace changed, so pinned context wasn’t changed.',
  running: 'Wait for the reply to finish to attach files to this conversation. Pinning and unpinning still work, and apply to new conversations.',
  openFailed: 'That file couldn’t be opened.'
} as const;

/** "Can't pin manuscript.md: pinned context would come to about 104,000 of 100,000 words. …" */
export function workshopPinnedOverBudgetWords(labels: readonly string[], words: number): string {
  const which = labels.length === 1 ? labels[0] : `these ${labels.length} files`;
  const shorten = labels.length === 1 ? 'shorten this one' : 'pin fewer of these';
  return `Can’t pin ${which}: pinned context would come to ${aboutWords(words)} of ${BUDGET_WORDS} words. ` +
    `Unpin another file, or ${shorten}.`;
}
