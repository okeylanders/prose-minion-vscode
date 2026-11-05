/**
 * The writer's words for what staging and the gateway did (ADR 2026-11-05
 * D8, D13). None names a path or quotes the file: a card names its file
 * itself.
 */

import type { FileEditStagingRefusal } from '@/domain/models/FileEditStaging';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { FileEditApplyState } from './ProjectFileEditGateway';

const MIB = 1024 * 1024;
const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

const unhandled = (value: never): never => {
  throw new Error(`Unhandled file edit case: ${String(value)}`);
};

export function fileEditStagingRefusalMessage(reason: FileEditStagingRefusal): string {
  switch (reason) {
    case 'unknown-group':
      return 'That group is not one of the configured project-resource groups.';
    case 'unsafe-path':
      return 'Only a workspace-relative configured path can be edited.';
    case 'not-configured':
      return 'That file is not one of the configured project resources in its group.';
    case 'ambiguous-target':
      return 'That path names more than one file (in two workspace folders, or in two spellings), so nothing can be edited.';
    case 'outside-workspace':
      return 'That file is outside the open workspace.';
    case 'not-text':
      return 'Only Markdown and plain-text files can be edited.';
    case 'too-large':
      return `That file is larger than the ${BOUNDS.fileBytes / MIB} MiB edit limit.`;
    case 'catalog-unreadable':
      return 'The project’s configured files could not be listed.';
    case 'excerpt-not-a-file':
      return 'The excerpt has no file to edit (it was pasted, or there is none).';
    case 'unreadable':
      return 'That file could not be read as text.';
    default:
      return unhandled(reason);
  }
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
      return 'It is not known whether the change landed. Check the file before asking again.';
    case 'stale':
      return 'The file changed since this was suggested, so nothing was changed.';
    case 'refused':
      return refusalMessage(reason);
    default:
      return unhandled(state);
  }
}

function refusalMessage(reason: string | undefined): string {
  switch (reason) {
    case 'no-longer-configured':
      return 'That file is no longer one of the configured project resources.';
    case 'outside-workspace':
      return 'That file is outside the open workspace.';
    case 'identity-changed':
    case 'unreadable':
      return 'That file could not be opened as the same document.';
    case 'catalog-unreadable':
      return 'The project’s configured files could not be listed.';
    case 'not-text':
      return 'Only Markdown and plain-text files can be edited.';
    case 'too-large':
      return `That file is larger than the ${BOUNDS.fileBytes / MIB} MiB edit limit.`;
    case 'superseded':
      return 'The room moved on before the change was made, so nothing changed.';
    case 'authority-changed':
      return 'The workspace folders or configured project files changed, so nothing changed. Ask again.';
    case 'not-allowed':
      return 'Prose is never rewritten whole.';
    case 'insertion-too-long':
      return `A passage added to prose may hold at most ${BOUNDS.insertWords} words and ${BOUNDS.insertCharacters.toLocaleString('en-US')} characters.`;
    case 'rewrite-ceiling':
      return 'This rewrites too much of the passage: prose takes edits, not rewrites.';
    case 'rewrite-protected':
      return 'This note holds links, images, code or HTML, which a rewrite would retype. Ask for replace edits instead.';
    case 'rewrite-too-large':
      return `A note is rewritten whole only up to ${BOUNDS.rewriteFileBytes / 1024} KiB. Ask for replace edits instead.`;
    case 'protected':
      return 'This would change protected text (front matter, code, links or markup), so nothing changed.';
    case 'markup':
      return 'This would change the passage’s Markdown structure, so nothing changed.';
    case 'line-break':
      return 'This would change a line break, so nothing changed.';
    case 'overlapping':
    case 'conflicting-operations':
      return 'The suggested changes overlap or conflict, so none was made.';
    default:
      return 'The change could not be made.';
  }
}
