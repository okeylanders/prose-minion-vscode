/**
 * A reply's passage-search request, checked before completion and settled
 * in it (ADR 2026-11-20 D17).
 *
 * - **Resolve (awaits allowed):** a reply holding the tag has its one
 *   request checked before the reply commits: form first (the codec's),
 *   then each group named, the excerpt, and each file against one
 *   authoritative, root-aware listing of the groups named, read once for
 *   the operation. A reply without the tag costs no await.
 * - **It reads no file and prices nothing.** The price is the card's own
 *   request, when the writer sees it.
 * - **Settle (synchronous, in the reply's commit):** typed verdicts. A
 *   request that failed any check is dropped whole, with its reason, and
 *   gives no card. One checked for another reply, or never checked, is
 *   dropped as not listed, never shown.
 * - **A file is stored by its catalog key:** its group and its path as the
 *   listing spells it. A path two workspace folders both hold names no one
 *   file (`ambiguous-file`), never the first folder's.
 * - **Logs carry counts and reasons only,** never the question, a group's
 *   files or a path (D22).
 */

import type { WorkshopPassageSearchRequest, WorkshopPassageSearchScope } from '@messages';
import { isContextPathGroup, type ContextPathGroup } from '@shared/types';
import { extractWorkshopReplyControls, hasWorkshopPassageSearchText } from '@/utils/workshopReplyControls';
import type {
  WorkshopPassageSearchDraft,
  WorkshopReplyPassageSearchControl,
  WorkshopReplyPassageSearchRejection
} from '@/utils/workshopReplyPassageSearch';

/** Every reason a passage-search frame can end with no card for. */
export type WorkshopPassageSearchDropCode =
  | WorkshopReplyPassageSearchRejection
  | 'unknown-group'
  | 'unknown-file'
  | 'ambiguous-file'
  | 'no-excerpt'
  | 'catalog-unreadable'
  /** The request was never checked against a listing: no listing here, a stopped run, or a check made for another reply. */
  | 'listing-not-read';

/** One listed file, as the settlement reads it: never its absolute path. */
export interface WorkshopPassageSearchListedFile {
  readonly group: ContextPathGroup;
  readonly relativePath: string;
}

/** The context resolver's authoritative listing (ADR 2026-11-20 D3a): it rejects when a scan fails. */
export interface WorkshopPassageSearchListing {
  listGroupFiles(groups: ContextPathGroup[]): Promise<readonly WorkshopPassageSearchListedFile[]>;
}

/** What was checked for one reply, before completion. */
export interface WorkshopReplyPassageSearchContext {
  /** The reply it was resolved from: used only for that reply. */
  readonly reply: string;
  readonly check:
    | { readonly kind: 'card'; readonly card: WorkshopPassageSearchRequest }
    | { readonly kind: 'dropped'; readonly code: WorkshopPassageSearchDropCode }
    | { readonly kind: 'none' };
}

export interface WorkshopReplyPassageSearchSettlement {
  readonly card?: WorkshopPassageSearchRequest;
  readonly drops: readonly WorkshopPassageSearchDropCode[];
  readonly logs: readonly string[];
}

export interface WorkshopReplyPassageSearchRoom {
  /** Whether the room has an excerpt with text now. */
  readonly hasExcerpt: boolean;
  readonly listing?: WorkshopPassageSearchListing;
  readonly signal: AbortSignal;
}

/** Check a reply's request before completion; undefined when the reply holds no tag. */
export async function resolveWorkshopReplyPassageSearch(
  reply: string,
  room: WorkshopReplyPassageSearchRoom
): Promise<WorkshopReplyPassageSearchContext | undefined> {
  if (!hasWorkshopPassageSearchText(reply)) {
    return undefined;
  }
  const request = extractWorkshopReplyControls(reply, { memoryOpen: false }).passageSearch?.request;
  if (!request) {
    return { reply, check: { kind: 'none' } };
  }
  const checked = await checkRequest(request, room);
  return { reply, check: typeof checked === 'string' ? { kind: 'dropped', code: checked } : { kind: 'card', card: checked } };
}

async function checkRequest(
  request: WorkshopPassageSearchDraft,
  room: WorkshopReplyPassageSearchRoom
): Promise<WorkshopPassageSearchRequest | WorkshopPassageSearchDropCode> {
  const groups: ContextPathGroup[] = [];
  for (const scope of request.scopes) {
    if (scope.kind === 'excerpt') {
      if (!room.hasExcerpt) {
        return 'no-excerpt';
      }
      continue;
    }
    if (!isContextPathGroup(scope.group)) {
      return 'unknown-group';
    }
    if (!groups.includes(scope.group)) {
      groups.push(scope.group);
    }
  }
  let listed: readonly WorkshopPassageSearchListedFile[] = [];
  if (groups.length > 0) {
    if (!room.listing || room.signal.aborted) {
      return 'listing-not-read';
    }
    try {
      // One listing for the whole request (D17), whatever it names.
      listed = await room.listing.listGroupFiles(groups);
    } catch {
      return 'catalog-unreadable';
    }
  }
  const scopes: WorkshopPassageSearchScope[] = [];
  for (const scope of request.scopes) {
    if (scope.kind === 'excerpt') {
      scopes.push({ kind: 'excerpt' });
    } else if (scope.kind === 'group') {
      scopes.push({ kind: 'group', group: scope.group as ContextPathGroup });
    } else {
      const file = configuredFile(listed, scope.group as ContextPathGroup, scope.path);
      if (typeof file === 'string') {
        return file;
      }
      scopes.push({ kind: 'file', group: file.group, path: file.relativePath });
    }
  }
  return { question: request.question, scopes };
}

/** The one file `{ group, path }` names in the listing: the exact path, else the one path equal to it but for letter case. */
function configuredFile(
  listed: readonly WorkshopPassageSearchListedFile[],
  group: ContextPathGroup,
  resourcePath: string
): WorkshopPassageSearchListedFile | 'unknown-file' | 'ambiguous-file' {
  const inGroup = listed.filter((file) => file.group === group);
  const exact = inGroup.filter((file) => file.relativePath === resourcePath);
  const folded = resourcePath.toLowerCase();
  const matches = exact.length > 0 ? exact : inGroup.filter((file) => file.relativePath.toLowerCase() === folded);
  if (matches.length === 0) {
    return 'unknown-file';
  }
  return matches.length > 1 ? 'ambiguous-file' : matches[0];
}

/** Settle the reply's frames into at most one card and typed drops. */
export function settleWorkshopReplyPassageSearch(
  control: WorkshopReplyPassageSearchControl | undefined,
  context: WorkshopReplyPassageSearchContext | undefined
): WorkshopReplyPassageSearchSettlement {
  if (!control) {
    return { drops: [], logs: [] };
  }
  const drops: WorkshopPassageSearchDropCode[] = [...control.rejections];
  const log = (outcome: string): string => `Passage search request ${outcome} (dropped=${drops.length})`;
  if (!control.request) {
    return { drops, logs: drops.length > 0 ? [log('dropped')] : [] };
  }
  const check = context?.check;
  if (!check || check.kind !== 'card') {
    const code: WorkshopPassageSearchDropCode = check?.kind === 'dropped' ? check.code : 'listing-not-read';
    drops.push(code);
    return { drops, logs: [log(`dropped (reason=${code})`)] };
  }
  const card: WorkshopPassageSearchRequest = { question: check.card.question, scopes: check.card.scopes.map((scope) => ({ ...scope })) };
  return { card, drops, logs: [log(`shown (scopes=${card.scopes.length})`)] };
}
