/**
 * `projectMemoryDelivery` on a persisted turn (ADR 2026-11-04 D14, D12):
 * what project memory a writer turn delivered, per participant. An
 * optional, additive turn field: a session without it reads and writes
 * exactly as before, and it needs no `schemaVersion` bump (ADR 2026-07-30;
 * ADR 2026-11-03 D9). Called from the session shape file.
 *
 * When present it is exact: on a persona reply (`role: 'assistant'`, a host
 * or guest turn), one `{ participant, kind, memories }` naming that reply's
 * own participant, each memory `{ id, version }` with the `mem-` id shape, a
 * 12-hex version, and each id at most once. It rides the reply, never the
 * writer turn, so a cut that removes the reply removes the record with the
 * history that received it (PR #198 F-01).
 */

import type { WorkshopProjectMemoryDelivery } from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import { isWorkshopPersonaId } from '@shared/constants/workshopPersonas';
import { PROJECT_MEMORY_ID } from '@shared/types/projectMemory';
import {
  arrayOf,
  boundedArrayAt,
  enumAt,
  exactObject,
  shapeError
} from '@/application/services/workshop/persistedValidation';

/** The most memories one snapshot records: a bound on persisted data no prompt states. */
export const WORKSHOP_PROJECT_MEMORY_DELIVERY_LIMITS = Object.freeze({ memories: 4_096 });

const VERSION = /^[0-9a-f]{12}$/;

/** Strict structure of a turn's `projectMemoryDelivery`; refused on any turn but a persona reply, or for another participant. */
export function assertWorkshopProjectMemoryDeliveryShape(
  value: unknown,
  path: string,
  turn: { readonly role?: unknown; readonly participant?: unknown; readonly personaId?: unknown }
): void {
  if (turn.role !== 'assistant' || (turn.participant !== 'host' && turn.participant !== 'guest')) {
    shapeError(path, 'a record on a persona reply');
  }
  const participants = new Set<string>();
  arrayOf(value, path, (item, itemPath) => {
    const delivery = exactObject(item, itemPath, ['participant', 'kind', 'memories']);
    const participant = exactObject(delivery.participant, `${itemPath}.participant`, ['kind'], ['personaId']);
    enumAt(participant.kind, `${itemPath}.participant.kind`, ['host', 'personaGuest']);
    if (participant.kind === 'personaGuest' ? !isWorkshopPersonaId(participant.personaId) : participant.personaId !== undefined) {
      shapeError(`${itemPath}.participant.personaId`, participant.kind === 'personaGuest' ? 'known Workshop persona id' : 'absent for a host');
    }
    const key = workshopProjectMemoryParticipantKey(participant as unknown as WorkshopCapabilityPrincipal);
    if (participants.has(key)) {
      shapeError(`${itemPath}.participant`, 'each participant once per turn');
    }
    participants.add(key);
    const own = turn.participant === 'host' ? 'host' : `guest:${String(turn.personaId)}`;
    if (key !== own) {
      shapeError(`${itemPath}.participant`, 'the reply\'s own participant');
    }
    enumAt(delivery.kind, `${itemPath}.kind`, ['frame', 'note']);
    boundedArrayAt(delivery.memories, `${itemPath}.memories`, 0, WORKSHOP_PROJECT_MEMORY_DELIVERY_LIMITS.memories, 'delivered memories');
    const ids = new Set<string>();
    arrayOf(delivery.memories, `${itemPath}.memories`, (memory, memoryPath) => {
      const delivered = exactObject(memory, memoryPath, ['id', 'version']);
      if (typeof delivered.id !== 'string' || !PROJECT_MEMORY_ID.test(delivered.id) || ids.has(delivered.id)) {
        shapeError(`${memoryPath}.id`, 'a memory id (mem- and six hex digits), each once');
      }
      ids.add(delivered.id);
      if (typeof delivered.version !== 'string' || !VERSION.test(delivered.version)) {
        shapeError(`${memoryPath}.version`, 'a memory version (12 hex digits)');
      }
    });
  });
}

/** One key per conversation: the host's, or a guest's. */
export function workshopProjectMemoryParticipantKey(participant: WorkshopCapabilityPrincipal): string {
  return participant.kind === 'host' ? 'host' : `guest:${participant.personaId}`;
}

/** A turn's records with `delivery` in place of that participant's earlier one. */
export function withWorkshopProjectMemoryDelivery(
  existing: readonly WorkshopProjectMemoryDelivery[] | undefined,
  delivery: WorkshopProjectMemoryDelivery
): WorkshopProjectMemoryDelivery[] {
  const key = workshopProjectMemoryParticipantKey(delivery.participant);
  return [
    ...(existing ?? []).filter((record) => workshopProjectMemoryParticipantKey(record.participant) !== key),
    {
      participant: { ...delivery.participant },
      kind: delivery.kind,
      memories: delivery.memories.map(({ id, version }) => ({ id, version }))
    }
  ];
}
