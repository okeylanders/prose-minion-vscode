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
 * popup is open, so the Clear confirmation resets on close by construction
 * rather than by an effect remembering to do it.
 */
import * as React from 'react';
import {
  DictionaryHistoryDurability,
  DictionaryHistorySessionReason,
  DictionaryHistorySummary
} from '@messages';
import { Icon } from '@components/shared/Icon';
import { useOverlayDismiss } from '@hooks/useOverlayDismiss';
import { formatDictionaryHistoryTime } from '@utils/formatDictionaryHistoryTime';

export interface DictionaryHistoryModalProps {
  open: boolean;
  /** Newest first, as the host sends them. */
  entries: DictionaryHistorySummary[];
  /** The entry the result pane shows; `null` when it shows a live lookup. */
  cursorId: string | null;
  durability: DictionaryHistoryDurability;
  /** The store's cap, shown as "12 of 50". */
  limit: number;
  /** A lookup is generating, so restoring an entry must wait. */
  selectionDisabled: boolean;
  /** Test seam for timestamps. */
  now?: () => Date;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  onClose: () => void;
}

type DictionaryHistoryDialogProps = Omit<DictionaryHistoryModalProps, 'open'>;

const DELETE_BUTTON_CLASS = 'pm-dictionary-history-delete';

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

/**
 * The badges for one row. Spaces separate them so a screen reader's
 * description does not run "StandardEncyclopedia" together; flex layout
 * ignores the whitespace, so nothing shifts visually.
 */
const renderEntryBadges = (entry: DictionaryHistorySummary): React.ReactElement => {
  const badges: React.ReactNode[] = [
    entry.mode === 'fast' ? (
      <span key="mode" className="pm-dictionary-history-badge is-fast">
        <span aria-hidden="true">⚡</span> Fast
      </span>
    ) : (
      <span key="mode" className="pm-dictionary-history-badge">Standard</span>
    )
  ];
  if (entry.includeEncyclopedia) {
    badges.push(<span key="encyclopedia" className="pm-dictionary-history-badge">Encyclopedia</span>);
  }
  if (entry.includePalettes) {
    badges.push(<span key="palettes" className="pm-dictionary-history-badge">Palettes</span>);
  }
  if (entry.modelId) {
    badges.push(
      <span
        key="model"
        className="pm-dictionary-history-badge pm-dictionary-history-model"
        title={entry.modelId}
      >
        {entry.modelId}
      </span>
    );
  }
  return (
    <span className="pm-dictionary-history-badges">
      {badges.map((badge, index) => (
        <React.Fragment key={index}>
          {index > 0 && ' '}
          {badge}
        </React.Fragment>
      ))}
    </span>
  );
};

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
const DictionaryHistoryDialog: React.FC<DictionaryHistoryDialogProps> = ({
  entries,
  cursorId,
  durability,
  limit,
  selectionDisabled,
  now = systemNow,
  onSelect,
  onDelete,
  onClear,
  onClose
}) => {
  const closeButtonRef = useOverlayDismiss({ open: true, onClose });
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
    const deleteButtons = listRef.current?.querySelectorAll<HTMLButtonElement>(`.${DELETE_BUTTON_CLASS}`);
    const next =
      deleteButtons && deleteButtons.length > 0
        ? deleteButtons[Math.min(pending.index, deleteButtons.length - 1)]
        : closeButtonRef.current;
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
              <ul ref={listRef} className="pm-dictionary-history-list" aria-labelledby={titleId}>
                {entries.map((entry, index) => {
                  const isCurrent = entry.id === cursorId;
                  const time = formatDictionaryHistoryTime(entry.createdAt, nowDate);
                  const timeId = `${baseId}-time-${index}`;
                  const detailsId = `${baseId}-details-${index}`;
                  return (
                    <li
                      key={entry.id}
                      className={`pm-dictionary-history-row${isCurrent ? ' is-current' : ''}`}
                    >
                      <button
                        type="button"
                        className="pm-dictionary-history-select"
                        aria-label={`Open lookup: ${entry.word}`}
                        aria-describedby={time ? `${timeId} ${detailsId}` : detailsId}
                        aria-current={isCurrent ? 'true' : undefined}
                        disabled={selectionDisabled}
                        onClick={() => onSelect(entry.id)}
                      >
                        <span className="pm-dictionary-history-line">
                          <strong className="pm-dictionary-history-word">{entry.word}</strong>
                          {time && (
                            <time id={timeId} className="pm-dictionary-history-time" dateTime={entry.createdAt}>
                              {time}
                            </time>
                          )}
                        </span>
                        <span id={detailsId} className="pm-dictionary-history-details">
                          {renderEntryBadges(entry)}{' '}
                          {entry.contextPreview && (
                            <span className="pm-dictionary-history-context" title={entry.contextPreview}>
                              {entry.contextPreview}
                            </span>
                          )}{' '}
                          {entry.relativePath && (
                            <span className="pm-dictionary-history-source" title={entry.relativePath}>
                              Source: {entry.relativePath}
                            </span>
                          )}
                        </span>
                      </button>
                      <button
                        type="button"
                        className={DELETE_BUTTON_CLASS}
                        aria-label={`Delete lookup: ${entry.word}`}
                        title="Delete from history"
                        onClick={() => handleDelete(entry.id, index)}
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </li>
                  );
                })}
              </ul>
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
