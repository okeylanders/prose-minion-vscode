/**
 * Dictionary history header controls (ADR 2026-10-14, D6).
 *
 * `DictionaryHistoryNav` is the `‹` `🕘 3 / 12` `›` cluster beside the tab
 * title. The `🕘` position button opens the lookup history popup, and the
 * cluster owns that popup's open state so focus returns to its opener.
 * `DictionaryHistoryMeta` is the "From history" line under the title. Both are
 * presentational: `useDictionaryHistory` owns the state and the transport.
 */

import * as React from 'react';
import { DictionaryHistorySummary } from '@messages';
import { Icon } from '@components/shared/Icon';
import { DictionaryHistoryModal } from '@components/dictionary/DictionaryHistoryModal';
import { UseDictionaryHistoryReturn } from '@hooks/domain/useDictionaryHistory';
import { formatDictionaryHistoryTime } from '@utils/formatDictionaryHistoryTime';

export type DictionaryHistoryNavModel = Pick<
  UseDictionaryHistoryReturn,
  | 'canGoOlder'
  | 'canGoNewer'
  | 'goOlder'
  | 'goNewer'
  | 'position'
  | 'olderSummary'
  | 'newerSummary'
  | 'draft'
  | 'entries'
  | 'cursorId'
  | 'durability'
  | 'limit'
  | 'navigationLocked'
  | 'openEntry'
  | 'deleteEntry'
  | 'clearHistory'
>;

interface DictionaryHistoryNavProps {
  history: DictionaryHistoryNavModel;
}

const olderTitle = (history: DictionaryHistoryNavModel): string =>
  history.olderSummary ? `Previous lookup: ${history.olderSummary.word}` : 'Previous lookup';

const newerTitle = (history: DictionaryHistoryNavModel): string => {
  if (history.newerSummary) {
    return `Next lookup: ${history.newerSummary.word}`;
  }
  // `›` from the newest entry leads back to the stashed unsaved input.
  if (history.canGoNewer && history.draft) {
    const draftWord = history.draft.word.trim();
    return draftWord ? `Next lookup: ${draftWord} (unsaved)` : 'Next lookup: your unsaved input';
  }
  return 'Next lookup';
};

export const DictionaryHistoryNav: React.FC<DictionaryHistoryNavProps> = ({ history }) => {
  const { index, total } = history.position;
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const closeHistory = React.useCallback(() => setHistoryOpen(false), []);
  const { openEntry } = history;
  const selectEntry = React.useCallback((id: string) => {
    openEntry(id);
    setHistoryOpen(false);
  }, [openEntry]);

  return (
    <div className="pm-dictionary-history-nav">
      <button
        type="button"
        className="icon-button"
        onClick={history.goOlder}
        disabled={!history.canGoOlder}
        aria-label="Previous lookup"
        title={olderTitle(history)}
      >
        <Icon name="chevLeft" size={14} />
      </button>
      {/* Stays while the popup is open so clearing the last entry shows the
          empty state and focus can return here on close. */}
      {(total > 0 || historyOpen) && (
        <button
          type="button"
          className="pm-dictionary-history-position"
          onClick={() => setHistoryOpen(true)}
          aria-label="Lookup history"
          aria-haspopup="dialog"
          title={index === null
            ? `Viewing your current lookup · ${total} in history`
            : `Viewing lookup ${index} of ${total}, newest first`}
        >
          <Icon name="history" size={13} />
          <span>{index ?? '—'} / {total}</span>
        </button>
      )}
      <button
        type="button"
        className="icon-button"
        onClick={history.goNewer}
        disabled={!history.canGoNewer}
        aria-label="Next lookup"
        title={newerTitle(history)}
      >
        <Icon name="chevRight" size={14} />
      </button>
      {history.durability && (
        <DictionaryHistoryModal
          open={historyOpen}
          entries={history.entries}
          cursorId={history.cursorId}
          durability={history.durability}
          limit={history.limit}
          selectionDisabled={history.navigationLocked}
          onSelect={selectEntry}
          onDelete={history.deleteEntry}
          onClear={history.clearHistory}
          onClose={closeHistory}
        />
      )}
    </div>
  );
};

interface DictionaryHistoryMetaProps {
  summary: DictionaryHistorySummary | null;
}

/** `From history · <date> · Standard|⚡ Fast · <model>`; the model is omitted when unknown. */
export const DictionaryHistoryMeta: React.FC<DictionaryHistoryMetaProps> = ({ summary }) => {
  if (!summary) {
    return null;
  }
  const time = formatDictionaryHistoryTime(summary.createdAt, new Date());
  const parts = [
    'From history',
    ...(time ? [time] : []),
    summary.mode === 'fast' ? '⚡ Fast' : 'Standard',
    ...(summary.modelId ? [summary.modelId] : [])
  ];
  return <p className="pm-dictionary-history-meta">{parts.join(' · ')}</p>;
};
