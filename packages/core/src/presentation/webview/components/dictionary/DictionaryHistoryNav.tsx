/**
 * Dictionary history header controls (ADR 2026-10-14, D6).
 *
 * `DictionaryHistoryNav` is the `‹` `🕘 3 / 12` `›` cluster beside the tab
 * title; `DictionaryHistoryMeta` is the "From history" line under it. Both are
 * presentational: `useDictionaryHistory` owns the state and the transport.
 */

import * as React from 'react';
import { DictionaryHistorySummary } from '@messages';
import { Icon } from '@components/shared/Icon';
import { UseDictionaryHistoryReturn } from '@hooks/domain/useDictionaryHistory';

export type DictionaryHistoryNavModel = Pick<
  UseDictionaryHistoryReturn,
  'canGoOlder' | 'canGoNewer' | 'goOlder' | 'goNewer' | 'position' | 'olderSummary' | 'newerSummary' | 'draft'
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
      {total > 0 && (
        <span
          className="pm-dictionary-history-position"
          title={index === null
            ? `Viewing your current lookup · ${total} in history`
            : `Viewing lookup ${index} of ${total}, newest first`}
        >
          <Icon name="history" size={13} />
          <span>{index ?? '—'} / {total}</span>
        </span>
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
    </div>
  );
};

// Local until the history popup lands its shared formatter.
const formatHistoryMetaTime = (createdAt: string): string => {
  const date = new Date(createdAt);
  return Number.isNaN(date.getTime())
    ? createdAt
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
};

interface DictionaryHistoryMetaProps {
  summary: DictionaryHistorySummary | null;
}

/** `From history · <date> · Standard|⚡ Fast · <model>`; the model is omitted when unknown. */
export const DictionaryHistoryMeta: React.FC<DictionaryHistoryMetaProps> = ({ summary }) => {
  if (!summary) {
    return null;
  }
  const parts = [
    'From history',
    formatHistoryMetaTime(summary.createdAt),
    summary.mode === 'fast' ? '⚡ Fast' : 'Standard',
    ...(summary.modelId ? [summary.modelId] : [])
  ];
  return <p className="pm-dictionary-history-meta">{parts.join(' · ')}</p>;
};
