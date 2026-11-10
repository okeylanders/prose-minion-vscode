/**
 * The press's directive frame (ADR 2026-11-10 D4, D5; epic Slice 2). Pure.
 *
 * A press on a reply's offer sends that reply's author one framed
 * instruction in the next user message:
 *
 *   <prose-minion-edit-request kind="fixes">
 *   …what was pressed, and what to answer with…
 *   <source-reply turn="t-41" at="2:02 pm">
 *   …the reply, as the ledger holds it, neutralized…
 *   </source-reply>
 *   </prose-minion-edit-request>
 *
 * - **Built from the ledger's turn,** never from anything the webview sent:
 *   the caller passes the turn's own id, time and content, and its offer.
 * - **The reply is always quoted,** with every reserved frame marker
 *   neutralized (`neutralizeReservedPersonaPromptDelimiters`), so quoted text
 *   can neither close the frame nor forge a trailer. The persona's own
 *   history may have been compacted or the room reopened; the quote makes
 *   the source certain either way.
 * - **The wording differs by kind** only in its middle paragraph
 *   (`WORKSHOP_EDIT_REQUEST_KIND_WORDS`). A press of one version of an offer
 *   with options names that version, by the host's stored label, and asks
 *   for it alone (`workshopEditRequestOptionWords`).
 * - **The persona-facing words live here,** beside the frame they belong to.
 *   `replyEditOfferPressPromptSync.test.ts` holds them to the persona
 *   prompt's teaching (`workshop-personas/reply-edit-offers.md`) and to the
 *   answer reader.
 */

import type { WorkshopEditOffer, WorkshopEditOfferKind } from '@shared/types/messages/workshop/editOffers';
import { workshopEditOfferCountWords } from '@shared/constants/workshopEditOfferWords';
import { WORKSHOP_FILE_EDIT_TAG } from '@/utils/workshopFileEditProtocol';
import { WORKSHOP_NO_FILE_EDIT_TAG } from '@/utils/workshopNoFileEditProtocol';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export const WORKSHOP_EDIT_REQUEST_TAG = 'prose-minion-edit-request';
export const WORKSHOP_EDIT_REQUEST_SOURCE_TAG = 'source-reply';

/** The no-edit answer, exactly as the directive and the persona prompt write it. */
export const WORKSHOP_NO_FILE_EDIT_FORM =
  `<${WORKSHOP_NO_FILE_EDIT_TAG}><why>one line</why></${WORKSHOP_NO_FILE_EDIT_TAG}>`;

/** What each kind asks for: the directive's middle paragraph. */
export const WORKSHOP_EDIT_REQUEST_KIND_WORDS: Readonly<Record<WorkshopEditOfferKind, { readonly ask: string; readonly rule: string }>> = Object.freeze({
  fixes: {
    ask: 'Suggest those fixes as file edits now.',
    rule: 'Fixes only: the spelling, grammar and punctuation slips your reply named. Each is a find-and-replace that changes a few '
      + 'characters. No rewording, no appends, no rewrites, and nothing your reply did not name.'
  },
  rewrites: {
    ask: 'Suggest those rewrites as file edits now.',
    rule: 'Rewrites only: the passages your reply reworded, or said how to reword. Each is a find-and-replace kept to its passage, '
      + 'under the prose rules you already know. Nothing your reply did not propose.'
  }
});

/** What the engine tells a persona whose answer held neither edits nor the no-edit frame (D5). */
export const WORKSHOP_EDIT_REQUEST_CORRECTION =
  `Your reply held no file-edit trailer. Reply with <${WORKSHOP_FILE_EDIT_TAG}> trailers only, or with exactly `
  + `${WORKSHOP_NO_FILE_EDIT_FORM}.`;

/**
 * The writer-message slot of a press's user message: the writer wrote
 * nothing, and the frame above it is the whole instruction.
 */
export const WORKSHOP_EDIT_REQUEST_MESSAGE =
  '(The writer pressed a button on your earlier reply instead of writing a message. Follow the edit request frame above.)';

