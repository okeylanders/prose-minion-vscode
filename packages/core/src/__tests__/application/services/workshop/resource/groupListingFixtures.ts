/**
 * The authoritative group listing (ADR 2026-11-20 S46) over the same files a
 * test's browse catalog fakes, for tests whose subject is not the group
 * inventory itself. A pattern walk here is never expected: a test that
 * narrows a group uses the real resolver over an *Alice* project.
 */
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { WorkshopResourceGroupListing } from '@/application/services/workshop/WorkshopResourceCatalog';

/** Browse summaries as a host gives them: each with its absolute path (a fake that left one out gets one under `root`). */
export function withAbsolutePaths<T extends { readonly path: string; readonly absolutePath?: string }>(summaries: readonly T[], root = '/novel'): T[] {
  return summaries.map((summary) => (summary.absolutePath ? summary : { ...summary, absolutePath: `${root}/${summary.path}` }));
}

export function groupListingOver(
  summaries: () => readonly (Pick<ContextResourceSummary, 'group' | 'path' | 'sizeBytes'> & { readonly absolutePath?: string })[],
  root = '/novel'
): WorkshopResourceGroupListing & { listGroupFiles: jest.Mock; matchPatterns: jest.Mock } {
  return {
    // The same files, by the same absolute paths, so each resolves to its own browse entry.
    listGroupFiles: jest.fn(async (groups: readonly string[]) => summaries()
      .filter((summary) => groups.includes(summary.group))
      .map((summary) => ({
        group: summary.group,
        relativePath: summary.path,
        workspaceFolderPath: root,
        absolutePath: summary.absolutePath ?? `${root}/${summary.path}`,
        sizeBytes: summary.sizeBytes ?? 0
      }))),
    matchPatterns: jest.fn(async () => {
      throw new Error('This test walks no pattern.');
    }),
    openWorkspaceFolders: () => [{ path: root, name: root.split('/').pop() ?? root }]
  };
}
