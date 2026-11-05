/**
 * The memory sheet's state, as `useWorkshopProjectMemory` holds it and its
 * pure helpers (bookmark sheets, the helper's draft) read it. Types only.
 */

import type { WorkshopMemoryDraft, WorkshopMemoryListedTitle, WorkshopMemoryPinnedEstimate } from '@messages';
import type { WorkshopMemoryHelperDraftState } from '@hooks/domain/workshop/memory/workshopMemoryHelperDraft';

/** What the sheet is for: a card's edit, a saved memory's edit, a turn of this room or of a saved session as source, or nothing. */
export type WorkshopMemorySheetMode = 'card' | 'memory' | 'turn' | 'saved-turn' | 'new';


export interface WorkshopMemorySheetState {
  readonly mode: WorkshopMemorySheetMode;
  /** The card's or bubble's turn. */
  readonly turnId?: string;
  /** The card's index on its turn (Slice 6b); a card's edit only. */
  readonly proposalIndex?: number;
  /** The saved memory being edited: a receipt's or the manager's, or the note an edit card changes (Slice 6c). */
  readonly memoryId?: string;
  readonly draft: WorkshopMemoryDraft;
  /** Titles of the memories `draft.supersedes` names. */
  readonly replaces: readonly WorkshopMemoryListedTitle[];
  /** A saved memory's fields are still being read. */
  readonly loading: boolean;
  /** The pending write's request, while the host saves. */
  readonly saving: boolean;
  readonly estimate?: WorkshopMemoryPinnedEstimate;
  readonly error?: string;
  /** Who the source is, for the source line ("Jill's reply"). */
  readonly sourceLabel?: string;
  /** A bookmark's turn outside the window: the room it was asked in. */
  readonly roomRevision?: number;
  /** A saved session's turn: its session and title. */
  readonly sessionId?: string;
  readonly sessionTitle?: string;
  /** The helper's draft of the title, summary and kind, when the sheet asked for one (Helper Agent Slice 2). */
  readonly helper?: WorkshopMemoryHelperDraftState;
}

/** What a receipt's refused action says beside it. */
export interface WorkshopMemoryReceiptError {
  readonly action: 'forget' | 'restore';
  readonly error: string;
}
