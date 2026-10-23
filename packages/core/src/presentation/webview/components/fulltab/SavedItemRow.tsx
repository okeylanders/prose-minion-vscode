/**
 * SavedItemRow — one row of the shared saved-item browser (Lightbox Slice
 * 5A.2, extracted from the Workshop's session browser). The Workshop's
 * markup and classes exactly: a glyph, the title (or the inline rename
 * field), badges, a meta line, anything the tab adds under it, the utility
 * actions (Rename, the tab's own, Delete, or the delete's Confirm and Keep)
 * that float over the row's corner, and the primary action. A click on the
 * row, outside its buttons and field, opens it.
 *
 * The row's rename and delete state belong to the browser
 * (`SavedItemBrowserModal`), which hands them in as `controls`.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';

/** What the browser hands each row: its rename and delete state, and the buttons focus may return to. */
export interface SavedItemRowControls {
  editing: boolean;
  renameDraft: string;
  /** Why the draft cannot be saved, in the rule's words; the field stays open (an opt-in check). */
  renameError?: string;
  confirmingDelete: boolean;
  beginRename: () => void;
  changeRenameDraft: (value: string) => void;
  /** Leaving the field, or Enter: save the draft. False when it was refused and the field stays open. */
  commitRename: (how: 'enter' | 'leave') => boolean;
  cancelRename: () => void;
  beginDelete: () => void;
  acceptDelete: () => void;
  cancelDelete: () => void;
  /** Refs for the browser to return focus to; they change no markup. */
  renameButton: (element: HTMLButtonElement | null) => void;
  deleteButton: (element: HTMLButtonElement | null) => void;
  keepButton: (element: HTMLButtonElement | null) => void;
}

export interface SavedItemRowProps {
  title: string;
  /** The Workshop's autosaved room: highlighted, no rename or delete, and the tab's own primary action. */
  current?: boolean;
  /** The item open now (the Workshop's "Open in Workshop", the Lightbox's "On screen"). */
  active?: boolean;
  /** Room-changing actions are off (a run, a pending action, or no saving). */
  disabled: boolean;
  glyph: React.ReactNode;
  badges?: React.ReactNode;
  meta: React.ReactNode;
  metaTitle: string;
  /** Under the meta line (the Workshop's preview). */
  extra?: React.ReactNode;
  /** The rename field's accessible name ("Rename session"). */
  renameLabel: string;
  renameMaxLength?: number;
  /** The tab's own utility actions, between Rename and Delete. */
  utilities?: React.ReactNode;
  primary: React.ReactNode;
  controls: SavedItemRowControls;
  /** A click on the row opens it; none for a row that does not open. */
  onOpen?: () => void;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const SavedItemRow: React.FC<SavedItemRowProps> = ({
  title,
  current = false,
  active = false,
  disabled,
  glyph,
  badges,
  meta,
  metaTitle,
  extra,
  renameLabel,
  renameMaxLength,
  utilities,
  primary,
  controls,
  onOpen
}) => {
  const openFromRow = (event: React.MouseEvent<HTMLElement>) => {
    if (
      current ||
      disabled ||
      !onOpen ||
      (event.target instanceof Element && event.target.closest('button, input'))
    ) {
      return;
    }
    onOpen();
  };
  const { editing, confirmingDelete } = controls;
  const errorId = React.useId();
  // An Enter that saved has settled the field; the blur that follows saves nothing more.
  const settled = React.useRef(false);

  return (
    <article
      className={[
        'pm-ws-session-browser-row',
        current ? 'pm-ws-session-current' : '',
        active ? 'pm-ws-session-active' : ''
      ].filter(Boolean).join(' ')}
      onClick={openFromRow}
    >
      {glyph}
      <div className="pm-ws-session-row-main">
        <div className="pm-ws-session-row-title">
          {editing ? (
            <input
              aria-label={renameLabel}
              value={controls.renameDraft}
              autoFocus
              maxLength={renameMaxLength}
              aria-invalid={controls.renameError ? true : undefined}
              aria-describedby={controls.renameError ? errorId : undefined}
              onChange={(event) => controls.changeRenameDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  // Saved, or refused with the field kept open (and focused) to correct it.
                  if (controls.commitRename('enter')) {
                    settled.current = true;
                    event.currentTarget.blur();
                  }
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  controls.cancelRename();
                }
              }}
              onBlur={() => {
                if (settled.current) {
                  settled.current = false;
                  return;
                }
                controls.commitRename('leave');
              }}
            />
          ) : (
            <strong title={title}>{title}</strong>
          )}
          {badges}
        </div>
        {editing && controls.renameError && (
          <p className="pm-ws-session-rename-error" id={errorId} role="alert">{controls.renameError}</p>
        )}
        <div className="pm-ws-session-row-meta" title={metaTitle}>
          {meta}
        </div>
        {extra}
      </div>
      {!current && (
        <div
          className={`pm-ws-session-utility-actions${
            confirmingDelete || editing ? ' pm-ws-session-utility-actions-live' : ''
          }`}
        >
          {confirmingDelete ? (
            <>
              <button
                className="pm-ws-session-icon pm-ws-session-delete-confirm"
                type="button"
                disabled={disabled}
                aria-label={`Confirm delete ${title}`}
                onClick={controls.acceptDelete}
              >
                <Icon name="check" size={14} />
              </button>
              <button
                ref={controls.keepButton}
                className="pm-ws-session-icon"
                type="button"
                aria-label={`Keep ${title}`}
                onClick={controls.cancelDelete}
              >
                <Icon name="x" size={13} />
              </button>
            </>
          ) : (
            <>
              <button
                ref={controls.renameButton}
                className="pm-ws-session-icon"
                type="button"
                disabled={disabled}
                aria-label={`Rename ${title}`}
                onClick={controls.beginRename}
              >
                <Icon name="pen" size={13} />
              </button>
              {utilities}
              <button
                ref={controls.deleteButton}
                className="pm-ws-session-icon pm-ws-session-delete"
                type="button"
                disabled={disabled}
                aria-label={`Delete ${title}`}
                onClick={controls.beginDelete}
              >
                <Icon name="trash" size={14} />
              </button>
            </>
          )}
        </div>
      )}
      <div className="pm-ws-session-row-actions">
        {primary}
      </div>
    </article>
  );
};
