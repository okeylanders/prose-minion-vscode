/**
 * Who a new memory came from, as the host fills it (ADR 2026-11-04 D6): a
 * trailer may name none of it. A persona's proposal names its persona, the
 * live session, and the reply with the writer turn that prompted it; a
 * writer's own save names the turns it was saved from. Both write routes
 * (the writer's Save, and Save and tell me's: Slice 5) read it here.
 *
 * **Cited turns** (ADR 2026-11-05 D10). A proposal may cite open-room turns
 * (`cites`), by the ids `transcript.bookmarks` showed. One is kept only when
 * the open room's ledger holds it and the proposing persona could see it, by
 * the room's own rule (`isWorkshopTurnVisibleToParticipant`); it then joins
 * `sourceTurns` after the writer's message and the reply, each once, within
 * `PROJECT_MEMORY_LIST_ENTRIES.sourceTurns`. Anything else (a saved
 * session's ref, a `current@…` ref, a turn the persona couldn't see, or none
 * at all) is dropped and named, by id, for the caller's log. `sourceSession`
 * stays the live room, so one session holds every source.
 */

import type { WorkshopMemoryProposal, WorkshopTurn } from '@messages';
import { PROJECT_MEMORY_LIST_ENTRIES, PROJECT_MEMORY_SOURCE_TURN } from '@shared/types/projectMemory';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import type { ProjectMemorySaveProvenance } from '@/application/services/workshop/memory/ProjectMemoryWrites';
import {
  isWorkshopTurnVisibleToParticipant,
  workshopGuestPrincipal
} from '@/application/services/workshop/WorkshopRoomAudience';

/** Why a cited turn was dropped: by id, never by text. */
export type WorkshopCitedTurnDrop = 'not-a-turn' | 'not-in-room' | 'not-visible';

/** A cited turn the host refused, with why; the caller logs it by id. */
export interface WorkshopDroppedCite {
  readonly id: string;
  readonly reason: WorkshopCitedTurnDrop;
}

/** A persona's proposal on `turn`, saved by the writer (`proposed`) or by Save and tell me (`auto`). */
export function workshopProposalProvenance(
  ledger: readonly WorkshopTurn[],
  turn: WorkshopTurn,
  liveSessionId: string | undefined,
  origin: 'proposed' | 'auto',
  proposal?: WorkshopMemoryProposal,
  onDropped?: (dropped: readonly WorkshopDroppedCite[]) => void
): ProjectMemorySaveProvenance {
  const index = ledger.findIndex((candidate) => candidate.id === turn.id);
  const prompted = ledger.slice(0, Math.max(index, 0)).reverse()
    .find((candidate) => candidate.participant === 'writer' && candidate.kind === 'message');
  const cited = workshopCitedTurns(ledger, turn, proposal?.proposes === 'new' ? proposal.cites ?? [] : []);
  if (cited.dropped.length > 0) {
    onDropped?.(cited.dropped);
  }
  const sourceTurns = liveSessionId
    ? [...new Set([prompted?.id, turn.id, ...cited.kept].filter(isSourceTurn))].slice(0, PROJECT_MEMORY_LIST_ENTRIES.sourceTurns)
    : [];
  return {
    origin,
    ...(turn.personaId ? { proposedBy: turn.personaId } : {}),
    ...(liveSessionId ? { sourceSession: liveSessionId } : {}),
    sourceTurns
  };
}

/** The writer's own save, from the turns named (none for New). */
export function workshopWriterProvenance(turnIds: readonly string[], liveSessionId: string | undefined): ProjectMemorySaveProvenance {
  const sourceTurns = liveSessionId ? turnIds.filter(isSourceTurn) : [];
  return {
    origin: 'writer',
    ...(liveSessionId && sourceTurns.length > 0 ? { sourceSession: liveSessionId } : {}),
    sourceTurns
  };
}

/**
 * A memory saved from a saved session's turn (ADR 2026-11-05 D9): its one
 * source is that session. The caller has checked the turn through recall.
 */
export function workshopSavedTurnProvenance(sessionId: string, turnId: string): ProjectMemorySaveProvenance {
  return { origin: 'writer', sourceSession: sessionId, sourceTurns: [turnId] };
}

/** The cited turns the host keeps, in the order cited, and those it drops, by id. */
export function workshopCitedTurns(
  ledger: readonly WorkshopTurn[],
  turn: WorkshopTurn,
  cites: readonly string[]
): { kept: string[]; dropped: WorkshopDroppedCite[] } {
  const kept: string[] = [];
  const dropped: WorkshopDroppedCite[] = [];
  if (cites.length === 0) {
    return { kept, dropped };
  }
  const reader = proposerOf(turn);
  const byId = new Map(ledger.map((candidate) => [candidate.id, candidate]));
  for (const id of cites) {
    const cited = isSourceTurn(id) ? byId.get(id) : undefined;
    const reason: WorkshopCitedTurnDrop | undefined = !isSourceTurn(id)
      ? 'not-a-turn'
      : !cited
        ? 'not-in-room'
        : !reader || !isWorkshopTurnVisibleToParticipant(cited, reader) ? 'not-visible' : undefined;
    if (reason) {
      dropped.push({ id, reason });
    } else {
      kept.push(id);
    }
  }
  return { kept, dropped };
}

/** The persona whose reply carried the proposal, as the room's audience rule names it. */
function proposerOf(turn: WorkshopTurn): WorkshopCapabilityPrincipal | undefined {
  if (turn.participant === 'host') {
    return { kind: 'host' };
  }
  return turn.participant === 'guest' && turn.personaId ? workshopGuestPrincipal(turn.personaId) : undefined;
}

function isSourceTurn(id: string | undefined): id is string {
  return typeof id === 'string' && PROJECT_MEMORY_SOURCE_TURN.test(id);
}
