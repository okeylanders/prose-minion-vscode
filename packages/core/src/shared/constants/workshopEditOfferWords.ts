/**
 * The host's words for a reply's edit offers (ADR 2026-11-10 D4, D5, U2–U4;
 * epic Slice 2): one table from every refusal kind a press can be answered
 * with to one line, and the sentences the host writes into the thread for a
 * press and its answer. Shared by the host's answers and the webview, so a
 * chip says what the host said.
 *
 * - **Kinds, never words, are answered.** `WORKSHOP_EDIT_OFFER_RESULT`
 *   carries a refusal kind and these words for it.
 * - **A line names a persona by its label and a file by its display path,**
 *   never a URI, and never quotes the reply. The one persona text any line
 *   holds is a `none` answer's one-line why.
 */

import type { WorkshopEditOfferKind, WorkshopEditOfferRefusal } from '@shared/types/messages/workshop/editOffers';

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the refusal kinds' kebab-case words, as answered. */
export const WORKSHOP_EDIT_OFFER_REFUSAL_WORDS: Readonly<Record<WorkshopEditOfferRefusal, string>> = Object.freeze({
  'invalid-request': 'That press did not name a reply and what to ask for.',
  'room-changed': 'The room changed since this was shown, so nothing was asked.',
  'session-operation': 'Wait for the current session save or replacement to finish, then try again.',
  'run-active': 'Wait for the current reply to finish.',
  'no-turn': 'That reply is no longer in this room.',
  'no-offer': 'That reply no longer offers this.',
  'already-answered': 'This was already asked. Its suggested edits are further down the conversation.',
  'file-edits-off': 'Suggested file edits are turned off in settings, so nothing was asked.',
  'author-left': 'The persona who wrote that reply isn’t in this room now.',
  'not-sent': 'The request could not be sent. Try again.',
  stopped: 'Stopped. Nothing was suggested.',
  'no-answer': 'The persona didn’t answer with edits. Try again, or ask in your own words.',
  'cut-off': 'The answer was cut off before it finished, so nothing was suggested. Try again, or ask for fewer edits at a time.',
  failed: 'The request failed, so nothing was suggested. Try again.'
});
/* eslint-enable @typescript-eslint/naming-convention */

export function workshopEditOfferRefusalWords(reason: WorkshopEditOfferRefusal): string {
  return WORKSHOP_EDIT_OFFER_REFUSAL_WORDS[reason];
}

/** "3 fixes", "1 rewrite", or the bare kind with no count: a chip's label and every line's noun. */
export function workshopEditOfferCountWords(kind: WorkshopEditOfferKind, count: number | undefined): string {
  if (count === undefined) {
    return kind;
  }
  return `${count} ${count === 1 ? (kind === 'fixes' ? 'fix' : 'rewrite') : kind}`;
}

/** The press's writer turn (D4): what the transcript, recall and other participants' catch-up read. */
export function workshopEditOfferRequestLine(personaLabel: string, kind: WorkshopEditOfferKind): string {
  return `Asked ${personaLabel} to suggest the ${kind} from their reply as file edits.`;
}

/** The answer's line when it proposed cards (U4). `at` is the source reply's time as the room shows it. */
export function workshopEditOfferProposedLine(kind: WorkshopEditOfferKind, changes: number, relativePath: string, at: string): string {
  return `Suggested ${workshopEditOfferCountWords(kind, changes)} to ${relativePath}, from the ${at} reply.`;
}

/** The answer's line when there was nothing to change (U4), with the persona's one-line reason. */
export function workshopEditOfferNoneLine(personaLabel: string, why: string | undefined): string {
  return why ? `${personaLabel} found nothing to change: ${why}` : `${personaLabel} found nothing to change.`;
}

/** What retained history keeps in place of an answer (D5): the host's line, never the persona's prose or trailers. */
export function workshopEditOfferRetainedLine(kind: WorkshopEditOfferKind, read: { readonly outcome: 'proposed'; readonly changes: number } | { readonly outcome: 'none'; readonly why: string } | { readonly outcome: 'neither' }): string {
  switch (read.outcome) {
    case 'proposed':
      return `Suggested ${workshopEditOfferCountWords(kind, read.changes)} as file edits.`;
    case 'none':
      return `Found nothing to change: ${read.why}`;
    default:
      return 'Did not answer with file edits.';
  }
}

/** What a press came to, said once (U6): the answer is at the end of the conversation. */
export function workshopEditOfferAnsweredWords(
  personaLabel: string,
  kind: WorkshopEditOfferKind,
  answer: { readonly outcome: 'proposed'; readonly changes: number; readonly relativePath: string } | { readonly outcome: 'none' }
): string {
  return answer.outcome === 'none'
    ? `${personaLabel} found nothing to change.`
    : `${personaLabel} suggested ${workshopEditOfferCountWords(kind, answer.changes)} to ${answer.relativePath}. They are at the end of the conversation.`;
}
