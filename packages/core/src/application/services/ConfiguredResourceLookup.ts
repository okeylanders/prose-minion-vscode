/**
 * The one rule for naming a configured project resource by `{ group, path }`
 * (moved here from the Workshop, behavior unchanged: ADR 2026-11-20 D3).
 *
 * `resource.read` (a persona's capability), the Read in reader (ADR
 * 2026-11-03 D4) and `history.*` all resolve a pair through this function,
 * so the reader can never open a file a persona could not have read.
 * Containment itself is the provider's: a path resolves only when the
 * provider's own listing holds it, and that listing admits only files inside
 * the configured groups.
 */

import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ContextPathGroup } from '@shared/types';

export type ConfiguredResourceLookup =
  | { kind: 'found'; resource: ContextResourceSummary }
  | { kind: 'missing' }
  | { kind: 'ambiguous' };

/**
 * Finds `{ group, path }` in the provider's listing: the exact path first,
 * then a path equal to it ignoring letter case, which must be unique.
 */
export function findConfiguredResource(
  resources: readonly ContextResourceSummary[],
  group: ContextPathGroup,
  resourcePath: string
): ConfiguredResourceLookup {
  const exact = resources.find(item => item.group === group && item.path === resourcePath);
  if (exact) {
    return { kind: 'found', resource: exact };
  }
  const folded = resourcePath.toLowerCase();
  const caseFolded = resources.filter(item =>
    item.group === group && item.path.toLowerCase() === folded
  );
  if (caseFolded.length > 1) {
    return { kind: 'ambiguous' };
  }
  return caseFolded.length === 1
    ? { kind: 'found', resource: caseFolded[0] }
    : { kind: 'missing' };
}
