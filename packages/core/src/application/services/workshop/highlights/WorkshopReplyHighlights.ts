import { samePath } from '@/application/services/fileEdits/fileEditIdentity';
import type { WorkshopSessionService } from '../WorkshopSessionService';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
import type { WorkshopExcerpt, WorkshopHighlightPrompt, WorkshopTurn } from '@messages';
import type { WorkshopContextIntakeService } from '../WorkshopContextIntakeService';
import type { WorkshopHighlightEditor } from './WorkshopHighlightEditor';
import { WORKSHOP_HIGHLIGHTS_TAG, type WorkshopReplyHighlightsControl } from '@/utils/workshopReplyHighlights';
import {
  WORKSHOP_HIGHLIGHT_FRAME_REASONS,
  WORKSHOP_HIGHLIGHT_PLACE_REASONS,
  type WorkshopHighlightFrameReason,
  type WorkshopHighlightTrailerOutcomes
} from '@shared/types/workshopTrailerOutcomes';

/** A choice belongs to this provider reply, writer turn, room generation and excerpt version. */
interface WorkshopHighlightRun {
  readonly requestId: string;
  readonly reply: string;
  readonly roomRevision: number;
  readonly excerptVersion: number;
}

export interface WorkshopHighlightTarget extends WorkshopHighlightRun {
  readonly kind: 'approved';
  readonly source: NonNullable<WorkshopTurn['highlights']>['source'];
  readonly fsPath: string;
  readonly editor: WorkshopHighlightEditor;
}

export type WorkshopHighlightChoice = WorkshopHighlightTarget | (WorkshopHighlightRun & { readonly kind: 'skipped' });

export type WorkshopHighlightProposalDetails = Omit<Extract<WorkshopHighlightPrompt, { kind: 'proposal' }>, 'kind' | 'promptId'>;

interface WorkshopHighlightRequest {
  readonly reply: string;
  readonly requestId: string;
  readonly roomRevision: number;
  readonly excerpt?: WorkshopExcerpt;
  readonly persona: string;
  readonly signal: AbortSignal;
  readonly session: Pick<WorkshopSessionService, 'readRoomRevision' | 'getExcerptVersion' | 'personaReplyReactionTarget'>;
  readonly intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread' | 'toDisplayPath'>;
  readonly editor?: WorkshopHighlightEditor;
  readonly ask: (details: WorkshopHighlightProposalDetails, signal: AbortSignal) => Promise<boolean>;
}

export async function authorizeWorkshopReplyHighlights(request: WorkshopHighlightRequest): Promise<WorkshopHighlightChoice | undefined> {
  const { reply, requestId, roomRevision, excerpt, intake, editor, signal, session } = request;
  if (!editor || !excerpt || excerpt.source.kind === 'manual' || signal.aborted || !reply.toLowerCase().includes(WORKSHOP_HIGHLIGHTS_TAG)) {
    return undefined;
  }
  const set = extractWorkshopReplyControls(reply, { memoryOpen: false }).highlights?.set;
  const current = () => !signal.aborted && session.readRoomRevision() === roomRevision
    && session.getExcerptVersion() === excerpt.version && session.personaReplyReactionTarget(requestId) !== undefined;
  if (!set || !current()) {
    return undefined;
  }
  const run = { requestId, reply, roomRevision, excerptVersion: excerpt.version };
  const { sourceUri, relativePath } = excerpt.source;
  try {
    const auth = await intake.authorizeExcerptReread({ kind: 'file', sourceUri, relativePath });
    if (auth.kind !== 'authorized' || !current()) {
      return undefined;
    }
    const count = set.places.length;
    const title = set.title.replace(/\s+/g, ' ').trim();
    const displayPath = auth.source.configuredResource?.path ?? intake.toDisplayPath(auth.fsPath);
    const keep = await request.ask({ persona: request.persona, roomRevision, title, count, displayPath }, signal);
    if (!current()) {
      return undefined;
    }
    if (!keep) {
      return { ...run, kind: 'skipped' };
    }
    // The writer may have been away while the question was open. Recheck the exact authorized file.
    const checked = await intake.authorizeExcerptReread(auth.source);
    if (checked.kind === 'authorized' && samePath(checked.fsPath, auth.fsPath) && current()) {
      return { ...run, kind: 'approved', editor, fsPath: checked.fsPath,
        source: { sourceUri: checked.source.sourceUri, relativePath: checked.source.relativePath } };
    }
  } catch {
    // Catalog, filesystem and prompt errors can contain private data.
  }
  return undefined;
}

/** Called only after the ledger adopted this reply. An editor failure cannot undo an adopted turn. */
export function displayCommittedWorkshopHighlights(
  turn: WorkshopTurn,
  control: WorkshopReplyHighlightsControl,
  choice: WorkshopHighlightChoice | undefined
): WorkshopHighlightTrailerOutcomes {
  const rejected: WorkshopHighlightFrameReason[] = control.rejections.map((reason) =>
    reason === 'extra' || reason === 'misplaced' ? reason : 'malformed');
  let placed = 0;
  let closed = 0;
  const dropped: WorkshopHighlightTrailerOutcomes['dropped'] = [];
  if (turn.highlights && turn.personaLabel && choice?.kind === 'approved') {
    try {
      const counts = choice.editor.showOpen(turn.id, choice.fsPath, turn.personaLabel, turn.highlights.set);
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
    rejected.push(choice?.kind === 'skipped' ? 'skipped' : 'unavailable');
  }
  return {
    placed, closed, dropped,
    rejected: WORKSHOP_HIGHLIGHT_FRAME_REASONS.flatMap((reason) => {
      const count = rejected.filter((entry) => entry === reason).length;
      return count ? [{ reason, count }] : [];
    })
  };
}
