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

/**
 * An edit suggestion's concurrency token (epic Slice 6c, PR #212 F-02): the
 * first 12 hex characters of a SHA-256 over every field a whole-draft update
 * can overwrite (title, kind, summary, body, supersedes, pinned) and the
 * memory's effective standing. D14's version leaves `supersedes` out, so it
 * is the delivery fingerprint only, never this check. Pure.
 */
export function projectMemoryEditToken(memory: ProjectMemory, superseded: boolean): string {
  const canonical = JSON.stringify([
    memory.id,
    memory.title,
    memory.kind,
    memory.summary,
    memory.body,
    [...memory.supersedes],
    memory.pinned,
    memory.status === 'archived' ? 'archived' : superseded ? 'superseded' : 'active'
  ]);
  return createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 12);
}