export interface WorkshopEditRequestFrameInput {
  /** The source reply, from the ledger. */
  readonly turn: { readonly id: string; readonly content: string };
  /** The source reply's time as the room shows it ("2:02 pm"); host-formatted. */
  readonly at: string;
  /** The turn's own offer of the pressed kind. */
  readonly offer: Pick<WorkshopEditOffer, 'kind' | 'count'> & { readonly target: Pick<WorkshopEditOffer['target'], 'kind' | 'relativePath'> };
  /**
   * The version the writer chose, for an offer with options (second
   * addendum): the host's stored label, never the webview's. Neutralized
   * here before it is written.
   */
  readonly option?: string;
}

/** What a press of one version asks for, in place of the kind's words: that version only. `label` is already neutralized. */
export function workshopEditRequestOptionWords(label: string): { readonly pressed: string; readonly rule: string } {
  return {
    pressed: `The writer chose "${label}" from your reply`,
    rule: `That version only: the replacement prose your reply wrote out as "${label}". Suggest it as find-and-replace kept to its passage, `
      + 'under the prose rules you already know. Leave the other versions out, and add nothing your reply did not propose.'
  };
}

/** The ask that ends a version's first line. */
export const WORKSHOP_EDIT_REQUEST_OPTION_ASK = 'Suggest that version only, as file edits.';

function attribute(value: string): string {
  return neutralizeReservedPersonaPromptDelimiters(value).replace(/["<>\r\n]/g, ' ').trim();
}

/**
 * Which file to edit. An excerpt offer keeps the document it was bound to
 * when the reply was read (D2; PR #252 F-03): the directive names it by its
 * display path, and says that `<excerpt/>` means that file in this answer,
 * whatever the room's excerpt is now. The host stages the answer the same way.
 */
function fileWords(target: WorkshopEditRequestFrameInput['offer']['target']): string {
  const path = attribute(target.relativePath);
  return target.kind === 'excerpt'
    ? `Edit only the file your reply named, ${path}: name it as <excerpt/>. In this answer <excerpt/> means that file, even if the room's excerpt has changed since.`
    : `Edit only the file your reply named, ${path}: name it by its <group> and <path>, as in any file edit.`;
}

export function buildWorkshopEditRequestFrame(input: WorkshopEditRequestFrameInput): string {
  const { turn, offer } = input;
  const words = WORKSHOP_EDIT_REQUEST_KIND_WORDS[offer.kind];
  const at = attribute(input.at);
  const chosen = input.option === undefined ? undefined : workshopEditRequestOptionWords(attribute(input.option));
  return [
    `<${WORKSHOP_EDIT_REQUEST_TAG} kind="${offer.kind}">`,
    chosen
      ? `${chosen.pressed} of ${at}, quoted below. ${WORKSHOP_EDIT_REQUEST_OPTION_ASK}`
      : `The writer pressed "${workshopEditOfferCountWords(offer.kind, offer.count)}" on your reply of ${at}, quoted below. ${words.ask}`,
    '',
    `Reply with <${WORKSHOP_FILE_EDIT_TAG}> trailers and nothing else: no greeting, no commentary, no other trailer. `
      + `${fileWords(offer.target)} Read the file as it stands before you quote it.`,
    '',
    chosen ? chosen.rule : words.rule,
    '',
    'If the file already reads right, or you find nothing to change, reply with exactly:',
    WORKSHOP_NO_FILE_EDIT_FORM,
    '',
    `<${WORKSHOP_EDIT_REQUEST_SOURCE_TAG} turn="${attribute(turn.id)}" at="${at}">`,
    neutralizeReservedPersonaPromptDelimiters(turn.content),
    `</${WORKSHOP_EDIT_REQUEST_SOURCE_TAG}>`,
    `</${WORKSHOP_EDIT_REQUEST_TAG}>`
  ].join('\n');
}

/** A turn's time as the room shows it ("2:02 pm"), in the session's timezone. */
export function workshopEditRequestTime(timestamp: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone })
    .format(new Date(timestamp))
    .replace(/\s+/gu, ' ')
    .toLowerCase();
}
