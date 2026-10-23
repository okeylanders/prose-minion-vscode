/**
 * SavedItemBrowserModal — the full tabs' saved-item browser (Lightbox Slice
 * 5A.2, extracted from the Workshop's session browser, whose markup and
 * classes it keeps exactly, so the two tabs speak one design language).
 *
 * The shell header, toolbar and footer stay fixed; only the list scrolls.
 * It owns what every saved-item browser does: the search field (focused on
 * open), the grouping toggle (the first grouping on open), the groups and
 * their counts, and each row's inline rename and delete-with-confirm, with
 * Escape cancelling either before it closes the browser. The tab supplies
 * its words, its groupings, its rows' content (`renderRow`, through
 * `SavedItemRow`), anything above the list (the Workshop's current room),
 * its status notes and its footer. Items stay host-side; rows get summaries.
 *
 * Three opt-ins the Lightbox takes, so the Workshop renders and behaves as
 * it did (each is a candidate for the Workshop too):
 * - `renameRule`: a draft the rule refuses keeps the field open, marked
 *   invalid, with the rule's words, on Enter and on leaving alike.
 * - `sendOnlyEdits`: until the writer types, the field follows the item's
 *   title as the host updates it, and leaving it sends nothing; an edit is
 *   sent only when it differs from the title standing now (PR #164 F-04).
 * - `returnFocus`: Enter and Escape in the field return focus to the row's
 *   Rename; Delete moves focus to Keep, the safe answer, and Keep or Escape
 *   back to Delete; a confirmed delete keeps focus on the row's Delete
 *   until the row goes, then moves it to the next row's Delete, or to the
 *   search field when none is below.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import type { SavedItemGroup } from '@utils/savedItemGroups';
import type { SavedItemRowControls } from '@components/fulltab/SavedItemRow';

export interface SavedItemGrouping<T> {
  key: string;
  label: string;
  group: (items: readonly T[]) => Array<SavedItemGroup<T>>;
}

export interface SavedItemBrowserModalProps<T> {
  open: boolean;
  titleId: string;
  closeLabel: string;
  /** The dialog box's own class beside the shell's. */
  className: string;
  eyebrow: string;
  title: string;
  description: React.ReactNode;
  search: {
    label: string;
    placeholder: string;
    /** The pill inside the field naming what it searches ("greps content"). */
    scope?: string;
    query: string;
    disabled: boolean;
    onChange: (query: string) => void;
  };
  /** The grouping toggle's accessible name. */
  groupLabel: string;
  /** The groupings, the first shown on open. */
  groupings: ReadonlyArray<SavedItemGrouping<T>>;
  status: React.ReactNode;
  /** A section above the list (the Workshop's current room). */
  leading?: React.ReactNode;
  section: { id: string; title: string; note: string };
  emptyText: string;
  items: readonly T[];
  itemKey: (item: T) => string;
  itemTitle: (item: T) => string;
  renderRow: (item: T, controls: SavedItemRowControls) => React.ReactNode;
  footer: React.ReactNode;
  onRename: (key: string, title: string) => void;
  onDelete: (key: string) => void;
  onClose: () => void;
  renameRule?: (draft: string) => string | undefined;
  sendOnlyEdits?: boolean;
  returnFocus?: boolean;
}

