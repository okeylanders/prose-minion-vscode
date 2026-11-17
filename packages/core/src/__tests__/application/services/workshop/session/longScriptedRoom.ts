/** A scripted room long enough to outgrow the snapshot window (ADR 2026-11-17, item A). */

import type { WorkshopTurn } from '@messages';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';

/** A room of `exchanges` questions to the host, each answered: two turns apiece, after the start marker. */
export function longScriptedRoom(exchanges: number): { room: ScriptedWorkshopRoom; replies: WorkshopTurn[] } {
  const room = new ScriptedWorkshopRoom().start();
  const replies = Array.from({ length: exchanges }, (_, index) =>
    room.hostMessage(`Question ${index + 1}: does the White Rabbit run late?`));
  return { room, replies };
}
