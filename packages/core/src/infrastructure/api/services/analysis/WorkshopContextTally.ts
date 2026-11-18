/**
 * What the Workshop measures as it writes a message (ADR 2026-11-18 D3, D6).
 *
 * Every frame the host puts into a turn's opening message is added to that
 * run's recorder under one closed piece id, with the engine's estimator
 * (`estimateTextTokens`, the Memory tab meter's). The engine asks the
 * recorder for its pieces once, when the turn commits, and stores them
 * beside the manifest: one entry per message, never one per frame.
 *
 * Logs and the stored entry carry piece ids and numbers, never text.
 */

import type { ContextBreakdownPartId } from '@shared/types';
import { estimateTextTokens } from '@orchestration/RequestContextPreflight';

interface WorkshopContextTallyPieceSpec {
  readonly part: ContextBreakdownPartId;
  /** The host's name, shown when the part opens. */
  readonly name: string;
}

/**
 * The closed list of what a message can hold that is not the writer's
 * message or a reply. A new frame joins here, under its part, and the
 * panel shows it with no further work.
 */
export const WORKSHOP_CONTEXT_TALLY_PIECES = Object.freeze({
  'tool-use.contract': { part: 'tool-use', name: 'Contract in the first message' },
  'tool-use.reminder': { part: 'tool-use', name: 'Turn reminders' },
  'memory.start': { part: 'memory', name: 'Start block' },
  'memory.update': { part: 'memory', name: 'Update notes' },
  'todos.snapshot': { part: 'todos', name: 'Snapshots' },
  'room.catch-up': { part: 'room-notes', name: 'Catch-ups' },
  'room.join': { part: 'room-notes', name: 'Join transcript' },
  'room.reactions': { part: 'room-notes', name: 'Reactions' },
  'room.time': { part: 'room-notes', name: 'The time' },
  'room.behavior': { part: 'room-notes', name: 'Behavior and mode' },
  'room.reminders': { part: 'room-notes', name: 'Reminders and invites' },
  'room.trailer-outcomes': { part: 'room-notes', name: 'What became of notes and edits' },
  'room.directive': { part: 'room-notes', name: 'Edit-offer requests' },
  'context.excerpt': { part: 'excerpt-context', name: 'Excerpt or room subject' },
  'context.updates': { part: 'excerpt-context', name: 'Excerpt and context updates' },
  'context.attachments': { part: 'excerpt-context', name: 'Standing context' },
  'context.message-attachments': { part: 'excerpt-context', name: 'Message attachments' }
} satisfies Record<string, WorkshopContextTallyPieceSpec>);

export type WorkshopContextTallyPiece = keyof typeof WORKSHOP_CONTEXT_TALLY_PIECES;

export const isWorkshopContextTallyPiece = (id: string): id is WorkshopContextTallyPiece =>
  Object.prototype.hasOwnProperty.call(WORKSHOP_CONTEXT_TALLY_PIECES, id);

/** One run's measure of its opening message. Minted per run by the room handler. */
export class WorkshopContextTallyRecorder {
  private readonly pieces = new Map<WorkshopContextTallyPiece, number>();

  /** Adds the estimate of each text given; absent and empty texts add nothing. */
  add(piece: WorkshopContextTallyPiece, ...texts: ReadonlyArray<string | undefined>): void {
    const tokens = texts.reduce((sum, text) => sum + (text ? estimateTextTokens(text) : 0), 0);
    if (tokens > 0) {
      this.pieces.set(piece, (this.pieces.get(piece) ?? 0) + tokens);
    }
  }

  /**
   * The pieces as the engine stores them. Always a record, empty included, so
   * every committed turn has its entry and entry 0 marks a fully measured
   * conversation (D7).
   */
  snapshot(): Record<string, number> {
    return Object.fromEntries(this.pieces);
  }
}

/**
 * The capability's contract or turn reminder, joined as it always was
 * (`[message, ...frames].join('\n\n')`), with each frame tallied under its
 * piece. Frames keep the order given; `undefined` ones are left out.
 */
export function workshopTalliedContract(
  tally: WorkshopContextTallyRecorder | undefined,
  userMessage: string,
  frames: ReadonlyArray<readonly [WorkshopContextTallyPiece, string | undefined]>
): string {
  const present = frames.filter((frame): frame is readonly [WorkshopContextTallyPiece, string] => frame[1] !== undefined);
  for (const [piece, text] of present) tally?.add(piece, text);
  return [userMessage, ...present.map(([, text]) => text)].join('\n\n');
}
