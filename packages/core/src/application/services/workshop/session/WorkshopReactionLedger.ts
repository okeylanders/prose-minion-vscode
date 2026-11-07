/**
 * Session-owned ledger for message reactions (ADR 2026-11-07 D2, D4).
 *
 * Modeled on `WorkshopBookmarkLedger`: defensive copies, idempotent changes
 * and prepared hydration. Identity is the triple `(turnId, author,
 * reaction)`, so there is no id to mint. The ledger knows what may be reacted
 * to (`isWorkshopReactableTurn`); the aggregate supplies the turns, and every
 * change runs inside the room's mutation gate.
 *
 * No reaction starts a model call: nothing here, and nothing that calls it,
 * reaches a run. Delivery to personas is Slice 2's (D4, D6).
 */

import type {
  WorkshopPersonaId,
  WorkshopTurn,
  WorkshopTurnReaction,
  WorkshopTurnReactionAuthor,
  WorkshopTurnReactionSummary
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopPersonaLabel } from '@shared/constants/workshopPersonas';
import {
  isSameWorkshopReactionAuthor,
  isWorkshopReactableTurn,
  type WorkshopReactionId
} from '@shared/constants/workshopReactions';

/** What the thread calls the writer. */
const WRITER_LABEL = 'You';

export type WorkshopReactionRefusalReason =
  | 'unknown-turn'
  | 'ineligible-turn'
  | 'session-full';

/** A reaction change the host refused. Its message is display copy and names no content. */
export class WorkshopReactionRefusedError extends Error {
  constructor(readonly reason: WorkshopReactionRefusalReason, message: string) {
    super(message);
    this.name = 'WorkshopReactionRefusedError';
  }
}

/* eslint-disable @typescript-eslint/naming-convention -- keyed by the reasons' kebab-case words. */
const REFUSAL_MESSAGES: Readonly<Record<WorkshopReactionRefusalReason, string>> = {
  'unknown-turn': 'That message is no longer in this session.',
  'ineligible-turn': 'Only a persona\'s reply can take a reaction.',
  'session-full': 'This session holds as many reactions as it can.'
};
/* eslint-enable @typescript-eslint/naming-convention */

const refused = (reason: WorkshopReactionRefusalReason): WorkshopReactionRefusedError =>
  new WorkshopReactionRefusedError(reason, REFUSAL_MESSAGES[reason]);

/** What an add or remove did; an unchanged answer needs no save. */
export type WorkshopReactionChange = 'added' | 'removed' | 'unchanged';

/** One reaction to add. A persona's names the reply that carried it. */
export interface WorkshopReactionAddition {
  turnId: string;
  reaction: WorkshopReactionId;
  author: WorkshopTurnReactionAuthor;
  viaTurnId?: string;
}

/** The identity triple. */
export type WorkshopReactionIdentity = Pick<WorkshopTurnReaction, 'turnId' | 'author' | 'reaction'>;

const cloneAuthor = (author: WorkshopTurnReactionAuthor): WorkshopTurnReactionAuthor =>
  author.kind === 'personaGuest' ? { kind: 'personaGuest', personaId: author.personaId } : { kind: author.kind };

const cloneReaction = (reaction: WorkshopTurnReaction): WorkshopTurnReaction => ({
  turnId: reaction.turnId,
  reaction: reaction.reaction,
  author: cloneAuthor(reaction.author),
  ...(reaction.viaTurnId !== undefined ? { viaTurnId: reaction.viaTurnId } : {}),
  createdAt: reaction.createdAt
});

const matches = (reaction: WorkshopTurnReaction, identity: WorkshopReactionIdentity): boolean =>
  reaction.turnId === identity.turnId
  && reaction.reaction === identity.reaction
  && isSameWorkshopReactionAuthor(reaction.author, identity.author);

export class WorkshopReactionLedger {
  private reactions: WorkshopTurnReaction[] = [];

  constructor(private readonly now: () => number) {}

