/**
 * A memory's version (ADR 2026-11-04 D14): the first 12 hex characters of
 * a SHA-256 over its canonical id, title, kind, summary, body, pinned flag
 * and effective status (active or superseded). A hand edit that leaves
 * `updated` alone still moves it. Computed on listing, never stored in the
 * file. Pure.
 */

import { createHash } from 'crypto';
import type { ProjectMemory } from '@shared/types/projectMemory';

export function projectMemoryVersion(memory: ProjectMemory, superseded: boolean): string {
  const canonical = JSON.stringify([
    memory.id,
    memory.title,
    memory.kind,
    memory.summary,
    memory.body,
    memory.pinned,
    memory.status === 'archived' ? 'archived' : superseded ? 'superseded' : 'active'
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 12);
}
