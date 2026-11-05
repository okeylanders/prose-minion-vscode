/**
 * The host's side of recall's live-room port (ADR 2026-11-05 D1): the open
 * room's bookmarks, read from the full ledger, filtered by the room's own
 * audience rule. It reads; it never writes, flushes, or notifies, so asking
 * changes nothing any persona is sent.
 */

import type { WorkshopTurn, WorkshopTurnBookmark } from '@messages';
import type { WorkshopCapabilityPrincipal } from '@shared/types/workshopCapabilities';
import {
  isWorkshopTurnVisibleToParticipant,
  workshopTurnAudience
} from '@/application/services/workshop/WorkshopRoomAudience';
import { workshopRecallBookmark } from '@/application/services/workshop/recall/WorkshopRecallBookmarks';
import type {
  WorkshopLiveRoomBookmarkRead,
  WorkshopLiveRoomBookmarkRow,
  WorkshopLiveRoomBookmarks
} from '@/application/services/workshop/recall/WorkshopLiveRoomBookmarks';

/** Satisfied by WorkshopSessionService: two defensive reads. */
export interface WorkshopLiveRoomLedger {
  readRoomLedger(): WorkshopTurn[];
  readRoomBookmarks(): WorkshopTurnBookmark[];
}

export class WorkshopLiveRoomBookmarkReader implements WorkshopLiveRoomBookmarks {
  constructor(
    private readonly room: WorkshopLiveRoomLedger,
    /** The open room's timezone, as its time service holds it. */
    private readonly timezone: () => string
  ) {}

  readLiveRoomBookmarks(reader: WorkshopCapabilityPrincipal | undefined): WorkshopLiveRoomBookmarkRead {
    return this.read((turn, roomVisible) => (reader ? isWorkshopTurnVisibleToParticipant(turn, reader) : roomVisible));
  }

  /** The writer sees the whole room (ADR 2026-11-05 D8): every bookmark, for the Bookmarks screen. */
  readWriterBookmarks(): WorkshopLiveRoomBookmarkRead {
    return this.read(() => true);
  }

  private read(visible: (turn: WorkshopTurn, roomVisible: boolean) => boolean): WorkshopLiveRoomBookmarkRead {
    const turns = this.room.readRoomLedger();
    const byTurn = new Map(this.room.readRoomBookmarks().map((bookmark) => [bookmark.turnId, bookmark]));
    const bookmarks = byTurn.size === 0 ? [] : turns.flatMap((turn, index): WorkshopLiveRoomBookmarkRow[] => {
      const bookmark = byTurn.get(turn.id);
      if (!bookmark) {
        return [];
      }
      const roomVisible = workshopTurnAudience(turn).kind === 'room';
      return visible(turn, roomVisible) ? [{ ...workshopRecallBookmark(bookmark, turn, index + 1), roomVisible }] : [];
    });
    return { timezone: this.timezone(), turnCount: turns.length, bookmarks };
  }
}
