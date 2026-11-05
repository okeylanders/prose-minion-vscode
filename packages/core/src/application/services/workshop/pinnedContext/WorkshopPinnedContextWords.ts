/**
 * Pinned context's states in the writer's words, as ADR 2026-11-04 D8 and
 * Slice 0d's boards draw them. Pure; the library and its tests read these,
 * and Slice 3's tab shows them.
 */

import type { WorkshopPinnedContextUnavailableReason } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import type { WorkshopPinnedFileFault } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_PINNED_CONTEXT_FILES, WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS, type WorkshopPinnedContextRefusal } from '@shared/types/workshopPinnedContext';

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
    case 'ambiguous':
      return 'more than one file in the project has this name, written differently. Pin the one you mean again.';
    case 'workspace-changed':
      return 'the project folder changed while it was read.';
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

/**
 * A pin past the list's file bound, with the count it would make, so a pin
 * of more files than the bound at once reads true when nothing is pinned yet.
 */
export function workshopPinnedTooManyFilesWords(total: number): string {
  return `Pinned context holds at most ${WORKSHOP_PINNED_CONTEXT_FILES} files, and this would make ${total.toLocaleString('en-US')}. Pin fewer, or unpin some first.`;
}

/** The unavailable notice, as the Memory tab's. */
export function workshopPinnedListUnavailableWords(reason: WorkshopPinnedContextUnavailableReason | 'workspace-changed'): string {
  if (reason === 'workspace-changed') {
    return 'The project folder changed while pinned context was read. Try again.';
  }
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
  openMissing: 'That file isn’t there any more, so it can’t be opened. Unpin it, or put the file back.',
  openAmbiguous: 'More than one file in your context folders matches this entry, so none was opened. Fix the entry in pinned-context.json.'
} as const;

/** "Can't pin manuscript.md: pinned context would come to about 104,000 of 100,000 words. …" */
export function workshopPinnedOverBudgetWords(labels: readonly string[], words: number): string {
  const which = labels.length === 1 ? labels[0] : `these ${labels.length} files`;
  const shorten = labels.length === 1 ? 'shorten this one' : 'pin fewer of these';
  return `Can’t pin ${which}: pinned context would come to ${aboutWords(words)} of ${BUDGET_WORDS} words. ` +
    `Unpin another file, or ${shorten}.`;
}

/** A file inside the project whose name holds a backslash (POSIX): format 1's paths can't name it. */
export function workshopPinnedBackslashWords(label: string): string {
  return `Can’t pin ${label}: pinned context can’t store a file name with a backslash in it.`;
}

/** A path longer than format 1 stores (PR #210 F07). */
export function workshopPinnedTooLongWords(label: string): string {
  return `Can’t pin ${label}: its path is longer than pinned context can store `
    + `(${WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS.toLocaleString('en-US')} characters).`;
}
