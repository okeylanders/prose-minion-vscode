/**
 * `resource.catalog`: the project's group inventory (ADR 2026-11-20 S46).
 *
 * - **The search's own listing.** A named group lists the files of that
 *   group's authoritative, root-aware listing (`listGroupFiles`): exactly
 *   the files a passage search of it reads. The browse catalog keeps a file
 *   in its first group only (PR #292 F2); this does not. Without a group,
 *   each group in turn, a file under every group it belongs to.
 * - **Narrowed by `<match>`** (only beside `<group>`): the files that
 *   narrowed scope would search, read by the one shared rule
 *   (`ContextGroupNarrowing`) a persona's search request is settled by,
 *   with each pattern's count, so a pattern that finds nothing shows before
 *   a search is asked for. A walk that did not complete lists nothing and
 *   says so: incomplete is never zero.
 * - **In reading order:** within a group, natural order of the paths, then
 *   by workspace folder, as a search reads them.
 * - **Paged by the shared rule** (`workshopCapabilityPageOf`):
 *   `catalogItems` a page, the next page's whole call written exactly when
 *   a later page exists, and a page past the end answered in words.
 *   Every call written here decodes as written through the codec
 *   (`resourceCatalogPromptSync.test.ts`).
 * - **A failed listing is a failed result,** never a shorter catalog.
 *
 * The result shows paths and the persona's own patterns; its log line holds
 * the group, counts and the outcome only (S49).
 */

