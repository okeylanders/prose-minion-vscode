/**
 * `transcript.bookmarks` for one persona turn (ADR 2026-11-05 D2, D3, D7):
 * the service's bookmarks, rendered, with what the card records.
 *
 * - **Who asks.** The turn's owner is the reader: the open room's rows are
 *   the bookmarks on turns it could see.
 * - **Bounds.** A list holds at most `bookmarkCharacters`, and one message
 *   window at most `bookmarkMessageCharacters`. Both carry turn text, so the
 *   read's context-window clamp applies: at most half the room the window
 *   has left, by the preflight's own estimate, never below the renderer's
 *   minimum. A call the window cannot hold is refused before the service is
 *   asked, or after measuring, and says why.
 * - **Publication.** A result the service stamped withheld carries the
 *   stamp in its metadata (WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD), with
 *   the bookmark ids; the room's audience policy reads it and never
 *   publishes the card. Rows are never filtered to make it publishable.
 * - **Refusals.** A stale ref is refused as `stale-bookmark-ref`, naming
 *   why, and is never retargeted.
 */

import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD,
  type WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import {
  renderWorkshopRecallBookmarkMessage,
  renderWorkshopRecallBookmarks,
  WORKSHOP_RECALL_BOOKMARK_READ_CHARACTERS,
  WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS,
  WORKSHOP_RECALL_MINIMUM_BOOKMARK_READ_CHARACTERS,
  workshopRecallStaleBookmarkRefLine
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkList';
import type {
  WorkshopRecallBookmarkGroup,
  WorkshopRecallBookmarksResult,
  WorkshopRecallBookmarksWithheld
} from '@/application/services/workshop/recall/WorkshopRecallBookmarkResults';
import { recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';
import { recallQuoted } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { workshopTranscriptRecallRequestSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  fitWorkshopRecallReadToWindow,
  workshopRecallEvidenceTokens,
  WorkshopRecallMeasuredRead,
  WorkshopRecallWindowFit
} from '@/application/services/workshop/recall/WorkshopRecallWindowClamp';
import {
  recallFailedResult,
  recallNumber as count,
  recallRejectedResult,
  recallScanCosts,
  throwIfRecallTurnAborted,
  WorkshopRecallOperationContext,
  WorkshopRecallOperationOutcome,
  WorkshopRecallRequestOf
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

type BookmarksRequest = WorkshopRecallRequestOf<'transcript.bookmarks'>;
type Shown = Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' | 'bookmark' }>;

/** Source titles in a bookmark list's manifest label. */
const BOOKMARK_LABEL_TITLES = 400;

export async function runWorkshopRecallBookmarks(
  recall: Pick<WorkshopTranscriptRecallService, 'bookmarks'>,
  context: WorkshopRecallOperationContext,
  request: BookmarksRequest,
  window?: CapabilityContextWindow
): Promise<WorkshopRecallOperationOutcome> {
  const budgets = PROMPT_BUDGETS.workshopTranscriptRecall;
  const listing = request.bookmark === undefined;
  const minimum = listing ? WORKSHOP_RECALL_MINIMUM_BOOKMARK_CHARACTERS : WORKSHOP_RECALL_MINIMUM_BOOKMARK_READ_CHARACTERS;
  const cap = listing ? budgets.bookmarkCharacters : WORKSHOP_RECALL_BOOKMARK_READ_CHARACTERS;
  const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
  // A first guess, at the estimate's characters per token; the rendered text is measured after.
  const first = half === undefined ? cap : Math.min(cap, half * PROMPT_BUDGETS.inferenceContext.bytesPerToken);
  if (first < minimum) {
    return { result: tooSmall(context, request, minimum, first) };
  }
  const { capability: _capability, ...asked } = request;
  const owner = context.turn.owner;
  const result = await recall.bookmarks({ ...asked, ...(owner ? { reader: owner } : {}) }, context.turn.signal);
  throwIfRecallTurnAborted(context.turn.signal);
  if (!result.available || result.outcome === 'unknown-session') {
    const content = renderWorkshopRecallBookmarks(result, { now: context.now() }).content;
    return {
      result: recallFailedResult(request, content, result.available
        ? { outcome: 'unknown-session', liveSession: result.liveSession }
        : { outcome: 'unavailable', unavailableReason: result.reason })
    };
  }
  if (result.outcome === 'stale-bookmark-ref') {
    return {
      result: recallRejectedResult(context, request, 'stale-bookmark-ref', workshopRecallStaleBookmarkRefLine(result), { why: result.why })
    };
  }
  if (result.outcome === 'unknown-bookmark' || result.outcome === 'unreadable-session') {
    const content = renderWorkshopRecallBookmarkMessage(result, { now: context.now() }).content;
    return { result: { ...recallFailedResult(request, content, { outcome: result.outcome }), error: 'No bookmarked message was recalled.' } };
  }
  const shown: Shown = result;
  const sourcesOf = new Map<WorkshopCapabilityResult, WorkshopRecallOperationOutcome['sources']>();
  const render = (characters: number): WorkshopRecallMeasuredRead => {
    const recorded = shown.outcome === 'bookmarks'
      ? listOutcome(request, shown, characters, context.now())
      : messageOutcome(request, shown, characters, context.now());
    sourcesOf.set(recorded.result, recorded.sources);
    return { characters, outcome: recorded.result, tokens: half === undefined ? 0 : workshopRecallEvidenceTokens(recorded.result) };
  };
  const fitted: WorkshopRecallWindowFit = half === undefined
    ? { fit: render(first), renders: 1 }
    : fitWorkshopRecallReadToWindow(render, first, half, minimum);
  if (!fitted.fit) {
    return { result: tooSmall(context, request, minimum, 0) };
  }
  const outcome = fitted.fit.outcome;
  context.log(`bookmarks limit=${fitted.fit.characters} characters=${outcome.content!.length}` +
    (half === undefined ? ' window=unknown' : ` tokens=${fitted.fit.tokens} halfWindow=${half} renders=${fitted.renders}`) +
    (shown.withheld ? ` withheld=${shown.withheld.reason} bookmarks=${shown.withheld.bookmarkIds.join(',')}` : ''));
  return { result: outcome, sources: sourcesOf.get(outcome) };
}

function listOutcome(
  request: BookmarksRequest,
  result: Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmarks' }>,
  characters: number,
  now: number
): WorkshopRecallOperationOutcome {
  const rendered = renderWorkshopRecallBookmarks(result, { now, bookmarkCharacters: characters });
  const { bounds } = result;
  const titles = result.groups
    .filter((group) => rendered.shown.some((row) =>
      (group.source.kind === 'current' ? row.sessionId === undefined : row.sessionId === group.source.header.sessionId)))
    .map(groupTitle);
  const outcome: WorkshopCapabilityResult = {
    capability: request.capability,
    status: 'success',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content: rendered.content,
    metadata: {
      outcome: 'bookmarks',
      scope: result.scope,
      openRoom: bounds.openRoom,
      sessionCount: bounds.sessionsScanned,
      sourcesShown: titles.length,
      shown: rendered.shown,
      cutMessages: rendered.cutMessages,
      notShownForSpace: rendered.notShownForSpace,
      notShownByFilters: bounds.notShownByFilters,
      omittedByItemLimit: bounds.omittedByItemLimit,
      ...recallScanCosts(bounds),
      truncated: rendered.notShownForSpace > 0 || bounds.omittedByItemLimit > 0 || rendered.cutMessages > 0 ||
        bounds.notScannedBySessionLimit > 0 || bounds.notScannedByByteBudget > 0 || bounds.listingTruncated,
      ...withheldMetadata(result.withheld),
      characters: rendered.content.length
    }
  };
  // One row per call, naming where the bookmarks it showed came from.
  return rendered.shown.length > 0
    ? {
        result: outcome,
        sources: [{
          kind: 'transcript',
          label: `Bookmarks · ${recallLabelList(titles, BOOKMARK_LABEL_TITLES)}`,
          sizeChars: rendered.content.length
        }]
      }
    : { result: outcome };
}

function messageOutcome(
  request: BookmarksRequest,
  result: Extract<WorkshopRecallBookmarksResult, { outcome: 'bookmark' }>,
  characters: number,
  now: number
): WorkshopRecallOperationOutcome {
  const rendered = renderWorkshopRecallBookmarkMessage(result, { now, characters });
  const window = rendered.window;
  const outcome: WorkshopCapabilityResult = {
    capability: request.capability,
    status: 'success',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content: rendered.content,
    metadata: {
      outcome: 'bookmark',
      source: result.source.kind,
      bookmarkId: result.bookmark.id,
      turnId: result.bookmark.turnId,
      ...(window ? { from: window.from, to: window.to, messageCharacters: window.total } : {}),
      truncated: window !== undefined && window.to < window.total,
      ...withheldMetadata(result.withheld),
      characters: rendered.content.length
    }
  };
  const title = groupTitle({ source: result.source, bookmarks: [] });
  return window
    ? { result: outcome, sources: [{ kind: 'transcript', label: `Bookmark · ${title}`, sizeChars: rendered.content.length }] }
    : { result: outcome };
}

/** D7: the stamp the room's audience policy reads, and the ids the log names. */
function withheldMetadata(withheld: WorkshopRecallBookmarksWithheld | undefined): Record<string, unknown> {
  return withheld
    ? { [WORKSHOP_CAPABILITY_PUBLICATION_WITHHELD]: withheld.reason, withheldBookmarks: [...withheld.bookmarkIds] }
    : {};
}

function groupTitle(group: Pick<WorkshopRecallBookmarkGroup, 'source'> & { readonly bookmarks: readonly unknown[] }): string {
  return group.source.kind === 'current' ? 'this conversation' : recallQuoted(group.source.header.title);
}

function tooSmall(
  context: WorkshopRecallOperationContext,
  request: BookmarksRequest,
  minimum: number,
  left: number
): WorkshopCapabilityResult {
  return recallRejectedResult(
    context,
    request,
    'recall-context-window',
    `This bookmark call needs at least ${count(minimum)} characters, but half the room left in your context window ` +
      `holds only about ${count(left)}. Answer from what you have, and tell the writer which bookmarks you could not read.`,
    { charactersLeft: left, minimumCharacters: minimum }
  );
}
