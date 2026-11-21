/**
 * A group's files, as a search reads them (ADR 2026-11-20 D3a). The browse
 * catalog keys a file by its relative path and keeps it in the first group
 * that matched it; a search needs every root's file apart, and every group a
 * file is in. These rules sit over the resolver's authoritative candidate
 * read, which already keeps every match. Pure.
 *
 * - **Identity is the absolute path,** compared as the platform compares
 *   paths: two roots holding `chapters/1.md` are two files.
 * - **A group is every file its own patterns match.** A file two of a
 *   group's patterns match is in it once; a file two groups match is in
 *   both.
 */

import * as path from 'path';
import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';

/** A host file's identity: its normalized absolute path, case-folded where the platform's paths are. */
export function hostFileIdentity(absolutePath: string, platform: NodeJS.Platform = process.platform): string {
  const normalized = path.normalize(absolutePath);
  return platform === 'win32' ? normalized.toLowerCase() : normalized;
}

/** Each file once per group, the first match keeping its place. */
export function distinctContextGroupFiles(candidates: readonly ContextResourceCandidate[]): ContextResourceCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.group}\u0000${hostFileIdentity(candidate.absolutePath)}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
