/**
 * LightboxBoardsMenu — the Boards menu in the Lightbox's header (Slice
 * 5A.2), where the Workshop puts its sessions menu, and in its design
 * language: the full tabs' shared `SavedItemsMenu`.
 *
 * Props-only. The trigger names the board on screen and says whether it is
 * saved. The menu: Rename board… (the name sheet), Board another chapter…
 * (the project picker), Open prior board… (the browser), the five newest
 * boards of every chapter, each opening directly, and Browse all boards….
 * Where boards are kept, when that is the session only, is said at its head.
 *
 * Keyboard: the menu's items are buttons; opening it focuses the first,
 * Escape closes it and returns focus to the trigger.
 */
import * as React from 'react';
import { SavedItemsMenu } from '@components/fulltab/SavedItemsMenu';
import type { LightboxBoardsMenuView } from '@hooks/domain/lightbox/lightboxBoardsView';
import { relativeSessionTime } from '@utils/relativeSessionTime';

export interface LightboxBoardsMenuProps {
  open: boolean;
  view: LightboxBoardsMenuView;
  /** A board is being opened, or a run reads the board on screen: opening another waits. */
  openDisabled: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onBoardAnotherChapter: () => void;
  onBrowse: () => void;
  onOpenBoard: (fileId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardsMenu: React.FC<LightboxBoardsMenuProps> = ({
  open,
  view,
  openDisabled,
  onOpenChange,
  onRename,
  onBoardAnotherChapter,
  onBrowse,
  onOpenBoard
}) => (
  <SavedItemsMenu
    open={open}
    label={view.label}
    status={view.status}
    menuId="pm-lb-boards-menu"
    menuLabel="Lightbox board commands"
    triggerTitle="Board commands and recent saved boards"
    focusFirstEnabled
    onOpenChange={onOpenChange}
  >
    <SavedItemsMenu.Heading>Board</SavedItemsMenu.Heading>
    {view.availability && <SavedItemsMenu.Empty>{view.availability}</SavedItemsMenu.Empty>}
    <SavedItemsMenu.Item
      icon="pen"
      disabled={!view.canRename}
      title={view.canRename ? 'Name the board on screen' : 'Board a chapter first'}
      onSelect={onRename}
    >
      Rename board…
    </SavedItemsMenu.Item>
    <SavedItemsMenu.Item icon="doc" onSelect={onBoardAnotherChapter}>
      Board another chapter…
    </SavedItemsMenu.Item>
    <SavedItemsMenu.Rule />
    <SavedItemsMenu.Item icon="cards" onSelect={onBrowse}>
      Open prior board…
    </SavedItemsMenu.Item>

    <SavedItemsMenu.Heading recent>Recent</SavedItemsMenu.Heading>
    {view.recent.length > 0 ? view.recent.map((row) => (
      <SavedItemsMenu.Recent
        key={row.fileId}
        title={row.name}
        meta={`${row.chapter} · ${row.onScreen ? 'on screen' : relativeSessionTime(row.savedAt)}`}
        disabled={openDisabled || row.onScreen}
        onSelect={() => onOpenBoard(row.fileId)}
      />
    )) : (
      <SavedItemsMenu.Empty>No saved boards yet.</SavedItemsMenu.Empty>
    )}

    <SavedItemsMenu.Rule />
    <SavedItemsMenu.Item icon="search" onSelect={onBrowse}>
      Browse all boards…
    </SavedItemsMenu.Item>
  </SavedItemsMenu>
);
