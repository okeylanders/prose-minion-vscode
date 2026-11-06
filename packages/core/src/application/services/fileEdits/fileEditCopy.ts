/**
 * The writer's words for what staging and the gateway did (ADR 2026-11-05
 * D8, D9, D13). One table holds every kind's words
 * (`WORKSHOP_FILE_EDIT_REASON_WORDS`, shared with the webview's cards); this
 * module only picks the line for a staging refusal or an Apply's outcome.
 * None names a path or quotes the file: a card names its file itself.
 */

import type { FileEditStagingRefusal } from '@/domain/models/FileEditStaging';
import { WORKSHOP_FILE_EDIT_REASON_WORDS, workshopFileEditReasonWords } from '@shared/constants/workshopFileEditWords';
import type { FileEditApplyState } from './ProjectFileEditGateway';

const unhandled = (value: never): never => {
  throw new Error(`Unhandled file edit case: ${String(value)}`);
};

export function fileEditStagingRefusalMessage(reason: FileEditStagingRefusal): string {
  return WORKSHOP_FILE_EDIT_REASON_WORDS[reason];
}

/** One line for an Apply's outcome, by state and reason. */
export function fileEditOutcomeMessage(state: FileEditApplyState, reason?: string): string {
  switch (state) {
    case 'applied':
      return 'Applied. The file is not saved yet.';
    case 'partial':
      return 'Some of the changes were applied; the rest were not. The file is not saved yet.';
    case 'declined':
      return 'The review was discarded; nothing changed.';
    case 'unknown':
      return WORKSHOP_FILE_EDIT_REASON_WORDS['outcome-unknown'];
    case 'stale':
      return reason === 'baseline-changed' || reason === undefined
        ? WORKSHOP_FILE_EDIT_REASON_WORDS['baseline-changed']
        : workshopFileEditReasonWords(reason);
    case 'refused':
      return workshopFileEditReasonWords(reason);
    default:
      return unhandled(state);
  }
}
