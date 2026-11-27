import type { WorkshopHighlightsDraft } from '@/utils/workshopReplyHighlights';
import type { WorkshopHighlightPlacement } from './placeWorkshopHighlights';

export interface WorkshopHighlightCounts {
  readonly placed: number;
  readonly dropped: WorkshopHighlightPlacement['dropped'];
}

/** The caller authorizes the absolute path on this host before every draw or open. */
export interface WorkshopHighlightEditor {
  /** Changes when the window clears all highlights, invalidating a pending Show. */
  readonly clearGeneration?: number;
  /** Synchronous on an open document. Called after a reply commits. */
  showOpen(turnId: string, fsPath: string, persona: string, set: WorkshopHighlightsDraft): WorkshopHighlightCounts | undefined;
  /** Writer's Show gesture. Recheck the live room/turn after opening, before drawing. */
  show(turnId: string, fsPath: string, persona: string, set: WorkshopHighlightsDraft, current: () => boolean): Promise<WorkshopHighlightCounts | undefined>;
  clear(turnId: string): void;
  /** Drop sets whose replies left this room, including on reset and disposal. */
  retain(turnIds: ReadonlySet<string>): void;
}
