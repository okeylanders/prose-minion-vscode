/** Content comparison for recovery copies; never use this to authorize writes. */
import { isDeepStrictEqual } from 'util';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  WorkshopPersistedSessionV2
} from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopTurn } from '@messages';

const RESUME_MARKER_KEYS = [
  'artifact', 'content', 'excerptVersion', 'id', 'kind', 'participant', 'role', 'timestamp'
];

function isAutomaticResumeMarker(turn: WorkshopTurn): boolean {
  return turn.role === 'system' && turn.kind === 'divider' &&
    turn.participant === 'session' && turn.artifact === 'session_resume' &&
    turn.content.startsWith('Session resumed ') &&
    isDeepStrictEqual(Object.keys(turn).sort(), RESUME_MARKER_KEYS);
}

export function hasSameWorkshopRecoveryContent(
  left: WorkshopPersistedSessionV2,
  right: WorkshopPersistedSessionV2
): boolean {
  const normalize = (value: WorkshopPersistedSessionV2): unknown => {
    const { savedAt, updatedAt, summary, temporal, workshop, ...identity } =
      decodeWorkshopPersistedSessionCheckpoint(value).session;
    const { lastActivityAt, ...meaningfulTemporal } = temporal;
    const turns = workshop.turns.filter((turn) => !isAutomaticResumeMarker(turn));
    // Decoding can advance participant cursors over automatic dividers. Map
    // those cursors back to the last content turn, retaining all other cursor
    // differences so provider continuity is still part of recovery eligibility.
    const resumePredecessors = new Map<string, string | undefined>();
    let previousContentId: string | undefined;
    for (const turn of workshop.turns) {
      if (isAutomaticResumeMarker(turn)) {
        resumePredecessors.set(turn.id, previousContentId);
      } else {
        previousContentId = turn.id;
      }
    }
    const contentCursor = (id: string | undefined): string | undefined =>
      id && resumePredecessors.has(id) ? resumePredecessors.get(id) : id;
    return JSON.parse(JSON.stringify({
      ...identity,
      temporal: meaningfulTemporal,
      workshop: {
        ...workshop,
        turns,
        participants: {
          ...workshop.participants,
          host: {
            ...workshop.participants.host,
            lastSeenRoomTurnId: contentCursor(workshop.participants.host.lastSeenRoomTurnId)
          },
          personaGuests: workshop.participants.personaGuests.map((guest) => ({
            ...guest,
            lastSeenRoomTurnId: contentCursor(guest.lastSeenRoomTurnId)
          }))
        },
        counters: {
          ...workshop.counters,
          turn: workshop.counters.turn - (workshop.turns.length - turns.length)
        }
      }
    }));
  };
  return isDeepStrictEqual(normalize(left), normalize(right));
}
