/**
 * What one persona turn is told of reactions, and what its reply will record
 * (ADR 2026-11-07 D4, D6, R2). Pure: the room handler reads the ledger and
 * the reactions, asks here, puts the frame beside the writer's message and
 * stages the record on the run, which writes it on the reply only if the
 * reply commits.
 *
 * Owed to a participant: each reaction standing now, on a turn it can see
 * (`isWorkshopTurnVisibleToParticipant`, R2), not in its delivered view, and
 * never its own. The writer's reactions, and (Q3) another persona's reaction
 * on the writer's message. Newest first; at most `deliveredPerReply` are
 * delivered (and recorded) at once, the frame listing `framePerTurn` of them
 * and counting the rest; anything older past the bound is owed to a later
 * turn. A removed reaction is simply not standing, so it is never announced
 * (Q5).
 */

import type {
  WorkshopDeliveredReaction,
  WorkshopPersonaId,
  WorkshopReactionDelivery,
  WorkshopTurn,
  WorkshopTurnReaction,
  WorkshopTurnReactionAuthor
} from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import { workshopReactionAuthorKey } from '@shared/constants/workshopReactions';
import { isWorkshopTurnVisibleToParticipant } from '@/application/services/workshop/WorkshopRoomAudience';
import {
  renderWorkshopReactionsFrame,
  type WorkshopReactionFrameEntry
} from '@/application/services/workshop/WorkshopReactionFrameRenderer';
import { workshopReactionKey } from '@/application/services/workshop/session/WorkshopReactionRecords';
import { workshopReactionDeliveredView } from '@/application/services/workshop/reactions/WorkshopReactionDeliveredView';

export interface WorkshopReactionDeliveryInput {
  readonly turns: readonly WorkshopTurn[];
  readonly reactions: readonly WorkshopTurnReaction[];
  readonly reader: WorkshopCapabilityPrincipal;
  /** The room's host persona, for naming its replies and reactions. */
  readonly hostPersonaId: WorkshopPersonaId;
  /** `start` for a conversation's first message (a fresh host, a guest's join). */
  readonly kind: 'start' | 'update';
}

export interface WorkshopReactionDeliveryPlan {
  readonly frame?: string;
  /** The record the reply writes if it commits. */
  readonly record?: WorkshopReactionDelivery;
  /** Delivered: listed in the frame, and counted in its count line. */
  readonly listed: number;
  readonly counted: number;
  /** Owed past `deliveredPerReply`, left for a later turn. */
  readonly deferred: number;
}

const personaName = (turn: WorkshopTurn, hostPersonaId: WorkshopPersonaId): string =>
  turn.personaLabel ?? workshopPersonaLabel(turn.personaId ?? hostPersonaId);

const authorName = (author: WorkshopTurnReactionAuthor, hostPersonaId: WorkshopPersonaId): string =>
  author.kind === 'writer'
    ? 'The writer'
    : workshopPersonaLabel(author.kind === 'host' ? hostPersonaId : author.personaId);

/** Whose message: the reader's own reply, another persona's, or the writer's. */
function targetName(turn: WorkshopTurn, reader: WorkshopCapabilityPrincipal, hostPersonaId: WorkshopPersonaId): string {
  if (turn.participant === 'writer') {
    return 'the writer\'s message';
  }
  const own = reader.kind === 'host'
    ? turn.participant === 'host'
    : turn.participant === 'guest' && turn.personaId === reader.personaId;
  return own ? 'your reply' : `${personaName(turn, hostPersonaId)}'s reply`;
}

const delivered = ({ turnId, author, reaction }: WorkshopTurnReaction): WorkshopDeliveredReaction => ({
  turnId,
  author: author.kind === 'personaGuest' ? { kind: 'personaGuest', personaId: author.personaId } : { kind: author.kind },
  reaction
});

export function planWorkshopReactionDelivery(input: WorkshopReactionDeliveryInput): WorkshopReactionDeliveryPlan {
  const { reader, hostPersonaId } = input;
  const readerKey = workshopReactionAuthorKey(reader);
  const view = workshopReactionDeliveredView(input.turns, reader);
  const told = input.kind === 'start' ? new Set<string>() : view.reactions;
  const byId = new Map(input.turns.map((turn) => [turn.id, turn]));
  const owed = input.reactions
    .map((reaction, index) => ({ reaction, index, turn: byId.get(reaction.turnId) }))
    .filter((entry): entry is typeof entry & { turn: WorkshopTurn } =>
      entry.turn !== undefined
      && workshopReactionAuthorKey(entry.reaction.author) !== readerKey
      && isWorkshopTurnVisibleToParticipant(entry.turn, reader)
      && !told.has(workshopReactionKey(entry.reaction)))
    .sort((left, right) => right.reaction.createdAt - left.reaction.createdAt || right.index - left.index);

  const sent = owed.slice(0, PROMPT_BUDGETS.workshopReactions.deliveredPerReply);
  const entries: WorkshopReactionFrameEntry[] = sent
    .slice(0, PROMPT_BUDGETS.workshopReactions.framePerTurn)
    .map(({ reaction, turn }) => ({
      authorName: authorName(reaction.author, hostPersonaId),
      reaction: reaction.reaction,
      targetName: targetName(turn, reader, hostPersonaId),
      targetText: turn.content
    }));
  const counted = sent.length - entries.length;
  const participant = reader.kind === 'host'
    ? { kind: 'host' as const }
    : { kind: 'personaGuest' as const, personaId: reader.personaId };
  // A start with nothing to tell still begins a new view, when an earlier one exists to end.
  const record: WorkshopReactionDelivery | undefined = sent.length > 0 || (input.kind === 'start' && view.recorded)
    ? { participant, kind: input.kind, reactions: sent.map(({ reaction }) => delivered(reaction)) }
    : undefined;
  return {
    frame: renderWorkshopReactionsFrame({ kind: input.kind, entries, earlier: counted }),
    ...(record ? { record } : {}),
    listed: entries.length,
    counted,
    deferred: owed.length - sent.length
  };
}