type FocusTarget = { kind: 'rename' | 'delete' | 'keep'; key: string } | { kind: 'search' };

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export function SavedItemBrowserModal<T>({
  open,
  titleId,
  closeLabel,
  className,
  eyebrow,
  title,
  description,
  search,
  groupLabel,
  groupings,
  status,
  leading,
  section,
  emptyText,
  items,
  itemKey,
  itemTitle,
  renderRow,
  footer,
  onRename,
  onDelete,
  onClose,
  renameRule,
  sendOnlyEdits = false,
  returnFocus = false
}: SavedItemBrowserModalProps<T>): React.ReactElement {
  const [groupBy, setGroupBy] = React.useState(groupings[0]?.key ?? '');
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [renameDraft, setRenameDraft] = React.useState('');
  const [renameError, setRenameError] = React.useState<string | undefined>(undefined);
  const [renameDirty, setRenameDirty] = React.useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
  const cancelingRenameRef = React.useRef(false);
  const searchRef = React.useRef<HTMLInputElement>(null);
  const buttons = React.useRef(new Map<string, HTMLButtonElement>());
  const pendingFocus = React.useRef<FocusTarget | null>(null);
  // A confirmed delete: focus moves on once its row has gone.
  const deleted = React.useRef<{ key: string; next: string | null } | null>(null);
  const firstGrouping = groupings[0]?.key ?? '';

  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    setGroupBy(firstGrouping);
    setEditingId(null);
    setRenameDraft('');
    setRenameError(undefined);
    setConfirmDeleteId(null);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [open, firstGrouping]);

  const grouping = groupings.find((entry) => entry.key === groupBy) ?? groupings[0];
  const groups = React.useMemo(() => grouping?.group(items) ?? [], [grouping, items]);
  const keys = React.useMemo(() => groups.flatMap((group) => group.items.map(itemKey)), [groups, itemKey]);
  const titleOf = React.useCallback((key: string) => {
    const item = items.find((entry) => itemKey(entry) === key);
    return item === undefined ? undefined : itemTitle(item);
  }, [itemKey, itemTitle, items]);

  const focusLater = React.useCallback((target: FocusTarget) => {
    if (returnFocus) {
      pendingFocus.current = target;
    }
  }, [returnFocus]);

  // Focus goes where it was sent once the row has rendered the button; a deleted row's moves on once the row has gone.
  React.useEffect(() => {
    if (!returnFocus) {
      return;
    }
    const gone = deleted.current;
    if (gone && !keys.includes(gone.key)) {
      deleted.current = null;
      pendingFocus.current = gone.next && keys.includes(gone.next) ? { kind: 'delete', key: gone.next } : { kind: 'search' };
    }
    const target = pendingFocus.current;
    const element = target?.kind === 'search' ? searchRef.current : target && buttons.current.get(`${target.kind}:${target.key}`);
    if (element) {
      pendingFocus.current = null;
      element.focus();
    }
  });

  // Until the writer types, an open field follows the title the host has now (`sendOnlyEdits`).
  React.useEffect(() => {
    if (sendOnlyEdits && editingId !== null && !renameDirty) {
      const current = titleOf(editingId);
      if (current !== undefined) {
        setRenameDraft(current);
      }
    }
  }, [editingId, renameDirty, sendOnlyEdits, titleOf]);

  // A row that is gone has nothing to rename or confirm.
  React.useEffect(() => {
    if (editingId !== null && titleOf(editingId) === undefined && sendOnlyEdits) {
      setEditingId(null);
    }
    if (confirmDeleteId !== null && titleOf(confirmDeleteId) === undefined && returnFocus) {
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, editingId, returnFocus, sendOnlyEdits, titleOf]);

  const beginRename = React.useCallback((item: T) => {
    cancelingRenameRef.current = false;
    deleted.current = null;
    setConfirmDeleteId(null);
    setEditingId(itemKey(item));
    setRenameDraft(itemTitle(item));
    setRenameError(undefined);
    setRenameDirty(false);
  }, [itemKey, itemTitle]);

  const cancelRename = React.useCallback(() => {
    cancelingRenameRef.current = true;
    if (editingId !== null) {
      focusLater({ kind: 'rename', key: editingId });
    }
    setEditingId(null);
    setRenameDraft('');
    setRenameError(undefined);
  }, [editingId, focusLater]);

  const commitRename = React.useCallback((how: 'enter' | 'leave'): boolean => {
    if (cancelingRenameRef.current) {
      cancelingRenameRef.current = false;
      return true;
    }
    if (editingId) {
      if (sendOnlyEdits || renameRule) {
        const refusal = renameDirty ? renameRule?.(renameDraft) : undefined;
        if (refusal) {
          setRenameError(refusal);
          return false;
        }
        const next = renameDraft.trim();
        if (!sendOnlyEdits || (renameDirty && next !== titleOf(editingId))) {
          if (next) {
            onRename(editingId, next);
          }
        }
      } else {
        const next = renameDraft.trim();
        if (next) {
          onRename(editingId, next);
        }
      }
      if (how === 'enter') {
        focusLater({ kind: 'rename', key: editingId });
      }
    }
    setEditingId(null);
    setRenameError(undefined);
    return true;
  }, [editingId, focusLater, onRename, renameDirty, renameDraft, renameRule, sendOnlyEdits, titleOf]);

  const handleNestedEscape = React.useCallback((event: React.KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (editingId) {
      event.preventDefault();
      event.stopPropagation();
      cancelRename();
      return;
    }
    if (confirmDeleteId) {
      event.preventDefault();
      event.stopPropagation();
      focusLater({ kind: 'delete', key: confirmDeleteId });
      setConfirmDeleteId(null);
    }
  }, [cancelRename, confirmDeleteId, editingId, focusLater]);

  const controlsFor = (item: T): SavedItemRowControls => {
    const key = itemKey(item);
    const remember = (kind: 'rename' | 'delete' | 'keep') => (element: HTMLButtonElement | null) => {
      if (element) {
        buttons.current.set(`${kind}:${key}`, element);
      } else {
        buttons.current.delete(`${kind}:${key}`);
      }
    };
    return {
      editing: editingId === key,
      renameDraft,
      ...(editingId === key && renameError ? { renameError } : {}),
      confirmingDelete: confirmDeleteId === key,
      beginRename: () => beginRename(item),
      changeRenameDraft: (value: string) => {
        setRenameDraft(value);
        setRenameDirty(true);
        setRenameError(undefined);
      },
      commitRename,
      cancelRename,
      beginDelete: () => {
        setEditingId(null);
        deleted.current = null;
        focusLater({ kind: 'keep', key });
        setConfirmDeleteId(key);
      },
      acceptDelete: () => {
        setConfirmDeleteId(null);
        if (returnFocus) {
          deleted.current = { key, next: keys[keys.indexOf(key) + 1] ?? null };
          focusLater({ kind: 'delete', key });
        }
        onDelete(key);
      },
      cancelDelete: () => {
        focusLater({ kind: 'delete', key });
        setConfirmDeleteId(null);
      },
      renameButton: remember('rename'),
      deleteButton: remember('delete'),
      keepButton: remember('keep')
    };
  };

  return (
    <WorkshopModalShell
      open={open}
      titleId={titleId}
      closeLabel={closeLabel}
      className={className}
      onClose={onClose}
    >
      <div className="pm-ws-session-browser-layout" onKeyDown={handleNestedEscape}>
        <div className="pm-ws-session-sheet-head pm-ws-session-browser-head">
          <div>
            <div className="pm-ws-eyebrow">{eyebrow}</div>
            <h2 id={titleId}>{title}</h2>
            <p>{description}</p>
          </div>
          <WorkshopModalShell.CloseButton />
        </div>

        <div className="pm-ws-session-browser-toolbar">
          <label className="pm-ws-sessions-search">
            <Icon name="search" size={16} />
            <span className="sr-only">{search.label}</span>
            <input
              ref={searchRef}
              type="search"
              aria-label={search.label}
              value={search.query}
              disabled={search.disabled}
              placeholder={search.placeholder}
              onChange={(event) => search.onChange(event.target.value)}
            />
            {search.scope && <span className="pm-ws-session-search-scope">{search.scope}</span>}
          </label>
          <div className="pm-ws-sessions-group-control" aria-label={groupLabel}>
            <span>Group by</span>
            <div>
              {groupings.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className={groupBy === entry.key ? 'pm-ws-session-group-active' : ''}
                  onClick={() => setGroupBy(entry.key)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="pm-ws-session-browser-status">
          {status}
        </div>

        <div className="pm-ws-session-browser-scroll">
          {leading}

          <section className="pm-ws-session-browser-section" aria-labelledby={section.id}>
            <div className="pm-ws-sessions-section-title" id={section.id}>
              {/* One text node, as the Workshop's literal heading was: two would shape the space apart (a sub-pixel shift). */}
              {`${section.title} `}<span>{section.note}</span>
            </div>
            {items.length > 0 ? groups.map((group) => (
              <div className="pm-ws-session-browser-group" key={group.key}>
                <div className="pm-ws-sessions-group-label">
                  {group.label} <span>{group.items.length}</span>
                </div>
                {group.items.map((item) => (
                  <React.Fragment key={itemKey(item)}>{renderRow(item, controlsFor(item))}</React.Fragment>
                ))}
              </div>
            )) : (
              <div className="pm-ws-sessions-empty">{emptyText}</div>
            )}
          </section>
        </div>

        <footer className="pm-ws-session-sheet-foot pm-ws-session-browser-foot">
          {footer}
        </footer>
      </div>
    </WorkshopModalShell>
  );
}