  /**
   * Add one reaction. Needs the turn, and one its author may react to;
   * adding a reaction already given changes nothing.
   */
  add(addition: WorkshopReactionAddition, turn: Readonly<WorkshopTurn> | undefined): WorkshopReactionChange {
    if (!turn || turn.id !== addition.turnId) {
      throw refused('unknown-turn');
    }
    if (!isWorkshopReactableTurn(turn, addition.author)) {
      throw refused('ineligible-turn');
    }
    if (this.reactions.some((reaction) => matches(reaction, addition))) {
      return 'unchanged';
    }
    if (this.reactions.length >= PROMPT_BUDGETS.workshopReactions.perSession) {
      throw refused('session-full');
    }
    this.reactions.push(cloneReaction({ ...addition, createdAt: this.now() }));
    return 'added';
  }

  /** Remove one reaction; removing one that is not there changes nothing. */
  remove(identity: WorkshopReactionIdentity): WorkshopReactionChange {
    const index = this.reactions.findIndex((reaction) => matches(reaction, identity));
    if (index < 0) {
      return 'unchanged';
    }
    this.reactions.splice(index, 1);
    return 'removed';
  }

  /** Keep only reactions whose turn (and carrying reply) still exist; returns how many went. */
  pruneTo(turnIds: ReadonlySet<string>): number {
    const before = this.reactions.length;
    this.reactions = this.reactions.filter((reaction) =>
      turnIds.has(reaction.turnId)
      && (reaction.viaTurnId === undefined || turnIds.has(reaction.viaTurnId)));
    return before - this.reactions.length;
  }

  list(): WorkshopTurnReaction[] {
    return this.reactions.map(cloneReaction);
  }

  /**
   * Display-safe summaries for the turns in `windowTurns`, in thread order,
   * each turn's writer reactions first. `findTurn` reads the whole ledger, so
   * a host reaction is named by the persona who wrote its reply even when
   * that reply is outside the window; `hostPersonaId` names it otherwise.
   */
  summaries(
    windowTurns: readonly Readonly<WorkshopTurn>[],
    findTurn: (turnId: string) => Readonly<WorkshopTurn> | undefined,
    hostPersonaId: WorkshopPersonaId
  ): WorkshopTurnReactionSummary[] {
    if (this.reactions.length === 0) {
      return [];
    }
    const byTurn = new Map<string, WorkshopTurnReaction[]>();
    for (const reaction of this.reactions) {
      const list = byTurn.get(reaction.turnId) ?? [];
      list.push(reaction);
      byTurn.set(reaction.turnId, list);
    }
    const labelOf = (reaction: WorkshopTurnReaction): string => {
      switch (reaction.author.kind) {
        case 'writer': return WRITER_LABEL;
        case 'personaGuest': return workshopPersonaLabel(reaction.author.personaId);
        case 'host': {
          const reply = reaction.viaTurnId === undefined ? undefined : findTurn(reaction.viaTurnId);
          return reply?.personaLabel ?? workshopPersonaLabel(reply?.personaId ?? hostPersonaId);
        }
      }
    };
    return windowTurns.flatMap((turn) => {
      const list = byTurn.get(turn.id) ?? [];
      return [
        ...list.filter((reaction) => reaction.author.kind === 'writer'),
        ...list.filter((reaction) => reaction.author.kind !== 'writer')
      ].map((reaction) => ({
        turnId: reaction.turnId,
        reaction: reaction.reaction,
        author: cloneAuthor(reaction.author),
        label: labelOf(reaction),
        ...(reaction.viaTurnId !== undefined ? { viaTurnId: reaction.viaTurnId } : {})
      }));
    });
  }

  /** Complete every potentially throwing clone before aggregate installation. */
  prepareState(reactions: readonly WorkshopTurnReaction[]): WorkshopTurnReaction[] {
    return reactions.map(cloneReaction);
  }

  /** Install state produced by this ledger's prepare phase; this must not throw. */
  installPreparedState(reactions: WorkshopTurnReaction[]): void {
    this.reactions = reactions;
  }

  reset(): void {
    this.reactions = [];
  }
}
