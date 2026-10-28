/**
 * LightboxBoardBrowserModal — every saved board, of every chapter (Slice
 * 5A.2), in the full tabs' shared `SavedItemBrowserModal`, the Workshop's
 * session browser made shared.
 *
 * Props-only. Search covers names and chapter paths; boards group by date
 * (Today, This week, Earlier) or by chapter. Each row: the board's name, its
 * chapter, when it was saved, the lenses read (and any stale), its
 * approximate cost, the models that read it, and an "On screen" mark. A row
 * opens its board; Rename names its file in place, by the one name rule;
 * Delete asks first. The footer's "Open a board file…" opens the host's
 * picker for a `*.board.json` anywhere. Session-only, it says boards last
 * only for the session.
 *
 * Keyboard (the shared browser's opt-ins): the search field is focused on
 * open; Enter and Escape in a rename field return focus to its Rename;
 * Delete moves focus to Keep, the safe answer; a confirmed delete moves it
 * to the next row's Delete, or to the search field.
 */
import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { SavedItemBrowserModal, type SavedItemGrouping } from '@components/fulltab/SavedItemBrowserModal';
import { SavedItemRow } from '@components/fulltab/SavedItemRow';
import {
  LIGHTBOX_BOARD_NAME_CHARACTERS,
  LIGHTBOX_BOARD_NAME_FAULTS,
  checkLightboxBoardName
} from '@shared/constants/lightboxBoardName';
import {
  lightboxBoardsByChapter,
  lightboxBoardsByDate,
  searchLightboxBoardRows,
  type LightboxBoardRow,
  type LightboxBoardsBrowserView
} from '@hooks/domain/lightbox/lightboxBoardsView';

export interface LightboxBoardBrowserModalProps {
  open: boolean;
  view: LightboxBoardsBrowserView;
  query: string;
  /** The file being opened, until the host answers. */
  opening: string | null;
  openingFile: boolean;
  /** A run reads the board on screen: opening another waits. */
  reading: boolean;
  onQueryChange: (query: string) => void;
  onOpen: (fileId: string) => void;
  onOpenFile: () => void;
  onRename: (fileId: string, name: string) => void;
  onDelete: (fileId: string) => void;
  onClose: () => void;
  /** The clock the date groups are told by; now by default (tests pin it). */
  now?: () => Date;
}

/** The rule's words for a draft it refuses; an empty draft keeps the name as it is. */
function renameRule(draft: string): string | undefined {
  if (draft.trim().length === 0) {
    return 'A board needs a name. Leave the field with Escape to keep the one it has.';
  }
  const check = checkLightboxBoardName(draft);
  return check.kind === 'invalid' ? LIGHTBOX_BOARD_NAME_FAULTS[check.fault] : undefined;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxBoardBrowserModal: React.FC<LightboxBoardBrowserModalProps> = ({
  open,
  view,
  query,
  opening,
  openingFile,
  reading,
  onQueryChange,
  onOpen,
  onOpenFile,
  onRename,
  onDelete,
  onClose,
  now
}) => {
  const rows = React.useMemo(() => searchLightboxBoardRows(view.rows, query), [query, view.rows]);
  const groupings = React.useMemo<ReadonlyArray<SavedItemGrouping<LightboxBoardRow>>>(() => [
    { key: 'date', label: 'Date', group: (items) => lightboxBoardsByDate(items, now?.()) },
    { key: 'chapter', label: 'Chapter', group: lightboxBoardsByChapter }
  ], [now]);
  const changing = !view.saving;
  const openingAny = opening !== null || openingFile;

  return (
    <SavedItemBrowserModal<LightboxBoardRow>
      open={open}
      titleId="lightbox-board-browser-title"
      closeLabel="Close saved boards"
      className="pm-ws-session-browser-modal pm-lb-board-browser"
      eyebrow="Lightbox · Boards"
      title="Open a prior board"
      description={
        <>
          Opening shows a board exactly as it was saved, against the text it was read from. Each board is
          one file that saves itself as you read; &ldquo;Read the current text&rdquo; starts a new one.
        </>
      }
      search={{
        label: 'Search board names and chapters',
        placeholder: 'Search names and chapter paths…',
        scope: 'names · paths',
        query,
        disabled: view.rows.length === 0,
        onChange: onQueryChange
      }}
      groupLabel="Group boards"
      groupings={groupings}
      status={view.notes.map((note) => (
        <div
          key={note.text}
          className={note.tone === 'quiet' ? 'pm-ws-sessions-pending' : 'pm-ws-sessions-unavailable'}
          role={note.tone === 'alert' ? 'alert' : 'status'}
        >
          {note.tone !== 'quiet' && <Icon name={note.tone === 'alert' ? 'alert' : 'doc'} size={16} />} {note.text}
        </div>
      ))}
      section={{ id: 'lightbox-saved-boards-heading', title: 'Saved boards', note: 'newest first, every chapter' }}
      emptyText={view.rows.length > 0 ? 'No saved boards match this search.' : view.empty}
      items={rows}
      itemKey={(row) => row.fileId}
      itemTitle={(row) => row.name}
      renderRow={(row, controls) => (
        <SavedItemRow
          title={row.name}
          active={row.onScreen}
          disabled={changing}
          glyph={
            <div className="pm-ws-session-host-glyph pm-lb-board-glyph" aria-hidden="true">
              <Icon name="cards" size={20} />
            </div>
          }
          badges={row.onScreen && <span className="pm-ws-session-badge">On screen</span>}
          metaTitle={[row.chapter, row.when, row.lenses, row.stale, row.cost].filter(Boolean).join(' · ')}
          meta={
            <>
              <span className="pm-lb-board-chapter">{row.chapter}</span>
              <span>·</span>
              <time dateTime={row.dateTime}>{row.when}</time>
              <span>·</span>
              <span>{row.lenses}</span>
              {row.stale && (<><span>·</span><span>{row.stale}</span></>)}
              {row.cost && (<><span>·</span><span>{row.cost}</span></>)}
            </>
          }
          extra={row.models && (
            <div className="pm-ws-session-row-preview pm-lb-board-models" title={row.modelIds}>{row.models}</div>
          )}
          renameLabel="Rename board"
          renameMaxLength={LIGHTBOX_BOARD_NAME_CHARACTERS}
          primary={
            <button
              className="pm-ws-session-primary pm-ws-session-open"
              type="button"
              disabled={row.onScreen || reading || openingAny}
              title={row.onScreen ? 'This board is on screen' : reading ? 'A run is reading the board on screen' : undefined}
              aria-label={`Open ${row.name}`}
              onClick={() => onOpen(row.fileId)}
            >
              {opening === row.fileId ? 'Opening…' : 'Open'}
            </button>
          }
          controls={controls}
          onOpen={row.onScreen || reading || openingAny ? undefined : () => onOpen(row.fileId)}
        />
      )}
      footer={
        <>
          <span>{view.caption}</span>
          <button
            className="pm-ws-session-secondary"
            type="button"
            disabled={reading || openingAny}
            title="Open a saved board file (*.board.json) from anywhere"
            onClick={onOpenFile}
          >
            <Icon name="doc" size={13} /> {openingFile ? 'Opening…' : 'Open a board file…'}
          </button>
        </>
      }
      onRename={onRename}
      onDelete={onDelete}
      onClose={onClose}
      renameRule={renameRule}
      sendOnlyEdits
      returnFocus
    />
  );
};
