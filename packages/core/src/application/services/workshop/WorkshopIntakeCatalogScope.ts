/**
 * One configured-resource catalog for one operation (a context scan, a
 * pinned-context read), shared by every authorization that operation makes.
 *
 * Building a catalog runs every configured pattern's file search and stats
 * every match, so a scan that authorized each file against its own catalog
 * paid that once per file. A scope opens it once, on first use, and hands the
 * same snapshot (or the same failure) to every caller after.
 *
 * **It is bound to the workspace roots it was listed under** (PR #284
 * F-01). Each call compares the open folders with the roots the listing
 * began under; if a folder was added or removed, the old listing is no
 * authority any more and a fresh one is opened, as a call alone would.
 *
 * **It lives only as long as the operation that made it.** Nothing keeps a
 * scope after its operation returns: a catalog kept across operations would
 * need file-watching to stay true. A file added mid-operation is seen by the
 * next one, as before. The checks that guard each read (containment, no
 * symbolic link, the load's bounds) still run per file; only the listing is
 * shared.
 */

import type {
  WorkshopContextIntakeCatalog,
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';

export interface WorkshopIntakeCatalogScope {
  /**
   * The operation's catalog, opened on first call; a failed open fails every
   * call alike while the workspace roots stay the same.
   */
  catalog(): Promise<WorkshopContextIntakeCatalog>;
}

export function workshopIntakeCatalogScope(
  intake: Pick<WorkshopContextIntakeService, 'openCatalog' | 'workspaceRoots'>
): WorkshopIntakeCatalogScope {
  let opened: { readonly roots: string; readonly catalog: Promise<WorkshopContextIntakeCatalog> } | undefined;
  return {
    catalog: () => {
      const roots = intake.workspaceRoots().join('\u0000');
      if (!opened || opened.roots !== roots) {
        opened = { roots, catalog: intake.openCatalog() };
      }
      return opened.catalog;
    }
  };
}
