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
 *
 * **A pair the group inventory lists always resolves** (ADR 2026-11-20
 * S50). The browse listing keeps a file in the first group that matched it;
 * `resource.catalog` lists a file under every group it belongs to. So
 * `resolveConfiguredResource` tries the browse listing first, unchanged, and
 * only on a miss looks the pair up in that group's authoritative listing
 * (`listGroupFiles`). A file found there resolves to the browse entry for
 * the same file, by host identity, which loads as it always has. A path in
 * no configured group misses both, so containment is unchanged.
 */

import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
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

/** A file of a group's authoritative listing, as the fallback reads it. Its absolute path stays host-side. */
export interface ConfiguredGroupFile {
  readonly group: ContextPathGroup;
  readonly relativePath: string;
  readonly absolutePath: string;
}

/** The context resolver's authoritative, root-aware listing (ADR 2026-11-20 D3a), which rejects when a scan fails. */
export interface ConfiguredResourceGroupFiles {
  listGroupFiles(groups: ContextPathGroup[]): Promise<readonly ConfiguredGroupFile[]>;
}

/** A host that gives no authoritative listing: a pair resolves by the browse listing alone, as before S50. */
export const NO_CONFIGURED_GROUP_FILES: ConfiguredResourceGroupFiles = Object.freeze({
  listGroupFiles: async () => []
});

/** One listing per group for one operation: a read naming several missed files of a group lists it once. */
export function configuredGroupFilesOnce(groupFiles: ConfiguredResourceGroupFiles): ConfiguredResourceGroupFiles {
  const listed = new Map<ContextPathGroup, Promise<readonly ConfiguredGroupFile[]>>();
  return {
    listGroupFiles: (groups) => {
      const [group] = groups;
      if (groups.length !== 1) {
        return groupFiles.listGroupFiles(groups);
      }
      let pending = listed.get(group);
      if (!pending) {
        pending = groupFiles.listGroupFiles([group]);
        listed.set(group, pending);
      }
      return pending;
    }
  };
}

/**
 * Finds `{ group, path }` as `findConfiguredResource` does; only when that
 * misses, in the group's authoritative listing: the exact path, else the one
 * path equal to it ignoring letter case. Two files there (the same path in
 * two workspace folders, or two that differ only by case) are `ambiguous`,
 * never the first. The file found resolves to its browse entry by host
 * identity; a listing that cannot be read, or a file the browse listing
 * does not hold, misses, as it did before. It logs nothing.
 */
export async function resolveConfiguredResource(
  resources: readonly ContextResourceSummary[],
  group: ContextPathGroup,
  resourcePath: string,
  groupFiles: ConfiguredResourceGroupFiles
): Promise<ConfiguredResourceLookup> {
  const browse = findConfiguredResource(resources, group, resourcePath);
  if (browse.kind !== 'missing') {
    return browse;
  }
  let listed: readonly ConfiguredGroupFile[];
  try {
    listed = await groupFiles.listGroupFiles([group]);
  } catch {
    return { kind: 'missing' };
  }
  const inGroup = listed.filter((file) => file.group === group);
  const exact = inGroup.filter((file) => file.relativePath === resourcePath);
  const folded = resourcePath.toLowerCase();
  const matches = exact.length > 0 ? exact : inGroup.filter((file) => file.relativePath.toLowerCase() === folded);
  if (matches.length > 1) {
    return { kind: 'ambiguous' };
  }
  if (matches.length === 0) {
    return { kind: 'missing' };
  }
  const identity = hostFileIdentity(matches[0].absolutePath);
  const entry = resources.find((resource) => hostFileIdentity(resource.absolutePath) === identity);
  return entry ? { kind: 'found', resource: entry } : { kind: 'missing' };
}
