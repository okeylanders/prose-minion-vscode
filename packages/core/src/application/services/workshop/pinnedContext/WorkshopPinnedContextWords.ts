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
