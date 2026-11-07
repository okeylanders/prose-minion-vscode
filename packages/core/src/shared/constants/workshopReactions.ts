/**
 * Workshop message reactions (ADR 2026-11-07 D1, D2): the closed vocabulary
 * and the one rule for what may be reacted to.
 *
 * Nothing else names a glyph. A reaction is stored, sent and (from Slice 3)
 * written by a model as its ASCII id; the glyph is drawn only from this
 * registry. Every glyph is Unicode 10 or older, and ❤️ carries its variation
 * selector (U+FE0F) so it draws as the emoji, not the text heart.
 */

import type {
  WorkshopTurn,
  WorkshopTurnReactionAuthor
} from '@messages';

export type WorkshopReactionTone = 'warm' | 'curious' | 'negative';

export interface WorkshopReactionDefinition {
  /** Lower-case kebab ASCII: what is stored and sent. */
  readonly id: string;
  readonly glyph: string;
  /** The reaction's name, as chips and the palette say it. */
  readonly label: string;
  /** The model's gloss (Slice 2's frame and Slice 3's prompt). */
  readonly meaning: string;
  readonly tone: WorkshopReactionTone;
}

export const WORKSHOP_REACTIONS = [
  { id: 'heart', glyph: '❤️', label: 'heart', meaning: 'love this', tone: 'warm' },
  { id: 'thumbs-up', glyph: '👍', label: 'thumbs up', meaning: 'yes, agreed', tone: 'warm' },
  { id: 'raised-hands', glyph: '🙌', label: 'raised hands', meaning: 'celebrate this', tone: 'warm' },
  { id: 'party', glyph: '🎉', label: 'party', meaning: 'a milestone', tone: 'warm' },
  { id: 'fire', glyph: '🔥', label: 'fire', meaning: 'this is strong', tone: 'warm' },
  { id: 'mind-blown', glyph: '🤯', label: 'mind-blown', meaning: "hadn't thought of that", tone: 'warm' },
  { id: 'laughing', glyph: '😂', label: 'laughing', meaning: "that's funny", tone: 'warm' },
  { id: 'sparkles', glyph: '✨', label: 'sparkles', meaning: 'delightful', tone: 'warm' },
  { id: 'hundred', glyph: '💯', label: 'hundred', meaning: 'exactly right', tone: 'warm' },
  { id: 'thanks', glyph: '🙏', label: 'thanks', meaning: 'thank you', tone: 'warm' },
  { id: 'thinking', glyph: '🤔', label: 'thinking', meaning: 'mulling it over', tone: 'curious' },
  { id: 'eyes', glyph: '👀', label: 'eyes', meaning: 'intrigued', tone: 'curious' },
  { id: 'surprised', glyph: '😮', label: 'surprised', meaning: "didn't see that coming", tone: 'curious' },
  { id: 'thumbs-down', glyph: '👎', label: 'thumbs down', meaning: 'not this', tone: 'negative' },
  { id: 'sad', glyph: '😢', label: 'sad', meaning: 'this hurts, or this moved me', tone: 'negative' },
  { id: 'grimace', glyph: '😬', label: 'grimace', meaning: 'oof', tone: 'negative' },
  { id: 'confused', glyph: '😕', label: 'confused', meaning: 'this lost me', tone: 'negative' },
  { id: 'eye-roll', glyph: '🙄', label: 'eye roll', meaning: 'come on', tone: 'negative' },
  { id: 'frustrated', glyph: '😤', label: 'frustrated', meaning: 'annoyed', tone: 'negative' }
] as const satisfies readonly WorkshopReactionDefinition[];

export type WorkshopReactionId = typeof WORKSHOP_REACTIONS[number]['id'];

/** The palette's groups, in order, with the names they are announced by. */
export const WORKSHOP_REACTION_TONES: readonly { tone: WorkshopReactionTone; label: string }[] = [
  { tone: 'warm', label: 'Warm' },
  { tone: 'curious', label: 'Curious' },
  { tone: 'negative', label: 'Negative' }
];

const BY_ID: ReadonlyMap<string, WorkshopReactionDefinition> = new Map(
  WORKSHOP_REACTIONS.map((reaction) => [reaction.id, reaction])
);

export const isWorkshopReactionId = (value: unknown): value is WorkshopReactionId =>
  typeof value === 'string' && BY_ID.has(value);

export const workshopReaction = (id: WorkshopReactionId): WorkshopReactionDefinition => BY_ID.get(id)!;

/** The turn facts the rule reads; the bubble, the ledger and the codec pass the same turn. */
export type WorkshopReactableTurnFacts = Pick<WorkshopTurn, 'role' | 'kind' | 'participant' | 'artifact'>
  & Partial<Pick<WorkshopTurn, 'capability' | 'reactionOnly'>>;

/**
 * A persona reply in the room the writer may react to: a host or guest
 * answer, or the host's synthesis of a report (a `tool_run` turn), never a
 * tool's report, a capability card, or a reply that held only a reaction
 * (Q10: there is nothing there to react to but the reaction).
 */
const isPersonaReply = (turn: WorkshopReactableTurnFacts): boolean =>
  turn.role === 'assistant'
  && (turn.participant === 'host' || turn.participant === 'guest')
  && (turn.artifact === 'persona_message' || turn.artifact === 'persona_synthesis')
  && turn.capability === undefined
  && turn.reactionOnly === undefined;

/** The writer's own message to the room's personas (never a direct tool message). */
const isWriterRoomMessage = (turn: WorkshopReactableTurnFacts): boolean =>
  turn.role === 'user'
  && turn.kind === 'message'
  && turn.participant === 'writer'
  && turn.artifact === 'persona_message';

/**
 * What `author` may react to (ADR 2026-11-07 D2, Q4, Q10): one rule, read by
 * the codec, the host's ledger (the authority) and the bubble (which offers
 * the palette only where the host would accept it).
 *
 * - The writer reacts to a persona reply (a host or guest answer). Never a
 *   tool report, a capability card, a divider, a context change, their own
 *   message, or a reaction-only reply (Q10).
 * - A persona reacts only to the writer's message. That its reply answers
 *   that message is the records' check (`viaTurnId`), not this one; a
 *   reaction-only reply carries it like any other reply (PR #245 N3).
 */
export function isWorkshopReactableTurn(
  turn: WorkshopReactableTurnFacts,
  author: WorkshopTurnReactionAuthor
): boolean {
  return author.kind === 'writer' ? isPersonaReply(turn) : isWriterRoomMessage(turn);
}

/** `writer`, `host`, or `guest:<personaId>`: ids only, safe for a log. */
export function workshopReactionAuthorKey(author: WorkshopTurnReactionAuthor): string {
  return author.kind === 'personaGuest' ? `guest:${author.personaId}` : author.kind;
}

/** Whether two authors are the same participant. */
export function isSameWorkshopReactionAuthor(
  left: WorkshopTurnReactionAuthor,
  right: WorkshopTurnReactionAuthor
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  return left.kind !== 'personaGuest' || left.personaId === (right as typeof left).personaId;
}
