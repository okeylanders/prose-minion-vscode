/**
 * The Notes tab's bookmarks (ADR 2026-11-03 D5, D6): the snapshot's
 * summaries in thread order, each a row that opens its bubble, with a
 * rename and a remove beside it. Presentational: the transport is
 * `useWorkshopBookmarks`, and the open rename lives in
 * `useWorkshopBookmarkRename`.
 *
 * A row whose bubble is outside the snapshot's window (`inWindow`, decided
 * by the host) is tagged "opens in reader": opening it shows the turn in the
 * read-only preview instead of jumping.
 *
 * Every accessible name starts with what the row shows (its label); the
 * meta line is the row's description. A label is writer text: shown, never
 * logged.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { WorkshopBookmarkSummary, WorkshopRenameBookmarkResultPayload } from '@messages';
import { useWorkshopBookmarkRename } from '@hooks/domain/workshop/controllers/useWorkshopBookmarkRename';
import { participantIdentityColorIndex } from '@utils/contextBudget';

export interface WorkshopBookmarkListProps {
  bookmarks: readonly WorkshopBookmarkSummary[];
  /** True while the room's mutation lock is held: no rename or remove is sent. */
  disabled?: boolean;
  /** Opens a bookmark: a jump in the window, the preview outside it. */
  onOpen: (bookmark: WorkshopBookmarkSummary) => void;
  /** Sends a rename and returns its request id, which `renameOutcome` answers. */
  onRename: (bookmarkId: string, label: string | null) => string;
  /** The host's answer to the latest rename. */
  renameOutcome?: WorkshopRenameBookmarkResultPayload | null;
  onRemove: (turnId: string) => void;
}

/** Why another row's Rename waits (PR #189 F-03). */
const RENAME_PENDING = 'Wait for the rename in progress to finish';

const PARTICIPANT_WORDS: Record<WorkshopBookmarkSummary['participant'], string> = {
  host: 'Host reply',
  guest: 'Guest reply',
  tool: 'Tool reply',
  writer: 'Your message',
  session: 'Session'
};

/** The identity a bookmark's icon is colored by, as the rail's other dots are; the writer has none. */
const identityOf = (bookmark: WorkshopBookmarkSummary): string | undefined => {
  if (bookmark.toolId) {
    return `tool:${bookmark.toolId}`;
  }
  return bookmark.personaId;
};

/** The icon's color, through a custom property the stylesheet reads (`.pm-ws-bookmark-icon`). */
const identityStyle = (identity: string): React.CSSProperties => ({
  ['--pm-ws-bookmark-identity' as string]: `var(--pm-identity-${participantIdentityColorIndex(identity)})`
});

export const WorkshopBookmarkList: React.FC<WorkshopBookmarkListProps> = ({
  bookmarks,
  disabled = false,
  onOpen,
  onRename,
  renameOutcome = null,
  onRemove
}) => {
  const rename = useWorkshopBookmarkRename({ bookmarks, onRename, outcome: renameOutcome });
  const idPrefix = React.useId();
  const renameButtons = React.useRef(new Map<string, HTMLButtonElement | null>());
  const { closedId, acknowledgeClosed } = rename;

  // A closed field hands focus back to its row's Rename button, so a
  // keyboard writer is never dropped on the page.
  const returnFocusWhenRenameClosed = React.useCallback(() => {
    if (closedId === undefined) {
      return;
    }
    renameButtons.current.get(closedId)?.focus();
    acknowledgeClosed();
  }, [acknowledgeClosed, closedId]);
  React.useEffect(returnFocusWhenRenameClosed, [returnFocusWhenRenameClosed]);

  const count = bookmarks.length;
  return (
    <section className="pm-ws-block pm-ws-bookmarks" aria-labelledby={`${idPrefix}-title`}>
      <div className="pm-ws-todos-head">
        <div className="pm-ws-eyebrow" id={`${idPrefix}-title`}>
          <Icon name="bookmark" size={12} /> Bookmarks
        </div>
        <span aria-live="polite">{count} · thread order</span>
      </div>
      {count === 0 ? (
        <p className="pm-ws-todos-empty">Bookmark a reply to find it here.</p>
      ) : (
        <ul className="pm-ws-bookmark-items">
          {bookmarks.map((bookmark, index) => {
            const metaId = `${idPrefix}-meta-${index}`;
            const faultId = `${idPrefix}-fault-${index}`;
            const identity = identityOf(bookmark);
            const editing = rename.editingId === bookmark.id;
            return (
              <li className="pm-ws-bookmark" key={bookmark.id}>
                {editing ? (
                  <form
                    className="pm-ws-bookmark-rename"
                    onSubmit={(event) => { event.preventDefault(); rename.saveRename(); }}
                  >
                    <input
                      value={rename.draft}
                      readOnly={rename.saving}
                      autoFocus
                      aria-label="Bookmark name"
                      aria-invalid={rename.fault !== undefined}
                      aria-describedby={rename.fault ? faultId : undefined}
                      placeholder="Leave blank for the default name"
                      onChange={(event) => rename.changeDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          rename.cancelRename();
                        }
                      }}
                    />
                    {rename.fault ? (
                      <p className="pm-ws-bookmark-fault" id={faultId} role="alert">{rename.fault}</p>
                    ) : null}
                    {rename.saving ? (
                      <p className="pm-ws-bookmark-saving" role="status">Saving…</p>
                    ) : null}
                    <div className="pm-ws-bookmark-rename-actions">
                      <button type="submit" disabled={disabled || rename.saving}>Save</button>
                      <button type="button" onClick={rename.cancelRename}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="pm-ws-bookmark-open"
                    aria-label={`${bookmark.label}: ${bookmark.inWindow ? 'show it in the thread' : 'open it in the reader'}`}
                    aria-describedby={metaId}
                    onClick={() => onOpen(bookmark)}
                  >
                    <span
                      className={`pm-ws-bookmark-icon${identity ? '' : ' pm-ws-bookmark-icon-writer'}`}
                      style={identity ? identityStyle(identity) : undefined}
                    >
                      <Icon name="bookmark" size={13} />
                    </span>
                    <span className="pm-ws-bookmark-copy">
                      <span className="pm-ws-bookmark-label">{bookmark.label}</span>
                      <span className="pm-ws-bookmark-meta" id={metaId}>
                        {PARTICIPANT_WORDS[bookmark.participant]}
                        {bookmark.inWindow ? null : (
                          <span className="pm-ws-bookmark-outside">opens in reader</span>
                        )}
                      </span>
                    </span>
                  </button>
                )}
                {editing ? null : (
                  <div className="pm-ws-todo-actions">
                    <button
                      ref={(element) => { renameButtons.current.set(bookmark.id, element); }}
                      type="button"
                      disabled={disabled || rename.renamePending}
                      title={rename.renamePending ? RENAME_PENDING : 'Rename bookmark'}
                      aria-label={`Rename bookmark: ${bookmark.label}`}
                      onClick={() => rename.beginRename(bookmark)}
                    >
                      <Icon name="pen" size={12} />
                    </button>
                    <button
                      type="button"
                      disabled={disabled}
                      title="Remove bookmark"
                      aria-label={`Remove bookmark: ${bookmark.label}`}
                      onClick={() => onRemove(bookmark.turnId)}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};
