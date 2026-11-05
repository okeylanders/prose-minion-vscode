/**
 * A bubble's Bookmark toggle (ADR 2026-11-03 D5): one pressed-state button in
 * the bubble's action row, offered only on turns the host would accept (the
 * shared `isWorkshopBookmarkableTurn` rule, decided by the bubble).
 *
 * Its accessible name is its visible label ("Bookmark" or "Bookmarked"), and
 * `aria-pressed` carries the state. It posts nothing itself: the caller sends
 * the change and the next snapshot says what the host kept.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';

export interface WorkshopBookmarkToggleProps {
  turnId: string;
  bookmarked: boolean;
  /** True while the room's mutation lock is held, as for the bubble's other actions. */
  disabled?: boolean;
  onToggle: (turnId: string, bookmarked: boolean) => void;
}

export const WorkshopBookmarkToggle: React.FC<WorkshopBookmarkToggleProps> = ({
  turnId,
  bookmarked,
  disabled = false,
  onToggle
}) => (
  <button
    type="button"
    className={`pm-ws-bookmark-toggle${bookmarked ? ' pm-ws-bookmark-toggle-on' : ''}`}
    aria-pressed={bookmarked}
    disabled={disabled}
    title={disabled
      ? 'Wait for the room to finish before changing bookmarks'
      : bookmarked
        ? 'Remove this bookmark'
        : 'Bookmark this to find it in Notes'}
    onClick={() => onToggle(turnId, !bookmarked)}
  >
    <Icon name="bookmark" size={13} /> {bookmarked ? 'Bookmarked' : 'Bookmark'}
  </button>
);
