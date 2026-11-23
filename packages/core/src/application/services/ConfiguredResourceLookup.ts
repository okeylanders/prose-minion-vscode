/**
 * The one rule for naming a configured project resource by `{ group, path }`
 * (ADR 2026-11-20 D3, S50).
 *
 * `resource.read` (a persona's capability), the Read in reader (ADR
 * 2026-11-03 D4) and `history.*` all resolve a pair through this function,
 * so the reader can never open a file a persona could not have read.
 * Containment itself is the listings': a path resolves only when the
 * group's authoritative listing holds it, and that listing admits only files
 * inside the configured groups.
 *
 * **A pair resolves to the file the group inventory lists for it** (ADR
 * 2026-11-20 S50). The browse listing keeps a file in the first group that
 * matched it, and merges files whose relative paths differ only by letter
 * case or by workspace folder; `resource.catalog` lists every file of a
 * group apart. So `resolveConfiguredResource` names the file from that
 * group's authoritative listing (`listGroupFiles`), and only then finds its
 * browse entry, by host identity, which loads as it always has. When that
 * listing cannot be read, the pair is `unverified`: the browse listing alone
 * can name a different file than the one asked for, so it is never read in
 * its place.
 */

import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import { hostFileIdentity } from '@/infrastructure/context/ContextGroupFiles';
import type { ContextPathGroup } from '@shared/types';

export type ConfiguredResourceLookup =
  | { kind: 'found'; resource: ContextResourceSummary }
  | { kind: 'missing' }
  | { kind: 'ambiguous' }
  /** The group's authoritative listing could not be read, so no file was confirmed. */
  | { kind: 'unverified' };

/** A file of a group's authoritative listing. Its absolute path stays host-side. */
export interface ConfiguredGroupFile {
  readonly group: ContextPathGroup;
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * The context resolver's authoritative, root-aware listing (ADR 2026-11-20
 * D3a), which rejects when a scan fails. Every reader of a pair takes one:
 * there is no host default.
 */
export interface ConfiguredResourceGroupFiles {
  listGroupFiles(groups: ContextPathGroup[]): Promise<readonly ConfiguredGroupFile[]>;
}

/** One listing per group for one operation: a read naming several files of a group lists it once. */
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
 * The one file `{ group, path }` names (S50, as amended after PR #298):
 *
 * 1. **In the group's authoritative listing:** the one exact relative path,
 *    else the one path equal to it ignoring letter case. Several exact
 *    matches (the same path in two workspace folders), or several
 *    case-folded matches with no exact one, are `ambiguous`, never the
 *    first; none is `missing`. That listing holds every file the browse
 *    listing holds for the group.
 * 2. **Then its browse entry, by host identity,** which loads as it always
 *    has. When the browse listing holds no entry for that file (it merged
 *    it with a same-named file, or dropped it), the pair is `ambiguous`:
 *    never another file's entry.
 *
 * When the listing cannot be read (a scan failed), the pair is
 * `unverified`, with no browse lookup: the caller refuses it in its own
 * words and reads nothing. It logs nothing.
 */
export async function resolveConfiguredResource(
  resources: readonly ContextResourceSummary[],
  group: ContextPathGroup,
  resourcePath: string,
  groupFiles: ConfiguredResourceGroupFiles
): Promise<ConfiguredResourceLookup> {
  let listed: readonly ConfiguredGroupFile[];
  try {
    listed = await groupFiles.listGroupFiles([group]);
  } catch {
    return { kind: 'unverified' };
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
  return entry ? { kind: 'found', resource: entry } : { kind: 'ambiguous' };
}
