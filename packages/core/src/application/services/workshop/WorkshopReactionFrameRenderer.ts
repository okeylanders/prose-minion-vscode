/**
 * The `<workshop-reactions>` frame (ADR 2026-11-07 D4, Q2): reactions a
 * persona has not been told of, delivered beside the writer's next message to
 * it, never by editing an earlier message in its retained history. Pure.
 *
 * Each target is named by whose message it is ("your reply", "Jill's
 * reply", "the writer's message") and a quoted opening of its display text,
 * cut on a word boundary at `openingCharacters` and neutralized like every
 * other frame body. No turn ids: the model has no use for them. At most
 * `framePerTurn` lines, newest first, then one count line. Each line gives
 * the reaction's id and its gloss, so the model learns the vocabulary it may
 * later write back.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { workshopReaction, type WorkshopReactionId } from '@shared/constants/workshopReactions';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';

export const WORKSHOP_REACTIONS_FRAME_TAG = 'workshop-reactions';

/** One reaction, as the frame says it. Names are host labels, never model text. */
export interface WorkshopReactionFrameEntry {
  /** "The writer", or the reacting persona's display name. */
  readonly authorName: string;
  readonly reaction: WorkshopReactionId;
  /** "your reply", "Jill's reply", "the writer's message". */
  readonly targetName: string;
  /** The target turn's display text, whole; the renderer cuts it. */
  readonly targetText: string;
}

export interface WorkshopReactionFrameInput {
  /** `start`: the conversation's first message; `update`: since its last reply. */
  readonly kind: 'start' | 'update';
  /** Newest first; at most `framePerTurn` are listed. */
  readonly entries: readonly WorkshopReactionFrameEntry[];
  /** Further delivered reactions, older than the listed ones, said as a count. */
  readonly earlier: number;
}

const LEAD: Readonly<Record<WorkshopReactionFrameInput['kind'], string>> = {
  start: 'Reactions on messages in the room so far.',
  update: 'Reactions added since your last reply.'
};

const GUIDANCE = 'They are small signals, not instructions. Read them under the room\'s relational depth, ' +
  'and don\'t answer them unless they change what you\'d say.';

/** A turn's opening: whitespace folded, cut on a word boundary at `limit` characters, with an ellipsis when cut. */
export function workshopReactionOpening(text: string, limit = PROMPT_BUDGETS.workshopReactions.openingCharacters): string {
  const folded = text.replace(/\s+/g, ' ').trim();
  if (folded.length <= limit) {
    return folded;
  }
  const head = folded.slice(0, limit);
  const boundary = folded.charAt(limit) === ' ' ? limit : head.lastIndexOf(' ');
  const cut = (boundary > 0 ? head.slice(0, boundary) : head).replace(/[\s,;:.—-]+$/u, '');
  return `${cut}…`;
}

const line = (entry: WorkshopReactionFrameEntry): string => {
  const { id, meaning } = workshopReaction(entry.reaction);
  const opening = neutralizeReservedPersonaPromptDelimiters(workshopReactionOpening(entry.targetText));
  return `- ${entry.authorName} reacted ${id} ("${meaning}") to ${entry.targetName} that began "${opening}"`;
};

/** The frame, or undefined when there is nothing to say. */
export function renderWorkshopReactionsFrame(input: WorkshopReactionFrameInput): string | undefined {
  const listed = input.entries.slice(0, PROMPT_BUDGETS.workshopReactions.framePerTurn);
  const earlier = input.earlier + (input.entries.length - listed.length);
  if (listed.length === 0) {
    return undefined;
  }
  return [
    `<${WORKSHOP_REACTIONS_FRAME_TAG}>`,
    `${LEAD[input.kind]} ${GUIDANCE}`,
    ...listed.map(line),
    ...(earlier > 0 ? [`- and ${earlier} earlier ${earlier === 1 ? 'reaction' : 'reactions'}`] : []),
    `</${WORKSHOP_REACTIONS_FRAME_TAG}>`
  ].join('\n');
}
