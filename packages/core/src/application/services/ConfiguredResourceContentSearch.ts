/**
 * Content search over the configured-resource catalog: the "Names + content"
 * half of the project picker's search (Workshop Sprint 12 Phase 4; shared with
 * the Lightbox's source picker, 2026-10-20). Name matching happens in the
 * webview, which already holds the catalog; this scans file text.
 *
 * Moved unchanged from WorkshopContextHandler so the Workshop's context
 * selector and the Lightbox answer from one implementation. It runs under the
 * same file and byte bounds as the persona capability's resource.search
 * (`PROMPT_BUDGETS.workshopResource`): at most `searchFiles` candidates, each
 * under `searchFileBytes`, `searchTotalBytes` in all. When a bound stops the
 * scan or skips a file, the results say `bounded`. A file that cannot be read
 * is skipped, not reported.
 *
 * The caller names the candidates, so a tab can scan only what it can use
 * (the Lightbox scans the files it can board). Matches keep candidate order.
 */

import type {
  WorkshopContextIntakeCatalog
} from '@/application/services/workshop/WorkshopContextIntakeService';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ConfiguredResourceRef, ConfiguredResourceSearchResults } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

/** The catalog reads this search needs. */
export type ConfiguredResourceSearchCatalog = Pick<WorkshopContextIntakeCatalog, 'load'>;

/**
 * Search `candidates` for `rawQuery` (case-insensitive, trimmed, cut to the
 * query bound). Undefined for an empty query: there is nothing to answer.
 */
export async function searchConfiguredResourceContent(
  catalog: ConfiguredResourceSearchCatalog,
  candidates: readonly ContextResourceSummary[],
  rawQuery: string
): Promise<ConfiguredResourceSearchResults | undefined> {
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) {
    return undefined;
  }
  const budgets = PROMPT_BUDGETS.workshopResource;
  const query = trimmed.slice(0, budgets.queryCharacters).toLowerCase();
  const scannable = candidates.slice(0, budgets.searchFiles);
  let bounded = candidates.length > scannable.length;
  let bytesScanned = 0;
  const matches: ConfiguredResourceRef[] = [];
  for (const candidate of scannable) {
    if (bytesScanned >= budgets.searchTotalBytes) {
      bounded = true;
      break;
    }
    if (
      candidate.sizeBytes >
      Math.min(budgets.searchFileBytes, budgets.searchTotalBytes - bytesScanned)
    ) {
      bounded = true;
      continue;
    }
    const loaded = await catalog.load(
      { group: candidate.group, path: candidate.path },
      {
        maxBytes: Math.min(
          budgets.searchFileBytes,
          budgets.searchTotalBytes - bytesScanned
        ),
        maxWords: Number.MAX_SAFE_INTEGER
      }
    );
    if (loaded.kind !== 'loaded') {
      continue;
    }
    bytesScanned += candidate.sizeBytes;
    if (loaded.resource.text.toLowerCase().includes(query)) {
      matches.push({ group: candidate.group, path: candidate.path });
    }
  }
  return { query: trimmed, matches, bounded };
}
