/**
 * The authoritative group listing (ADR 2026-11-20 S46) over the same files a
 * test's browse catalog fakes, for tests whose subject is not the group
 * inventory itself. A pattern walk here is never expected: a test that
 * narrows a group uses the real resolver over an *Alice* project.
 */
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { WorkshopResourceGroupListing } from '@/application/services/workshop/WorkshopResourceCatalog';

export function groupListingOver(
  summaries: () => readonly Pick<ContextResourceSummary, 'group' | 'path' | 'sizeBytes'>[],
  root = '/novel'
): WorkshopResourceGroupListing & { listGroupFiles: jest.Mock; matchPatterns: jest.Mock } {
  return {
    listGroupFiles: jest.fn(async (groups: readonly string[]) => summaries()
      .filter((summary) => groups.includes(summary.group))
      .map((summary) => ({
        group: summary.group,
        relativePath: summary.path,
        workspaceFolderPath: root,
        absolutePath: `${root}/${summary.path}`,
        sizeBytes: summary.sizeBytes ?? 0
      }))),
    matchPatterns: jest.fn(async () => {
      throw new Error('This test walks no pattern.');
    })
  };
}
