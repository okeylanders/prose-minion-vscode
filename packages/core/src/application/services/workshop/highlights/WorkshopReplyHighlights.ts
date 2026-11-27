import type { WorkshopExcerpt, WorkshopTurn } from '@messages';
import type { WorkshopContextIntakeService } from '../WorkshopContextIntakeService';
import type { WorkshopHighlightEditor } from './WorkshopHighlightEditor';
import { WORKSHOP_HIGHLIGHTS_TAG, type WorkshopReplyHighlightsControl } from '@/utils/workshopReplyHighlights';
import {
  WORKSHOP_HIGHLIGHT_FRAME_REASONS,
  WORKSHOP_HIGHLIGHT_PLACE_REASONS,
  type WorkshopHighlightFrameReason,
  type WorkshopHighlightTrailerOutcomes
} from '@shared/types/workshopTrailerOutcomes';

/** Bound to a writer's message and its excerpt before dispatch. The host authorizes that source when the reply arrives. */
export interface WorkshopHighlightTarget {
  readonly requestId: string;
  readonly roomRevision: number;
  readonly excerptVersion: number;
  readonly source: NonNullable<WorkshopTurn['highlights']>['source'];
  readonly fsPath: string;
  readonly editor: WorkshopHighlightEditor;
}

export async function authorizeWorkshopReplyHighlights(
  reply: string,
  requestId: string,
  roomRevision: number,
  excerpt: WorkshopExcerpt | undefined,
  intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread'>,
  editor: WorkshopHighlightEditor | undefined,
  signal: AbortSignal
): Promise<WorkshopHighlightTarget | undefined> {
  if (!editor || !excerpt || excerpt.source.kind === 'manual' || signal.aborted || !reply.toLowerCase().includes(WORKSHOP_HIGHLIGHTS_TAG)) {
    return undefined;
  }
  const { sourceUri, relativePath } = excerpt.source;
  try {
    const auth = await intake.authorizeExcerptReread({ kind: 'file', sourceUri, relativePath });
    if (auth.kind === 'authorized' && !signal.aborted) {
      return { requestId, roomRevision, excerptVersion: excerpt.version, editor, fsPath: auth.fsPath,
        source: { sourceUri: auth.source.sourceUri, relativePath: auth.source.relativePath } };
    }
  } catch {
    // Catalog and filesystem errors can contain paths. A refusal is recorded by closed reason.
  }
  return undefined;
}

/** Called only after the ledger adopted this reply. An editor failure cannot undo an adopted turn. */
export function displayCommittedWorkshopHighlights(
  turn: WorkshopTurn,
  control: WorkshopReplyHighlightsControl,
  target: WorkshopHighlightTarget | undefined
): WorkshopHighlightTrailerOutcomes {
  const rejected: WorkshopHighlightFrameReason[] = control.rejections.map((reason) =>
    reason === 'extra' || reason === 'misplaced' ? reason : 'malformed');
  let placed = 0;
  let closed = 0;
  const dropped: WorkshopHighlightTrailerOutcomes['dropped'] = [];
  if (turn.highlights && turn.personaLabel && target) {
    try {
      const counts = target.editor.showOpen(turn.id, target.fsPath, turn.personaLabel, turn.highlights.set);
      if (counts) {
        placed = counts.placed;
        for (const reason of WORKSHOP_HIGHLIGHT_PLACE_REASONS) {
          if (reason !== 'display-failed' && counts.dropped[reason]) {
            dropped.push({ reason, count: counts.dropped[reason] });
          }
        }
      } else {
        closed = turn.highlights.set.places.length;
      }
    } catch {
      dropped.push({ reason: 'display-failed', count: turn.highlights.set.places.length });
    }
  } else if (control.set) {
    rejected.push('unavailable');
  }
  return {
    placed, closed, dropped,
    rejected: WORKSHOP_HIGHLIGHT_FRAME_REASONS.flatMap((reason) => {
      const count = rejected.filter((entry) => entry === reason).length;
      return count ? [{ reason, count }] : [];
    })
  };
}
