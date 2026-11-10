/**
 * The per-turn edit-offer reminder (ADR 2026-11-10, second addendum; epic
 * Slice 3b): one short host line beside the writer's message, reminding the
 * persona to declare the replacement prose or fixes its reply writes out.
 * Pure. It follows Message Reactions' invite
 * (`WorkshopReactionInvite`): the system prompt alone was not enough there,
 * and this teaching sits in a longer prompt.
 *
 * It rides only where an offer could be kept and pressed:
 * - while suggested file edits are `ask` (the teaching itself is sent only
 *   then, and an offer read with them off is dropped);
 * - while the room has a file to target: its excerpt came from a file (a
 *   sourced excerpt, never a pasted one or an open conversation), so
 *   `<excerpt/>` names a document;
 * - on a host or guest persona's message (a guest's join included), never a
 *   tool run, and never with a press, whose answer is file-edit trailers
 *   alone (D5).
 *
 * It names the trailer without writing its tag: a literal
 * `<prose-minion-edit-offer>` is reserved, and so is the reminder's own tag,
 * so writer text can neither forge nor close one. It rides the new user
 * message and is retained with it, like every next-turn frame.
 */

export const WORKSHOP_EDIT_OFFER_REMINDER_TAG = 'workshop-edit-offer-reminder';

/** The line itself: about forty tokens. */
export const WORKSHOP_EDIT_OFFER_REMINDER_LINE =
  'If your reply writes out replacement prose for a passage of a file, or names small fixes to it, end it with a '
  + 'prose-minion-edit-offer trailer for each kind, with an option for each alternative version.';

/** The reminder frame. */
export function renderWorkshopEditOfferReminder(): string {
  return `<${WORKSHOP_EDIT_OFFER_REMINDER_TAG}>\n${WORKSHOP_EDIT_OFFER_REMINDER_LINE}\n</${WORKSHOP_EDIT_OFFER_REMINDER_TAG}>`;
}

/** What decides whether a run's message carries the reminder. */
export interface WorkshopEditOfferReminderFacts {
  /** `proseMinion.workshop.fileEdits` is `ask` now. */
  readonly fileEditsOpen: boolean;
  /** The room's excerpt came from a file. */
  readonly excerptFromFile: boolean;
  /** The message goes to a host or guest persona's own conversation. */
  readonly toPersona: boolean;
  /** The run is a press on an edit offer. */
  readonly press: boolean;
}

/** The reminder for this run, or undefined. */
export function workshopEditOfferReminderFor(facts: WorkshopEditOfferReminderFacts): string | undefined {
  return facts.fileEditsOpen && facts.excerptFromFile && facts.toPersona && !facts.press ? renderWorkshopEditOfferReminder() : undefined;
}
