/**
 * DictionaryHistoryModal — the Dictionary's lookup history popup
 * (ADR 2026-10-14, D5–D7; epic slice 3).
 *
 * Presentational only. The host owns the history and the caller owns the
 * transport, so this component takes summaries, a cursor, and callbacks, and
 * never reaches for `useVSCodeApi`, `MessageType`, or `postMessage`.
 *
 * Escape handling and focus capture/return come from `useOverlayDismiss`, the
 * same contract the Workshop modals use. The dialog body mounts only while the
 * popup is open, so the Clear confirmation and the search reset on close by
 * construction rather than by an effect remembering to do it.
 *
 * Search (the ADR's 2026-11-14 amendment). The field at the top filters the
 * rows as the writer types, by word, context and file name, over the
 * summaries the popup already holds (`searchDictionaryHistory`); "Also
 * search definitions" asks the host through the callbacks, and only an
 * answer for the query on screen is shown. The query lives here and nowhere
 * else. Keys: the field is focused on open; ↓ moves into the rows and ↑ ↓
 * walk them (↑ from the first returns to the field); Enter in the field
 * opens the first match; Escape clears the query, then closes.
 */
import * as React from 'react';
import {
  DictionaryHistoryDurability,
  DictionaryHistorySearchSnippet,
  DictionaryHistorySessionReason,
  DictionaryHistorySummary
} from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  DICTIONARY_HISTORY_DELETE_CLASS,
  DICTIONARY_HISTORY_SELECT_CLASS,
  DictionaryHistoryRow
} from '@components/dictionary/DictionaryHistoryRow';
import { DictionaryHistorySearchBar } from '@components/dictionary/DictionaryHistorySearchBar';
import type { DictionaryHistoryDefinitionSearch } from '@hooks/domain/useDictionaryHistorySearch';
import { useOverlayDismiss } from '@hooks/useOverlayDismiss';
import {
  describeDictionaryHistoryMatches,
  dictionaryHistorySearchQuery,
  searchDictionaryHistory
} from '@utils/dictionaryHistorySearch';
import { formatDictionaryHistoryTime } from '@utils/formatDictionaryHistoryTime';

