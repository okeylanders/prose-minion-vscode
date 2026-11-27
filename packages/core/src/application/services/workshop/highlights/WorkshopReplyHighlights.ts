import type { ShellService } from '@/platform';
import type { WorkshopSessionService } from '../WorkshopSessionService';
import { extractWorkshopReplyControls } from '@/utils/workshopReplyControls';
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
  readonly shell: Pick<ShellService, 'showInformationMessage'>;
}

const KEEP = 'Keep highlights';
const SKIP = 'Skip';

/** VS Code notifications can stay open after a run is stopped. Release the run and ignore any subsequent click. */
async function askToKeep(shell: WorkshopHighlightRequest['shell'], message: string, signal: AbortSignal): Promise<boolean> {
  let cancel!: () => void;
  const cancelled = new Promise<undefined>((resolve) => { cancel = () => resolve(undefined); });
  signal.addEventListener('abort', cancel, { once: true });
  try {
    return !signal.aborted && await Promise.race([shell.showInformationMessage(message, KEEP, SKIP), cancelled]) === KEEP;
  } finally {
    signal.removeEventListener('abort', cancel);
  }
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
    const message = `${request.persona} proposed “${title}” with ${count} ${count === 1 ? 'highlight' : 'highlights'}. Keep this set on the reply and show it if “${displayPath}” is open?`;
    const keep = await askToKeep(request.shell, message, signal);
    if (!current()) {
      return undefined;
    }
    if (!keep) {
      return { ...run, kind: 'skipped' };
    }
    // The writer may have been away while the notification was open. Recheck the exact authorized file.
    const checked = await intake.authorizeExcerptReread(auth.source);
    if (checked.kind === 'authorized' && checked.fsPath === auth.fsPath && current()) {
      return { ...run, kind: 'approved', editor, fsPath: checked.fsPath,
        source: { sourceUri: checked.source.sourceUri, relativePath: checked.source.relativePath } };
    }
  } catch {
    // Catalog, filesystem and notification errors can contain private data.
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
