/**
 * `transcript.search` for one persona turn (ADR 2026-10-05 §1, §5): the
 * service's search, rendered, with what it searched and left unsearched. A
 * search shows snippets, not sessions, so it names no manifest row.
 */

import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallSearch } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { workshopTranscriptRecallRequestSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  recallFailedResult,
  recallScanCosts,
  throwIfRecallTurnAborted,
  WorkshopRecallOperationContext,
  WorkshopRecallRequestOf
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

export async function runWorkshopRecallSearch(
  recall: Pick<WorkshopTranscriptRecallService, 'search'>,
  context: WorkshopRecallOperationContext,
  request: WorkshopRecallRequestOf<'transcript.search'>
): Promise<WorkshopCapabilityResult> {
  const result = await recall.search(
    { query: request.query, sessionId: request.sessionId, personaId: request.personaId },
    context.turn.signal
  );
  throwIfRecallTurnAborted(context.turn.signal);
  const content = renderWorkshopRecallSearch(result, { now: context.now() });
  if (!result.available || result.outcome === 'unknown-session') {
    return recallFailedResult(request, content, result.available
      ? { outcome: 'unknown-session', liveSession: result.liveSession }
      : { outcome: 'unavailable', unavailableReason: result.reason });
  }
  const { bounds, search } = result;
  const notSearched = bounds.notSearchedBySessionLimit + bounds.notSearchedByByteBudget;
  return {
    capability: request.capability,
    status: 'success',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content,
    metadata: {
      outcome: 'searched',
      sessionCount: bounds.sessionsSearched,
      corpusSessions: bounds.corpusSessions,
      notSearched,
      matchMode: search.mode ?? 'none',
      matchedHits: search.matchedHits,
      shownHits: search.shownHits,
      ...recallScanCosts(bounds),
      truncated: search.shownHits < search.matchedHits || notSearched > 0 || bounds.listingTruncated,
      characters: content.length
    }
  };
}
