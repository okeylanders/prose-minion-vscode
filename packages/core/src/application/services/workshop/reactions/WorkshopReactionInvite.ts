/**
 * The per-turn reaction invite (ADR 2026-11-07, 2026-11-10 addendum, Slice
 * 4a): one short host line beside the writer's message, reminding the persona
 * it may react to the message it is answering. Pure.
 *
 * It rides only where a reaction trailer has a target: while persona
 * reactions are on (Q8) and the run answers a writer message, exactly the
 * runs `WorkshopSessionService.personaReplyReactionTarget` names (host and
 * guest messages, a guest's join), never a tool run, a synthesis or a
 * sidecar. The caller passes that target, so the two rules cannot drift.
 *
 * It names the trailer without writing its tag: frame text is host-authored
 * but a literal `<prose-minion-reaction>` is reserved, and the invite's own
 * tag is reserved too, so writer text can neither forge nor close one. It
 * rides the new user message and is retained with it, like every next-turn
 * frame; earlier retained messages are never edited.
 */

export const WORKSHOP_REACTION_INVITE_TAG = 'workshop-reaction-invite';

/** The line itself, about twenty tokens. */
export const WORKSHOP_REACTION_INVITE_LINE =
  'You may react to this message: end your reply with one prose-minion-reaction trailer, an id from the reactions list.';

/** The invite frame. */
export function renderWorkshopReactionInvite(): string {
  return `<${WORKSHOP_REACTION_INVITE_TAG}>\n${WORKSHOP_REACTION_INVITE_LINE}\n</${WORKSHOP_REACTION_INVITE_TAG}>`;
}

/**
 * The invite for this run, or undefined: `open` is the persona-reactions
 * setting, `target` the writer message the run's reply may react to.
 */
export function workshopReactionInviteFor(open: boolean, target: unknown): string | undefined {
  return open && target !== undefined ? renderWorkshopReactionInvite() : undefined;
}
