/**
 * DictionaryPriorLookupPrompt — "looked up before" offer under the Run
 * buttons (ADR 2026-10-14, D9).
 *
 * Presentational only: `useDictionaryPriorLookup` owns the offer, and the
 * caller owns history and submission. The prompt takes focus when it appears,
 * because it replaces the lookup the writer just asked for and must not go
 * unnoticed; Escape dismisses it.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { DictionaryPriorLookupOffer } from '@hooks/domain/dictionary/controllers/useDictionaryPriorLookup';
import { formatDictionaryHistoryTime } from '@utils/formatDictionaryHistoryTime';

interface DictionaryPriorLookupPromptProps {
  offer: DictionaryPriorLookupOffer;
  /** A lookup is generating, so neither action can run yet. */
  disabled: boolean;
  /** Test seam for timestamps. */
  now?: () => Date;
  onOpen: () => void;
  onLookUpAgain: () => void;
  onDismiss: () => void;
}

const systemNow = (): Date => new Date();

const TITLE_ID = 'pm-dictionary-prior-title';

export const DictionaryPriorLookupPrompt: React.FC<DictionaryPriorLookupPromptProps> = ({
  offer,
  disabled,
  now = systemNow,
  onOpen,
  onLookUpAgain,
  onDismiss
}) => {
  const openButton = React.useRef<HTMLButtonElement>(null);
  const [latest] = offer.matches;
  const count = offer.matches.length;
  const time = formatDictionaryHistoryTime(latest.createdAt, now());

  const focusOpenButton = React.useCallback(() => {
    openButton.current?.focus();
  }, []);

  // Refocus when the offer moves to another entry, not on every render.
  React.useEffect(() => {
    focusOpenButton();
  }, [focusOpenButton, latest.id]);

  const dismissOnEscape = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onDismiss();
    }
  };

  const details = [
    ...(time ? [time] : []),
    latest.mode === 'fast' ? '⚡ Fast' : 'Standard',
    ...(count > 1 ? [`${count} lookups in history`] : [])
  ];

  return (
    <div
      className="pm-dictionary-prior"
      role="region"
      aria-labelledby={TITLE_ID}
      onKeyDown={dismissOnEscape}
    >
      <div className="pm-dictionary-prior-heading">
        <Icon name="history" size={14} />
        <p id={TITLE_ID} className="pm-dictionary-prior-title">
          You've looked up <strong>{latest.word}</strong> before
        </p>
        <button
          type="button"
          className="icon-button"
          onClick={onDismiss}
          aria-label="Dismiss"
          title="Dismiss"
        >
          <Icon name="x" size={13} />
        </button>
      </div>
      <p className="pm-dictionary-prior-details">{details.join(' · ')}</p>
      {latest.contextPreview && (
        <p className="pm-dictionary-prior-context">{latest.contextPreview}</p>
      )}
      <div className="pm-dictionary-prior-actions">
        <button
          ref={openButton}
          type="button"
          className="btn btn-primary"
          onClick={onOpen}
          disabled={disabled}
        >
          {count > 1 ? 'Open latest entry' : 'Open existing entry'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onLookUpAgain}
          disabled={disabled}
        >
          Look up again
        </button>
      </div>
    </div>
  );
};
