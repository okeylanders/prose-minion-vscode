/**
 * `transcript.todos` for one persona turn (ADR 2026-10-05 D5–D7): the
 * service's to-do lists, rendered, with the items shown and one manifest row
 * naming the sessions whose to-dos it showed (Slice 3 decision 3).
 */

import type { WorkshopCapabilityResult } from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { renderWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodoList';
import { recallLabel, recallLabelList } from '@/application/services/workshop/recall/WorkshopRecallText';
import { recallQuoted } from '@/application/services/workshop/recall/WorkshopRecallCopy';
import { workshopTranscriptRecallRequestSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import {
  recallFailedResult,
  recallScanCosts,
  throwIfRecallTurnAborted,
  WorkshopRecallOperationContext,
  WorkshopRecallOperationOutcome,
  WorkshopRecallRequestOf
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

/** Session titles in a to-do list's manifest label. */
const TODO_LABEL_TITLES = 400;

export async function runWorkshopRecallTodos(
  recall: Pick<WorkshopTranscriptRecallService, 'todos'>,
  context: WorkshopRecallOperationContext,
  request: WorkshopRecallRequestOf<'transcript.todos'>
): Promise<WorkshopRecallOperationOutcome> {
  const { capability: _capability, ...filters } = request;
  const result = await recall.todos(filters, context.turn.signal);
  throwIfRecallTurnAborted(context.turn.signal);
  const rendered = renderWorkshopRecallTodos(result, { now: context.now() });
  if (!result.available || result.outcome === 'unknown-session') {
    return {
      result: recallFailedResult(request, rendered.content, result.available
        ? { outcome: 'unknown-session', liveSession: result.liveSession }
        : { outcome: 'unavailable', unavailableReason: result.reason })
    };
  }
  const { bounds } = result;
  const shown = rendered.shown.map(({ sessionId, todoId }) => ({ sessionId: recallLabel(sessionId), todoId: recallLabel(todoId) }));
  const titles = result.sessions
    .filter(({ header }) => rendered.shown.some((pair) => pair.sessionId === header.sessionId))
    .map(({ header }) => recallQuoted(header.title));
  const outcome: WorkshopCapabilityResult = {
    capability: request.capability,
    status: 'success',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content: rendered.content,
    metadata: {
      outcome: 'todos',
      status: result.status,
      sessionCount: bounds.sessionsScanned,
      sessionsShown: titles.length,
      shown,
      notShownForSpace: rendered.notShownForSpace,
      omittedByItemLimit: bounds.omittedByItemLimit,
      ...recallScanCosts(bounds),
      truncated: rendered.notShownForSpace > 0 || bounds.omittedByItemLimit > 0 ||
        bounds.notScannedBySessionLimit > 0 || bounds.notScannedByByteBudget > 0 || bounds.listingTruncated,
      characters: rendered.content.length
    }
  };
  return shown.length > 0
    ? {
        result: outcome,
        sources: [{
          kind: 'transcript',
          label: `To-dos · ${recallLabelList(titles, TODO_LABEL_TITLES)}`,
          sizeChars: rendered.content.length
        }]
      }
    : { result: outcome };
}
