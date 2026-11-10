/**
 * The writer's words for a file-edit card (ADR 2026-11-05 D8, D9): one table
 * from every reason kind the host stores or answers to one line, and one
 * line per state. Shared by the host's answers and the webview's cards, so a
 * card read back after a reload says what it said live.
 *
 * - **Kinds, never words, are stored.** A card's `reason` is a kind
 *   (`WorkshopFileEditProposal.reason`); these words are looked up from it.
 * - **No line names a path or URI, or quotes the file.** A card names its
 *   file itself, by its display path.
 * - **An unlisted kind** (a later build's) reads as the generic line, never
 *   as itself.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopFileEditState } from '@messages';

const MIB = 1024 * 1024;
const BOUNDS = PROMPT_BUDGETS.workshopFileEdits;

/**
 * Every reason kind a card can hold or an answer can carry, by where it
 * comes from: staging (D4), the reply reader (Slice 3), the gateway's
 * refusals and faults (D5–D7), the applier's refusals, and the handler's
 * own (D8).
 */
/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reason kinds' kebab-case words, as stored. */
export const WORKSHOP_FILE_EDIT_REASON_WORDS = Object.freeze({
  // Staging (FileEditStagingRefusal).
  'unknown-group': 'That group is not one of the configured project-resource groups.',
  'unsafe-path': 'Only a workspace-relative configured path can be edited.',
  'not-configured': 'That file is not one of the configured project resources in its group.',
  'ambiguous-target': 'That path names more than one file (in two workspace folders, or in two spellings), so nothing can be edited.',
  'outside-workspace': 'That file is outside the open workspace.',
  'not-text': 'Only Markdown and plain-text files can be edited.',
  'too-large': `That file is larger than the ${BOUNDS.fileBytes / MIB} MiB edit limit.`,
  'catalog-unreadable': 'The project’s configured files could not be listed.',
  'excerpt-not-a-file': 'The excerpt has no file to edit (it was pasted, or there is none).',
  unreadable: 'That file could not be opened or read as text.',
  // The reply reader and the reopen rule (Slice 3).
  'rewrite-on-prose': 'Prose is never rewritten whole. Ask for replace edits instead.',
  'identity-unpersistable': 'That file’s name is too long, or not on one line, to keep in the session.',
  'applying-on-reopen': 'The session closed while this was being applied, so it is not known whether it landed. Check the file before asking again.',
  // The gateway's refusals (FileEditApplyRefusal).
  'no-operations': 'There was nothing to change.',
  'no-longer-configured': 'That file is no longer one of the configured project resources.',
  'identity-changed': 'That file could not be opened as the same document.',
  superseded: 'The room moved on before the change was made, so nothing changed.',
  'authority-changed': 'The workspace folders or configured project files changed, so nothing changed. Ask again.',
  'host-failed': 'The editor could not make the change.',
  // An operation's fault (FileEditOperationFault, the planner's TextEditFaultKind).
  'not-found': 'The text to change is no longer in the file.',
  ambiguous: 'The text to change appears more than once in the file, so it is not clear which to change.',
  overlapping: 'The suggested changes overlap or conflict, so none was made.',
  'conflicting-operations': 'The suggested changes overlap or conflict, so none was made.',
  'not-allowed': 'Prose is never rewritten whole.',
  'baseline-changed': 'The file changed since this was suggested, so nothing was changed.',
  'insertion-too-long': `A passage added to prose may hold at most ${BOUNDS.insertWords} words and ${BOUNDS.insertCharacters.toLocaleString('en-US')} characters.`,
  'rewrite-ceiling': 'This rewrites too much of the passage: prose takes edits, not rewrites.',
  'rewrite-protected': 'This note holds links, images, code or HTML, which a rewrite would retype. Ask for replace edits instead.',
  'rewrite-too-large': `A note is rewritten whole only up to ${BOUNDS.rewriteFileBytes / 1024} KiB. Ask for replace edits instead.`,
  // An answer to a reply's offer (ADR 2026-11-10 D5, D6).
  'more-than-a-fix': 'This is more than a small fix. Ask for it as a rewrite.',
  'not-the-offered-file': 'This edit is for a different file than the one the reply offered, so it can’t be applied.',
  // The applier's refusals (DraftEditRefusal; `overlapping` is above).
  changed: 'The text changed as the edit went out, so nothing more was changed.',
  protected: 'This would change protected text (front matter, code, links or markup), so nothing changed.',
  'line-break': 'This would change a line break, so nothing changed.',
  markup: 'This would change the passage’s Markdown structure, so nothing changed.',
  // The gateway's own outcome reasons.
  'document-changed': 'The file changed as the edit went out, so nothing was changed.',
  refused: 'The change could not be made.',
  'not-a-rewrite': 'Only a whole-note rewrite has a before and after to show.',
  // The handler's (D8).
  'outcome-unknown': 'It is not known whether the change landed. Check the file before asking again.',
  'file-edits-off': 'Suggested file edits are turned off in settings, so nothing changed.',
  'run-active': 'Apply after the current reply finishes.',
  'room-changed': 'The room changed since this was shown, so nothing changed.',
  'store-unavailable': 'The session can’t be saved right now, so nothing changed: Apply waits until the session is saved first.',
  'checkpoint-failed': 'The session could not be saved before the change, so nothing changed. Try again.',
  'mirror-failed': 'The session could not be saved before the change, so nothing changed. Try again.',
  'not-applying': 'The room changed before the change could start, so nothing changed.',
  'no-card': 'That message no longer holds this suggested edit.',
  'session-operation': 'Wait for the current session save or replacement to finish, then try again.',
  applying: 'This edit is being applied.'
} as const);
/* eslint-enable @typescript-eslint/naming-convention */

