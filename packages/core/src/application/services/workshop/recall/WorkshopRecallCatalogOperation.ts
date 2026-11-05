/**
 * `transcript.catalog` for one persona turn (ADR 2026-10-05 §1, D8): the
 * service's catalog, rendered, with the counts its card records. A catalog
 * puts no session in context, so it names no manifest row.
 */

import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallCatalog } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRenderer';
import { workshopTranscriptRecallRequestSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  recallFailedResult,
  throwIfRecallTurnAborted,
  WorkshopRecallOperationContext,
  WorkshopRecallRequestOf
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

export async function runWorkshopRecallCatalog(
  recall: Pick<WorkshopTranscriptRecallService, 'catalog'>,
  context: WorkshopRecallOperationContext,
  request: WorkshopRecallRequestOf<'transcript.catalog'>
): Promise<WorkshopCapabilityResult> {
  const result = await recall.catalog({ personaId: request.personaId, match: request.match }, context.turn.signal);
  throwIfRecallTurnAborted(context.turn.signal);
  const content = renderWorkshopRecallCatalog(result, { now: context.now() });
  if (!result.available) {
    return recallFailedResult(request, content, { outcome: 'unavailable', unavailableReason: result.reason });
  }
  return {
    capability: request.capability,
    status: 'success',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content,
    metadata: {
      outcome: 'catalog',
      sessionCount: result.sessions.length,
      matchingSessions: result.matchingSessions,
      ...(result.match ? { matchMode: result.match.mode ?? 'none' } : {}),
      listingTruncated: result.listingTruncated,
      truncated: result.sessions.length < result.matchingSessions || result.listingTruncated,
      characters: content.length
    }
  };
}