import type { ContextResourceCandidate } from '@/domain/models/ContextGeneration';
import { DEFAULT_CONTEXT_GROUPS } from '@/domain/models/ContextGeneration';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types';
import type { WorkshopCapabilityRequest, WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';
import { compareNaturalPaths } from '@/utils/naturalOrder';
import { workshopCapabilityPageOf } from '@/application/services/workshop/WorkshopCapabilityPaging';
import { workshopResourceRequestSummary } from '@/application/services/workshop/WorkshopResourceRequestCopy';
import {
  narrowContextGroup,
  walkContextGroupPatterns,
  type ContextGroupPatternCount,
  type ContextGroupPatternMatcher
} from '@/application/services/ContextGroupNarrowing';

type CatalogRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.catalog' }>;

/** The resolver's authoritative listing, which rejects when a scan fails, and its pattern walk. */
export interface WorkshopResourceGroupListing extends ContextGroupPatternMatcher {
  listGroupFiles(groups: ContextPathGroup[]): Promise<readonly ContextResourceCandidate[]>;
}

export interface WorkshopResourceCatalogOutcome {
  readonly result: WorkshopCapabilityResult;
  /** Counts and closed words only: never a path or a pattern. */
  readonly log: string;
}

const number = (value: number): string => value.toLocaleString('en-US');
const count = (value: number, singular: string, plural = `${singular}s`): string =>
  `${number(value)} ${value === 1 ? singular : plural}`;
const escapeXml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rootName = (folderPath: string): string => folderPath.split(/[\\/]/).filter((segment) => segment.length > 0).pop() ?? folderPath;

/**
 * A catalog page's complete call, on one line: what a continuation names.
 * A narrowing is written as one `<match>`, its patterns joined by ", ": every
 * list of `matchPatterns` patterns of at most `patternCharacters` fits
 * `matchCharacters` (a test holds it), so the call always decodes.
 */
export function workshopResourceCatalogCall(request: Omit<CatalogRequest, 'capability'>): string {
  const fields = [
    ...(request.group ? [`<group>${request.group}</group>`] : []),
    ...(request.match ? [`<match>${escapeXml(request.match.join(', '))}</match>`] : []),
    ...(request.page !== undefined ? [`<page>${request.page}</page>`] : [])
  ];
  return `<prose-minion-tool-call name="resource.catalog">${fields.join('')}</prose-minion-tool-call>`;
}

/** The catalog a request asks for, from the search's own listing. Rejects only when `throwIfAborted` does. */
export async function runWorkshopResourceCatalog(
  listing: WorkshopResourceGroupListing,
  request: CatalogRequest,
  throwIfAborted: () => void
): Promise<WorkshopResourceCatalogOutcome> {
  const groups = request.group ? [request.group] : [...DEFAULT_CONTEXT_GROUPS];
  const page = request.page ?? 1;
  const patterns = request.match?.length ?? 0;
  const logOf = (outcome: string, files: number, pages = 0): string =>
    `capability=resource.catalog group=${request.group ?? 'all'} page=${page} pages=${pages} files=${files} patterns=${patterns} outcome=${outcome}`;
  let listed: readonly ContextResourceCandidate[];
  try {
    listed = await listing.listGroupFiles(groups);
  } catch {
    throwIfAborted();
    return { result: incomplete(request), log: logOf('listing-incomplete', 0) };
  }
  throwIfAborted();
  let files = groups.flatMap((group) => inReadingOrder(listed.filter((file) => file.group === group)));
  let counts: readonly ContextGroupPatternCount[] = [];
  if (request.group && request.match) {
    const narrowing = { group: request.group, patterns: request.match };
    const narrowed = narrowContextGroup(files, narrowing, await walkContextGroupPatterns(listing, [narrowing]));
    throwIfAborted();
    if (narrowed.kind === 'incomplete') {
      return { result: incomplete(request), log: logOf('walk-incomplete', 0) };
    }
    files = [...narrowed.files];
    counts = narrowed.patterns;
  }
  const paged = workshopCapabilityPageOf(files.length, PROMPT_BUDGETS.workshopResource.catalogItems, page);
  const shown = files.slice(paged.start, paged.end);
  const roots = new Set(listed.map((file) => file.workspaceFolderPath)).size;
  const hint = paged.next !== undefined
    ? workshopResourceCatalogCall({ group: request.group, match: request.match, page: paged.next })
    : undefined;
  const place = placeOf(request);
  const content = files.length === 0 && counts.length === 0
    ? `No configured project resources are available for ${request.group ?? 'all configured groups'}.`
    : [
      `## Project resource catalog · ${place}`,
      '',
      scopeLine(request),
      ...counts.map((each) => countLine(each, request.group!)),
      ...(counts.length > 0 ? [''] : []),
      ...(paged.pastEnd
        ? [`Page ${number(page)} is past the end: ${count(files.length, 'file')}, ${count(paged.pages, 'page')}.`]
        : [
          ...(files.length === 0 ? ['No file is listed.'] : [rangeLine(paged.start, paged.end, files.length, paged.pages)]),
          ...shown.map((file) => entry(file, roots > 1))
        ]),
      ...(hint ? ['', `${count(files.length - paged.end, 'more file')}. The next page: ${hint}`] : [])
    ].join('\n');
  return {
    result: {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopResourceRequestSummary(request),
      content,
      metadata: {
        group: request.group ?? 'all',
        fileCount: shown.length,
        matchingFiles: files.length,
        page,
        pages: paged.pages,
        ...(patterns > 0 ? { patterns, patternsFindingNothing: counts.filter((each) => each.files === 0).length } : {}),
        truncated: hint !== undefined
      }
    },
    log: logOf(paged.pastEnd ? 'past-end' : 'listed', files.length, paged.pages)
  };
}

function placeOf(request: CatalogRequest): string {
  if (!request.group) {
    return 'all configured groups';
  }
  return request.match ? `${request.group}, matching ${request.match.join(', ')}` : request.group;
}

function scopeLine(request: CatalogRequest): string {
  if (!request.group) {
    return 'Each group in turn, from the listing a passage search reads; a file in two groups is listed under each.';
  }
  return request.match
    ? `Exactly the files of ${request.group} a passage search narrowed by these patterns reads: those at least one pattern finds.`
    : `The files a passage search of ${request.group} reads.`;
}

function countLine({ pattern, files }: ContextGroupPatternCount, group: ContextPathGroup): string {
  return files === 0
    ? `- ${pattern} finds no file of ${group}. A passage search narrowed by it would be dropped (match-found-nothing).`
    : `- ${pattern} finds ${count(files, `file of ${group}`, `files of ${group}`)}.`;
}

function rangeLine(start: number, end: number, total: number, pages: number): string {
  return pages <= 1 ? `${count(total, 'file')}:` : `Files ${number(start + 1)}–${number(end)} of ${number(total)}:`;
}

function entry(file: ContextResourceCandidate, severalRoots: boolean): string {
  return `- [${file.group}] \`${file.relativePath}\`${severalRoots ? ` · workspace: ${rootName(file.workspaceFolderPath)}` : ''}`;
}

/** Natural order of the relative paths; the same path in two roots by root: as a search reads them. */
function inReadingOrder(files: readonly ContextResourceCandidate[]): ContextResourceCandidate[] {
  return [...files].sort((a, b) =>
    compareNaturalPaths(a.relativePath, b.relativePath) || compareNaturalPaths(a.workspaceFolderPath, b.workspaceFolderPath));
}

function incomplete(request: CatalogRequest): WorkshopCapabilityResult {
  return {
    capability: request.capability,
    status: 'failed',
    requestSummary: workshopResourceRequestSummary(request),
    error: 'The project\'s files could not be listed completely just then, so nothing is listed. Try again.',
    metadata: { group: request.group ?? 'all', fileCount: 0, rejectionReason: 'catalog-unreadable' }
  };
}
