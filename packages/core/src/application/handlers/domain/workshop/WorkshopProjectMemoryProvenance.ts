/**
 * Who a new memory came from, as the host fills it (ADR 2026-11-04 D6): a
 * trailer may name none of it. A persona's proposal names its persona, the
 * live session, and the reply with the writer turn that prompted it; a
 * writer's own save names the turns it was saved from. Both write routes
 * (the writer's Save, and Save and tell me's: Slice 5) read it here.
 */

import type { WorkshopTurn } from '@messages';
import { PROJECT_MEMORY_SOURCE_TURN } from '@shared/types/projectMemory';
import type { ProjectMemorySaveProvenance } from '@/application/services/workshop/memory/ProjectMemoryWrites';

/** A persona's proposal on `turn`, saved by the writer (`proposed`) or by Save and tell me (`auto`). */
export function workshopProposalProvenance(
  ledger: readonly WorkshopTurn[],
  turn: WorkshopTurn,
  liveSessionId: string | undefined,
  origin: 'proposed' | 'auto'
): ProjectMemorySaveProvenance {
  const index = ledger.findIndex((candidate) => candidate.id === turn.id);
  const prompted = ledger.slice(0, Math.max(index, 0)).reverse()
    .find((candidate) => candidate.participant === 'writer' && candidate.kind === 'message');
  return {
    origin,
    ...(turn.personaId ? { proposedBy: turn.personaId } : {}),
    ...(liveSessionId ? { sourceSession: liveSessionId } : {}),
    sourceTurns: liveSessionId ? [prompted?.id, turn.id].filter(isSourceTurn) : []
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

function isSourceTurn(id: string | undefined): id is string {
  return typeof id === 'string' && PROJECT_MEMORY_SOURCE_TURN.test(id);
}
