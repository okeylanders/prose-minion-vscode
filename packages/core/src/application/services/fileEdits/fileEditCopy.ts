/**
 * The writer's words for what the gateway did (ADR 2026-11-05 D7, D11).
 * None names the file's path or quotes its text; a card names its file
 * itself.
 */

import type { FileEditOperationFault, FileEditRefusal } from '@/domain/models/FileEdit';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const MIB = 1024 * 1024;

const unhandled = (value: never): never => {
  throw new Error(`Unhandled file edit case: ${String(value)}`);
};

export function fileEditRefusalMessage(reason: FileEditRefusal): string {
  switch (reason) {
    case 'no-operations':
      return 'This suggestion has no change to make.';
    case 'unknown-group':
      return 'That group is not one of the configured project-resource groups.';
    case 'unsafe-path':
      return 'Only a workspace-relative configured path can be edited.';
    case 'not-configured':
      return 'That file is no longer one of the configured project resources in its group.';
    case 'ambiguous-path':
      return 'That path matches more than one configured resource when letter case is ignored.';
    case 'outside-workspace':
      return 'That file is outside the open workspace.';
    case 'not-text':
      return 'Only Markdown and plain-text files can be edited.';
    case 'too-large':
      return `That file is larger than the ${PROMPT_BUDGETS.workshopFileEdits.fileBytes / MIB} MiB edit limit.`;
    case 'catalog-unreadable':
      return 'The project’s configured files could not be listed.';
    case 'no-excerpt':
      return 'The room has no excerpt to edit.';
    case 'excerpt-manual':
      return 'The excerpt was pasted, so it has no file to edit.';
    case 'excerpt-stale':
      return 'The excerpt changed since this was suggested.';
    case 'unreadable':
      return 'That file could not be opened as text.';
    default:
      return unhandled(reason);
  }
}

/** One line for a plan that faulted; a quote not found exactly once means the file moved on. */
export function fileEditFaultMessage(faults: ReadonlyArray<{ readonly fault: FileEditOperationFault }>): string {
  const kinds = new Set(faults.map(({ fault }) => fault));
  if (kinds.has('not-found') || kinds.has('ambiguous')) {
    return 'The file changed since this was suggested.';
  }
  if (kinds.has('passage-too-long')) {
    return `A passage added to prose may hold at most ${PROMPT_BUDGETS.workshopFileEdits.appendWords} words.`;
  }
  if (kinds.has('over-rewrite-ceiling')) {
    return 'This rewrites too much of the passage; prose takes edits, not rewrites.';
  }
  if (kinds.has('not-allowed')) {
    return 'Prose is never rewritten whole.';
  }
  return 'The suggested changes overlap or conflict, so none was made.';
}