export type WorkshopFileEditReasonKind = keyof typeof WORKSHOP_FILE_EDIT_REASON_WORDS;

const GENERIC = WORKSHOP_FILE_EDIT_REASON_WORDS.refused;

export function isWorkshopFileEditReasonKind(reason: string): reason is WorkshopFileEditReasonKind {
  return Object.prototype.hasOwnProperty.call(WORKSHOP_FILE_EDIT_REASON_WORDS, reason);
}

/** One reason kind in the writer's words; an unlisted one reads as the generic line. */
export function workshopFileEditReasonWords(reason: string | undefined): string {
  return reason !== undefined && isWorkshopFileEditReasonKind(reason) ? WORKSHOP_FILE_EDIT_REASON_WORDS[reason] : GENERIC;
}

/** One line per card state, for a card with no reason of its own. */
export const WORKSHOP_FILE_EDIT_STATE_WORDS: Readonly<Record<WorkshopFileEditState, string>> = Object.freeze({
  pending: 'Nothing changes until you apply it.',
  applying: 'Applying…',
  applied: 'Applied. The file is not saved yet.',
  partial: 'Some of the changes were applied; the rest were not. The file is not saved yet.',
  declined: 'Declined; nothing changed.',
  stale: 'The file changed since this was suggested, so nothing was changed.',
  refused: GENERIC,
  unknown: WORKSHOP_FILE_EDIT_REASON_WORDS['outcome-unknown']
});

/**
 * A partial card some of whose other operations are `unknown` (PR #233
 * note): "the rest were not" would be false, so it says it is not known.
 */
export const WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS =
  'Some of the changes were applied; for the others, it is not known whether they landed. Check the file before asking again. The file is not saved yet.';

/**
 * A state's line, read against its operations' outcomes when it has them:
 * `partial` with any `unknown` among them reads the uncertain line.
 */
export function workshopFileEditStateWords(state: WorkshopFileEditState, outcomes?: readonly string[]): string {
  if (state === 'partial' && outcomes?.includes('unknown')) {
    return WORKSHOP_FILE_EDIT_PARTIAL_UNCERTAIN_WORDS;
  }
  return WORKSHOP_FILE_EDIT_STATE_WORDS[state];
}

/**
 * A card's line: its reason's words when it has one, else its state's
 * (read against its outcomes). `applied` and `partial` lead with the state,
 * since a reason there only says why the rest did not land.
 */
export function workshopFileEditCardWords(state: WorkshopFileEditState, reason?: string, outcomes?: readonly string[]): string {
  if (reason === undefined) {
    return workshopFileEditStateWords(state, outcomes);
  }
  if (state === 'applied' || state === 'partial') {
    return `${workshopFileEditStateWords(state, outcomes)} ${workshopFileEditReasonWords(reason)}`;
  }
  return workshopFileEditReasonWords(reason);
}
