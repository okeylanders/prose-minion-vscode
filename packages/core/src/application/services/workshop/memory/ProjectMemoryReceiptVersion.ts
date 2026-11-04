/**
 * A memory's version as a receipt records it (ADR 2026-11-04 D7, D14): the
 * first 12 hex characters of a SHA-256 over its canonical id, title, kind,
 * summary, body, pinned flag and effective standing. Computed, never stored.
 *
 * Slice 2b owns D14's version for the delivery record. When its fold lands,
 * receipts take that one function, and this module goes (Slice 3's fold
 * step); until then this follows D14's definition so the receipts written
 * meanwhile carry a version of the same shape.
 */

import { createHash } from 'node:crypto';
import type { ProjectMemoryListed } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';

export function projectMemoryReceiptVersion(listed: ProjectMemoryListed): string {
  const { memory } = listed;
  const standing = memory.status === 'archived' ? 'archived' : listed.superseded ? 'superseded' : 'active';
  return createHash('sha256')
    .update(JSON.stringify([memory.id, memory.title, memory.kind, memory.summary, memory.body, memory.pinned, standing]))
    .digest('hex')
    .slice(0, 12);
}
