/**
 * Reactions in the persisted session (ADR 2026-11-07 D2, D3).
 *
 * `reactions` is an optional, additive key, like `bookmarks`: a session
 * without it reads and writes exactly as before, and no `schemaVersion` bump.
 * When present, each entry is exact:
 * `{ turnId, reaction, author, viaTurnId?, createdAt }`, with a known id, an
 * author of a known kind, `viaTurnId` present exactly when the author is a
 * persona, the triple `(turnId, author, reaction)` used once, and at most
 * `PROMPT_BUDGETS.workshopReactions.perSession` entries.
 *
 * A reaction whose turn (or, for a persona's, whose carrying reply) is gone
 * is a development checkpoint's drift: checkpoint normalization drops it with
 * a named, logged normalization (ADR 2026-07-30), and strict validation
 * refuses it after.
 */

import type {
  WorkshopTurn,
  WorkshopTurnReaction,
  WorkshopTurnReactionAuthor
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import {
  isWorkshopReactableTurn,
  isWorkshopReactionId,
  workshopReactionAuthorKey
} from '@shared/constants/workshopReactions';
import {
  boundedArrayAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';

const PATH = 'Workshop session state.reactions';

/** A stable key for the identity triple. */
export function workshopReactionKey(
  reaction: Pick<WorkshopTurnReaction, 'turnId' | 'author' | 'reaction'>
): string {
  return `${reaction.turnId}\u0000${workshopReactionAuthorKey(reaction.author)}\u0000${reaction.reaction}`;
}

/** Strict structure of a reaction's author; the delivery records read it too. */
export function assertWorkshopReactionAuthorShape(value: unknown, path: string): WorkshopTurnReactionAuthor {
  const author = exactObject(value, path, ['kind'], ['personaId']);
  if (author.kind === 'writer' || author.kind === 'host') {
    if (author.personaId !== undefined) {
      shapeError(`${path}.personaId`, 'absent for the writer or the host');
    }
    return { kind: author.kind };
  }
  if (author.kind !== 'personaGuest') {
    shapeError(`${path}.kind`, 'writer, host, or personaGuest');
  }
  if (!isWorkshopPersonaId(author.personaId)) {
    shapeError(`${path}.personaId`, 'a known Workshop persona id');
  }
  return { kind: 'personaGuest', personaId: author.personaId };
}

/** Strict structure of `reactions`: entries, keys, types, bound and uniqueness. */
export function assertWorkshopReactionsShape(value: unknown): void {
  boundedArrayAt(value, PATH, 0, PROMPT_BUDGETS.workshopReactions.perSession, 'reactions');
  const keys = new Set<string>();
  const carriers = new Set<string>();
  value.forEach((item, index) => {
    const path = `${PATH}[${index}]`;
    const entry = exactObject(item, path, ['turnId', 'reaction', 'author', 'createdAt'], ['viaTurnId']);
    if (typeof entry.turnId !== 'string' || entry.turnId.length === 0) {
      shapeError(`${path}.turnId`, 'non-empty string');
    }
    if (!isWorkshopReactionId(entry.reaction)) {
      shapeError(`${path}.reaction`, 'a known Workshop reaction id');
    }
    const author = assertWorkshopReactionAuthorShape(entry.author, `${path}.author`);
    if (author.kind === 'writer') {
      if (entry.viaTurnId !== undefined) {
        shapeError(`${path}.viaTurnId`, 'absent on the writer\'s reaction');
      }
    } else if (typeof entry.viaTurnId !== 'string' || entry.viaTurnId.length === 0) {
      shapeError(`${path}.viaTurnId`, 'the non-empty id of the reply that carried a persona\'s reaction');
    }
    if (!Number.isSafeInteger(entry.createdAt) || (entry.createdAt as number) < 0) {
      shapeError(`${path}.createdAt`, 'non-negative safe integer');
    }
    const key = workshopReactionKey({ turnId: entry.turnId, author, reaction: entry.reaction });
    if (keys.has(key)) {
      shapeError(path, 'a reaction no other entry already gives (turn, author and reaction)');
    }
    keys.add(key);
    // A persona reacts at most once per reply (ADR 2026-11-07 D5).
    if (author.kind !== 'writer') {
      if (carriers.has(entry.viaTurnId as string)) {
        shapeError(`${path}.viaTurnId`, 'a reply no other persona reaction names (one reaction per reply)');
      }
      carriers.add(entry.viaTurnId as string);
    }
  });
}

/** Whether a reaction's turns (its target and, for a persona's, its carrying reply) are all in `turnIds`. */
const standsIn = (reaction: WorkshopTurnReaction, turnIds: ReadonlySet<string>): boolean =>
  turnIds.has(reaction.turnId)
  && (reaction.viaTurnId === undefined || turnIds.has(reaction.viaTurnId));

/** Reactions whose turn, or carrying reply, is not in the ledger. */
export function danglingWorkshopReactions(
  reactions: readonly WorkshopTurnReaction[] | undefined,
  turns: readonly Pick<WorkshopTurn, 'id'>[]
): WorkshopTurnReaction[] {
  if (!reactions || reactions.length === 0) {
    return [];
  }
  const turnIds = new Set(turns.map((turn) => turn.id));
  return reactions.filter((reaction) => !standsIn(reaction, turnIds));
}

/**
 * The reactions that survive in a room of `turnIds`, or undefined when none
 * do, so a room without them writes no key (ADR 2026-11-07 D3). An entry
 * stays when its turn is kept and, for a persona's, its carrying reply too:
 * a persona's reaction goes with the reply that made it, even when the
 * writer message it sits on survives. Used by the checkpoint normalization
 * and by the rewind transform, the one code that cuts a room.
 */
export function workshopReactionsWithin(
  reactions: readonly WorkshopTurnReaction[] | undefined,
  turnIds: ReadonlySet<string>
): WorkshopTurnReaction[] | undefined {
  const kept = (reactions ?? []).filter((reaction) => standsIn(reaction, turnIds));
  return kept.length > 0 ? kept : undefined;
}

/** Whether `reply` is a reply by the persona `author` names, after the turn it reacts to. */
function carriesPersonaReaction(
  author: Exclude<WorkshopTurnReactionAuthor, { kind: 'writer' }>,
  reply: WorkshopTurn
): boolean {
  if (reply.role !== 'assistant' || reply.artifact !== 'persona_message') {
    return false;
  }
  return author.kind === 'host'
    ? reply.participant === 'host'
    : reply.participant === 'guest' && reply.personaId === author.personaId;
}

/** Whether `turn` is a writer room message: the kind of turn a persona's reply answers. */
const isWriterRoomMessage = (turn: WorkshopTurn): boolean =>
  turn.role === 'user' && turn.kind === 'message' && turn.participant === 'writer'
  && turn.artifact === 'persona_message';

/**
 * Whether the reply at `viaPosition` is the one that answers the writer
 * message at `position` for `author` (ADR 2026-11-07 D2, D5; PR #245 M1):
 * that persona's first reply after it, with no later writer room message
 * between them.
 */
function answersWriterMessage(
  author: Exclude<WorkshopTurnReactionAuthor, { kind: 'writer' }>,
  turns: readonly WorkshopTurn[],
  position: number,
  viaPosition: number
): boolean {
  if (viaPosition <= position || !carriesPersonaReaction(author, turns[viaPosition])) {
    return false;
  }
  for (let index = position + 1; index < viaPosition; index += 1) {
    if (isWriterRoomMessage(turns[index]) || carriesPersonaReaction(author, turns[index])) {
      return false;
    }
  }
  return true;
}

/**
 * Referential integrity: every reaction names a turn in the ledger that its
 * author may react to, and a persona's names the reply of that persona that
 * answers the writer message it is on. Raw checkpoint preflight skips the existence rules, because
 * normalization drops a dangling reaction; it never skips the others.
 */
export function assertWorkshopReactionIntegrity(
  reactions: readonly WorkshopTurnReaction[] | undefined,
  turns: readonly WorkshopTurn[],
  options: { allowDanglingTurns?: boolean } = {}
): void {
  if (!reactions || reactions.length === 0) {
    return;
  }
  const positions = new Map(turns.map((turn, index) => [turn.id, index]));
  for (const reaction of reactions) {
    const label = `Persisted Workshop reaction ${reaction.reaction} (${workshopReactionAuthorKey(reaction.author)})`;
    const position = positions.get(reaction.turnId);
    const viaPosition = reaction.viaTurnId === undefined ? undefined : positions.get(reaction.viaTurnId);
    if (position === undefined || (reaction.viaTurnId !== undefined && viaPosition === undefined)) {
      if (options.allowDanglingTurns === true) {
        continue;
      }
      throw new Error(`${label} references an unknown turn`);
    }
    if (!isWorkshopReactableTurn(turns[position], reaction.author)) {
      throw new Error(`${label} is on a turn its author cannot react to`);
    }
    if (reaction.author.kind !== 'writer' && (
      viaPosition === undefined
      || !answersWriterMessage(reaction.author, turns, position, viaPosition)
    )) {
      throw new Error(`${label} does not name its persona's reply to that message`);
    }
  }
}
