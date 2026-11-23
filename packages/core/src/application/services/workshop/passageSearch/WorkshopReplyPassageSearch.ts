/**
 * A reply's passage-search request, checked before completion and settled
 * in it (ADR 2026-11-20 D17).
 *
 * - **Resolve (awaits allowed):** a reply holding the tag has its one
 *   request checked before the reply commits: form first (the codec's),
 *   then each group named, each narrowing's patterns, the excerpt, and each
 *   file against one authoritative, root-aware listing of the groups named,
 *   read once for the operation. A reply without the tag costs no await.
 * - **A narrowed group** (ADR 2026-11-20 S44) is read by the shared rule
 *   (`ContextGroupNarrowing`): an unsafe pattern is `unsafe-match`; every
 *   narrowing is walked once (`matchPatterns`), and a walk that did not
 *   complete is `catalog-unreadable`, never zero files; a pattern that finds
 *   no file of its group is `match-found-nothing`, so a mistyped pattern
 *   never silently narrows a search. The card stores the patterns as split.
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
 *   files, a path or a pattern (D22, S49).
 */

import type { WorkshopPassageSearchRequest, WorkshopPassageSearchScope } from '@messages';
import { isContextPathGroup, type ContextPathGroup } from '@shared/types';
import {
  contextGroupMatchRefused,
  narrowContextGroup,
  walkContextGroupPatterns,
  type ContextGroupMatchRequest,
  type ContextGroupPatternMatcher,
  type ContextGroupPatternWalk
} from '@/application/services/ContextGroupNarrowing';
import { cloneWorkshopPassageSearchScope } from '@/application/services/workshop/passageSearch/WorkshopPassageSearchRecords';
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
  /** A narrowing's pattern the context-path rules refuse (S44). */
  | 'unsafe-match'
  /** A narrowing's pattern that finds no file of its group (S44). */
  | 'match-found-nothing'
  | 'catalog-unreadable'
  /** The request was never checked against a listing: no listing here, a stopped run, or a check made for another reply. */
  | 'listing-not-read';

/** One listed file, as the settlement reads it. Its absolute path only intersects a narrowing: never stored, shown or logged. */
export interface WorkshopPassageSearchListedFile {
  readonly group: ContextPathGroup;
  readonly relativePath: string;
  readonly absolutePath: string;
}

/**
 * The context resolver's authoritative listing (ADR 2026-11-20 D3a), which
 * rejects when a scan fails, and its pattern walk (S44), which reports an
 * incomplete walk per pattern.
 */
export interface WorkshopPassageSearchListing extends ContextGroupPatternMatcher {
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
  const narrowings: ContextGroupMatchRequest[] = [];
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
    if (scope.kind === 'group' && scope.match) {
      // Refused before anything is walked, as a context path is (ADR 2026-11-19 D22).
      if (contextGroupMatchRefused(scope.match)) {
        return 'unsafe-match';
      }
      narrowings.push({ group: scope.group, patterns: scope.match });
    }
  }
  let listed: readonly WorkshopPassageSearchListedFile[] = [];
  let walk: ContextGroupPatternWalk | undefined;
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
    // One walk for every narrowing the request names (S44).
    if (narrowings.length > 0) {
      if (room.signal.aborted) {
        return 'listing-not-read';
      }
      walk = await walkContextGroupPatterns(room.listing, narrowings);
    }
  }
  const scopes: WorkshopPassageSearchScope[] = [];
  for (const scope of request.scopes) {
    if (scope.kind === 'excerpt') {
      scopes.push({ kind: 'excerpt' });
    } else if (scope.kind === 'group') {
      const group = scope.group as ContextPathGroup;
      if (scope.match) {
        // Never widened: a narrowing with no walk behind it is not checked.
        if (!walk) {
          return 'listing-not-read';
        }
        const narrowed = narrowContextGroup(listed, { group, patterns: scope.match }, walk);
        if (narrowed.kind === 'incomplete') {
          return 'catalog-unreadable';
        }
        if (narrowed.patterns.some((pattern) => pattern.files === 0)) {
          return 'match-found-nothing';
        }
        scopes.push({ kind: 'group', group, match: [...scope.match] });
      } else {
        scopes.push({ kind: 'group', group });
      }
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
  const card: WorkshopPassageSearchRequest = { question: check.card.question, scopes: check.card.scopes.map(cloneWorkshopPassageSearchScope) };
  // Counts only: how many patterns narrow the card's groups, never one of them (S49).
  const patterns = card.scopes.reduce((sum, scope) => sum + (scope.kind === 'group' ? scope.match?.length ?? 0 : 0), 0);
  return { card, drops, logs: [log(`shown (scopes=${card.scopes.length}${patterns > 0 ? `, patterns=${patterns}` : ''})`)] };
}
