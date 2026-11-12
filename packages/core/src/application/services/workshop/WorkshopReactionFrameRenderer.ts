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
  // Neutral: a reaction held back (catch-up deferred its turn, or the bound) arrives later than "since your last reply".
  update: 'Reactions you haven\'t been told of yet.'
};

// Slice 4a (ADR 2026-11-07, 2026-11-10 addendum): "let them shape your reply", replacing D4's "don't answer them".
const GUIDANCE = 'They are small signals, not instructions. Let them shape your reply, read under the room\'s ' +
  'relational depth; never thank for them or list them back.';

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;

/**
 * A turn's opening: whitespace folded, cut on a word boundary at `limit`
 * characters (UTF-16 code units), with an ellipsis when cut. With no space to
 * cut at, it cuts hard, never inside a surrogate pair.
 */
export function workshopReactionOpening(text: string, limit = PROMPT_BUDGETS.workshopReactions.openingCharacters): string {
  const folded = text.replace(/\s+/g, ' ').trim();
  if (folded.length <= limit) {
    return folded;
  }
  const end = isHighSurrogate(folded.charCodeAt(limit - 1)) ? limit - 1 : limit;
  const head = folded.slice(0, end);
  const boundary = folded.charAt(limit) === ' ' ? limit : head.lastIndexOf(' ');
  const cut = (boundary > 0 ? head.slice(0, boundary) : head).replace(/[\s,;:.—-]+$/u, '');
  return `${cut}…`;
}

const line = (entry: WorkshopReactionFrameEntry): string => {
  const { id, meaning } = workshopReaction(entry.reaction);
  // An inner double quote is escaped, so the quoted opening has one reading.
  const opening = neutralizeReservedPersonaPromptDelimiters(workshopReactionOpening(entry.targetText)).replace(/"/g, '\\"');
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