export interface DictionaryHistoryModalProps {
  open: boolean;
  /** Newest first, as the host sends them. */
  entries: DictionaryHistorySummary[];
  /** The entry the result pane shows; `null` when it shows a live lookup. */
  cursorId: string | null;
  durability: DictionaryHistoryDurability;
  /** The store's cap, shown as "12 of 500". */
  limit: number;
  /** A lookup is generating, so restoring an entry must wait. */
  selectionDisabled: boolean;
  /** What the host has said about the definitions of one query. */
  definitionSearch: DictionaryHistoryDefinitionSearch;
  /** Ask the host which definitions hold this (folded, bounded) query. */
  onSearchDefinitions: (query: string) => void;
  /** Stop waiting for the host and forget its answer. */
  onCancelDefinitionSearch: () => void;
  /** Test seam for timestamps. */
  now?: () => Date;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

type DictionaryHistoryDialogProps = Omit<DictionaryHistoryModalProps, 'open'>;

const ROW_SELECTOR = '.pm-dictionary-history-row';

/** The row's button of the kind focus was on, or its other one when that is disabled. */
const rowButton = (row: Element, preferDelete: boolean): HTMLButtonElement | null => {
  const select = row.querySelector<HTMLButtonElement>(`.${DICTIONARY_HISTORY_SELECT_CLASS}`);
  const remove = row.querySelector<HTMLButtonElement>(`.${DICTIONARY_HISTORY_DELETE_CLASS}`);
  const [first, second] = preferDelete ? [remove, select] : [select, remove];
  return first && !first.disabled ? first : second;
};

const systemNow = (): Date => new Date();

const sessionDurabilityMessage = (reason: DictionaryHistorySessionReason): string => {
  switch (reason) {
    case 'no-workspace':
      return 'Not saved: open a folder to keep history across sessions';
    case 'multi-root':
      return 'Not saved: history is kept for single-folder workspaces';
    case 'write-failed':
      return "Couldn't save history; it will last until VS Code restarts";
    default: {
      const unreachable: never = reason;
      return unreachable;
    }
  }
};

const renderDurabilityNote = (durability: DictionaryHistoryDurability): React.ReactElement => {
  if (durability.kind === 'project') {
    return (
      <p className="pm-dictionary-history-durability">
        <Icon name="doc" size={13} />
        <span>
          Saved in <code>{durability.displayPath}</code>
        </span>
      </p>
    );
  }
  const warning = durability.reason === 'write-failed';
  return (
    <p className={`pm-dictionary-history-durability${warning ? ' is-warning' : ''}`}>
      <Icon name={warning ? 'alert' : 'info'} size={13} />
      <span>{sessionDurabilityMessage(durability.reason)}</span>
    </p>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const DictionaryHistoryDialog: React.FC<DictionaryHistoryDialogProps> = ({
  entries,
  cursorId,
  durability,
  limit,
  selectionDisabled,
  definitionSearch,
  onSearchDefinitions,
  onCancelDefinitionSearch,
  now = systemNow,
  onSelect,
  onDelete,
  onClear,
  onClose
}) => {
  const [query, setQuery] = React.useState('');
  const [alsoDefinitions, setAlsoDefinitions] = React.useState(false);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Escape cancels the search before it closes the popup.
  const dismiss = React.useCallback(() => {
    if (query.length === 0) {
      onClose();
      return;
    }
    setQuery('');
    searchRef.current?.focus();
  }, [onClose, query]);
  const closeButtonRef = useOverlayDismiss({ open: true, onClose: dismiss });
  const baseId = React.useId();
  const titleId = `${baseId}-title`;
  const confirmTextId = `${baseId}-confirm`;

  const listRef = React.useRef<HTMLUListElement>(null);
  const clearButtonRef = React.useRef<HTMLButtonElement>(null);
  const cancelButtonRef = React.useRef<HTMLButtonElement>(null);

  const [confirmingClear, setConfirmingClear] = React.useState(false);
  /** Set by the writer's own clicks, so the first render never steals focus. */
  const moveFocusWithClearStepRef = React.useRef(false);
  /** The row whose Delete was pressed, until the host's new list drops it. */
  const pendingDeleteRef = React.useRef<{ id: string; index: number } | null>(null);

  const hasEntries = entries.length > 0;
  const nowDate = now();

  const searchedQuery = React.useMemo(() => dictionaryHistorySearchQuery(query), [query]);
  const definitionsWanted = alsoDefinitions && searchedQuery.length > 0;
  // Only an answer to the query on screen counts; anything else is not shown.
  const definitionsAnswer = definitionsWanted && definitionSearch.query === searchedQuery ? definitionSearch : null;
  const definitions = React.useMemo(() => (
    definitionsAnswer?.status === 'found'
      ? new Map<string, DictionaryHistorySearchSnippet>(definitionsAnswer.matches.map(match => [match.id, match.snippet]))
      : null
  ), [definitionsAnswer]);
  const view = React.useMemo(
    () => searchDictionaryHistory(entries, query, definitions),
    [entries, query, definitions]
  );
  const definitionsLine = definitionsAnswer?.status === 'searching'
    ? 'Searching definitions…'
    : definitionsAnswer?.status === 'failed'
      ? "Couldn't search definitions"
      : '';

  /** The definitions search follows the field and the toggle; the hook debounces it. */
  const syncDefinitionSearch = React.useCallback(() => {
    if (definitionsWanted) {
      onSearchDefinitions(searchedQuery);
    } else {
      onCancelDefinitionSearch();
    }
  }, [definitionsWanted, onCancelDefinitionSearch, onSearchDefinitions, searchedQuery]);
  React.useEffect(() => {
    syncDefinitionSearch();
  }, [syncDefinitionSearch]);

  // Closing the popup ends its search: nothing is waited for, nothing kept.
  React.useEffect(() => onCancelDefinitionSearch, [onCancelDefinitionSearch]);

  // The overlay focuses its close button on open; the field is where the writer types.
  const focusSearchOnOpen = React.useCallback(() => {
    searchRef.current?.focus();
  }, []);
  React.useEffect(() => {
    focusSearchOnOpen();
  }, [focusSearchOnOpen]);

  React.useEffect(() => {
    if (!hasEntries) {
      setConfirmingClear(false);
    }
  }, [hasEntries]);

  // The confirmation replaces the button that opened it; keep focus with the
  // control that took its place.
  React.useEffect(() => {
    if (!moveFocusWithClearStepRef.current) {
      return;
    }
    moveFocusWithClearStepRef.current = false;
    (confirmingClear ? cancelButtonRef : clearButtonRef).current?.focus();
  }, [confirmingClear]);

  // A deleted row takes its focused Delete button with it, which would drop
  // focus to <body>, outside this modal. Hand it to the row that slid into
  // place, or to the close button when the list is empty.
  React.useEffect(() => {
    const pending = pendingDeleteRef.current;
    if (!pending || entries.some((entry) => entry.id === pending.id)) {
      return;
    }
    pendingDeleteRef.current = null;
    const active = document.activeElement;
    if (active && active !== document.body && document.contains(active)) {
      return;
    }
    const deleteButtons = listRef.current?.querySelectorAll<HTMLButtonElement>(`.${DICTIONARY_HISTORY_DELETE_CLASS}`);
    // No row left to take it: the field when a search emptied the list, else the close button.
    const next =
      deleteButtons && deleteButtons.length > 0
        ? deleteButtons[Math.min(pending.index, deleteButtons.length - 1)]
        : searchRef.current ?? closeButtonRef.current;
    next?.focus();
  }, [entries, closeButtonRef]);

  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const handleDelete = (id: string, index: number) => {
    pendingDeleteRef.current = { id, index };
    onDelete(id);
  };

  /** ↓ from the field moves into the rows; Enter opens the first match. */
  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      const first = listRef.current?.querySelector(ROW_SELECTOR);
      const button = first ? rowButton(first, false) : null;
      if (button) {
        event.preventDefault();
        button.focus();
      }
      return;
    }
    if (event.key === 'Enter' && view.active && view.rows.length > 0 && !selectionDisabled) {
      event.preventDefault();
      onSelect(view.rows[0].entry.id);
    }
  };

  /** ↑ ↓ walk the rows, keeping to the button focus was on; ↑ from the first row returns to the field. */
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const target = event.target as HTMLElement;
    const rowElements = Array.from(event.currentTarget.querySelectorAll(ROW_SELECTOR));
    const at = rowElements.findIndex(row => row.contains(target));
    if (at < 0) {
      return;
    }
    event.preventDefault();
    const to = at + (event.key === 'ArrowDown' ? 1 : -1);
    if (to < 0) {
      searchRef.current?.focus();
      return;
    }
    if (to < rowElements.length) {
      rowButton(rowElements[to], target.classList.contains(DICTIONARY_HISTORY_DELETE_CLASS))?.focus();
    }
  };

