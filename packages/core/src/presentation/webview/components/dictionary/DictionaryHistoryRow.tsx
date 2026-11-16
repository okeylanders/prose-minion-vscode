/**
 * DictionaryHistoryRow — one lookup in the history popup: the button that
 * opens it (word, time, badges, context, source) and its Delete.
 *
 * Presentational. While a search is active the row marks where the query
 * stands in its word, context and source, and a row found only in its
 * definition shows the host's snippet with the hit marked. All of it is
 * rendered as text (`MarkedText`), never as markup.
 */
import * as React from 'react';
import { DictionaryHistorySummary } from '@messages';
import { Icon } from '@components/shared/Icon';
import { MarkedText } from '@components/shared/MarkedText';
import type { DictionaryHistorySearchRow } from '@utils/dictionaryHistorySearch';

export const DICTIONARY_HISTORY_SELECT_CLASS = 'pm-dictionary-history-select';
export const DICTIONARY_HISTORY_DELETE_CLASS = 'pm-dictionary-history-delete';

const MARK_CLASS = 'pm-dictionary-history-mark';

export interface DictionaryHistoryRowProps {
  row: DictionaryHistorySearchRow;
  /** Unique within the popup; the row's described-by ids are built on it. */
  rowId: string;
  /** The formatted time, or `''` when the entry's date cannot be read. */
  time: string;
  isCurrent: boolean;
  selectionDisabled: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

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
  if (entry.modelIds.length > 0) {
    // More than one only when a fast lookup's blocks straddled a model swap.
    const models = entry.modelIds.join(' + ');
    badges.push(
      <span
        key="model"
        className="pm-dictionary-history-badge pm-dictionary-history-model"
        title={models}
      >
        {models}
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
export const DictionaryHistoryRow: React.FC<DictionaryHistoryRowProps> = ({
  row,
  rowId,
  time,
  isCurrent,
  selectionDisabled,
  onSelect,
  onDelete
}) => {
  const { entry, snippet } = row;
  const timeId = `${rowId}-time`;
  const detailsId = `${rowId}-details`;
  return (
    <li className={`pm-dictionary-history-row${isCurrent ? ' is-current' : ''}`}>
      <button
        type="button"
        className={DICTIONARY_HISTORY_SELECT_CLASS}
        aria-label={`Open lookup: ${entry.word}`}
        aria-describedby={time ? `${timeId} ${detailsId}` : detailsId}
        aria-current={isCurrent ? 'true' : undefined}
        disabled={selectionDisabled}
        onClick={() => onSelect(entry.id)}
      >
        <span className="pm-dictionary-history-line">
          <strong className="pm-dictionary-history-word">
            <MarkedText text={entry.word} ranges={row.word} markClassName={MARK_CLASS} />
          </strong>
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
              <MarkedText text={entry.contextPreview} ranges={row.context} markClassName={MARK_CLASS} />
            </span>
          )}{' '}
          {entry.relativePath && (
            <span className="pm-dictionary-history-source" title={entry.relativePath}>
              Source: <MarkedText text={entry.relativePath} ranges={row.file} markClassName={MARK_CLASS} />
            </span>
          )}
          {snippet && (
            <>
              {' '}
              <span className="pm-dictionary-history-snippet">
                <span className="pm-dictionary-history-snippet-label">In the definition:</span>{' '}
                {snippet.before}
                <mark className={MARK_CLASS}>{snippet.hit}</mark>
                {snippet.after}
              </span>
            </>
          )}
        </span>
      </button>
      <button
        type="button"
        className={DICTIONARY_HISTORY_DELETE_CLASS}
        aria-label={`Delete lookup: ${entry.word}`}
        title="Delete from history"
        onClick={() => onDelete(entry.id)}
      >
        <Icon name="trash" size={14} />
      </button>
    </li>
  );
};