  const startClear = () => {
    moveFocusWithClearStepRef.current = true;
    setConfirmingClear(true);
  };

  const cancelClear = () => {
    moveFocusWithClearStepRef.current = true;
    setConfirmingClear(false);
  };

  const confirmClear = () => {
    setConfirmingClear(false);
    onClear();
    closeButtonRef.current?.focus();
  };

  const clearPrompt =
    entries.length === 1 ? 'Clear 1 lookup?' : `Clear all ${entries.length} lookups?`;

  return (
    <div
      className="tm-backdrop pm-dictionary-history-backdrop"
      role="presentation"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        className="tm pm-dictionary-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tm-head pm-dictionary-history-head">
          <div className="pm-dictionary-history-heading">
            <div className="pm-eyebrow">Dictionary</div>
            <div className="pm-dictionary-history-title-row">
              <h2 id={titleId} className="tm-title pm-dictionary-history-title">
                Lookup history
              </h2>
              <span className="pm-dictionary-history-count">{`${entries.length} of ${limit}`}</span>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="btn ghost tm-close"
            onClick={onClose}
            aria-label="Close lookup history"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="pm-dictionary-history-body">
          {!hasEntries ? (
            <p className="pm-dictionary-history-empty">
              No lookups yet. Each completed lookup is kept here.
            </p>
          ) : (
            <>
              {selectionDisabled && (
                <p className="pm-dictionary-history-note">
                  History opens after the current lookup finishes.
                </p>
              )}
              <DictionaryHistorySearchBar
                inputRef={searchRef}
                query={query}
                alsoDefinitions={alsoDefinitions}
                matchLine={view.active ? describeDictionaryHistoryMatches(view.rows.length, view.total) : ''}
                definitionsLine={definitionsLine}
                onQueryChange={setQuery}
                onAlsoDefinitionsChange={setAlsoDefinitions}
                onKeyDown={handleSearchKeyDown}
              />
              {view.rows.length === 0 ? (
                <p className="pm-dictionary-history-empty">No lookups match.</p>
              ) : (
                <ul
                  ref={listRef}
                  className="pm-dictionary-history-list"
                  aria-labelledby={titleId}
                  onKeyDown={handleListKeyDown}
                >
                  {view.rows.map((row, index) => (
                    <DictionaryHistoryRow
                      key={row.entry.id}
                      row={row}
                      rowId={`${baseId}-row-${index}`}
                      time={formatDictionaryHistoryTime(row.entry.createdAt, nowDate)}
                      isCurrent={row.entry.id === cursorId}
                      selectionDisabled={selectionDisabled}
                      onSelect={onSelect}
                      onDelete={(id) => handleDelete(id, index)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        <div className="pm-dictionary-history-foot">
          {renderDurabilityNote(durability)}
          {hasEntries &&
            (confirmingClear ? (
              <div className="pm-dictionary-history-confirm" role="group" aria-labelledby={confirmTextId}>
                <span id={confirmTextId} className="pm-dictionary-history-confirm-text">
                  {clearPrompt}
                </span>
                <span className="pm-dictionary-history-confirm-actions">
                  <button
                    ref={cancelButtonRef}
                    type="button"
                    className="btn btn-secondary pm-dictionary-history-foot-btn"
                    onClick={cancelClear}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-alert pm-dictionary-history-foot-btn"
                    onClick={confirmClear}
                  >
                    Clear
                  </button>
                </span>
              </div>
            ) : (
              <button
                ref={clearButtonRef}
                type="button"
                className="btn ghost pm-dictionary-history-clear pm-dictionary-history-foot-btn"
                onClick={startClear}
              >
                <Icon name="trash" size={13} />
                Clear history
              </button>
            ))}
        </div>
      </div>
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const DictionaryHistoryModal: React.FC<DictionaryHistoryModalProps> = ({ open, ...dialogProps }) =>
  open ? <DictionaryHistoryDialog {...dialogProps} /> : null;
