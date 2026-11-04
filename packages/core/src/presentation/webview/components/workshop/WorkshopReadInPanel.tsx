/**
 * The Material tab's Read in block (ADR 2026-11-03 D2): what the chat target
 * fetched on its own, in delivery order, named for that participant.
 *
 * It records and never controls. There is no remove action: a participant
 * can't un-read a file. A row with an open action (`readInOpenAction`) is a
 * button that says what it opens; every other row is a plain list item.
 * Superseded rows stay, dashed and tagged.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import type { IconName } from '@components/shared/Icon';
import type { ContextSourceEntry, ContextSourceKind } from '@shared/types';
import { participantIdentityColorIndex } from '@utils/contextBudget';
import { formatReadInTime, readInOpenAction } from '@utils/workshop/contextSources';

export interface WorkshopReadInPanelProps {
  /** The chat target's read-in rows (`partitionContextSources(...).readIn`). */
  entries: readonly ContextSourceEntry[];
  /** The chat target's canonical identity, for its color. */
  participantIdentity: string;
  participantLabel: string;
  /** Opens a row whose action is `reader`. */
  onOpenReader: (entry: ContextSourceEntry) => void;
}

const KIND_ICONS: Record<ContextSourceKind, IconName> = {
  pin: 'pin',
  attachment: 'cards',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
  'message-attachment': 'cards',
  resource: 'doc',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
  'tool-evidence': 'clipboard',
  dictionary: 'book',
  transcript: 'history'
};

const KIND_LABELS: Record<ContextSourceKind, string> = {
  pin: 'pinned excerpt',
  attachment: 'standing context',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
  'message-attachment': 'message attachment',
  resource: 'resource',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- ContextSourceKind ids are kebab-case protocol literals.
  'tool-evidence': 'tool report',
  dictionary: 'dictionary entry',
  transcript: 'saved session'
};

const rowKey = (entry: ContextSourceEntry, index: number): string =>
  `${entry.kind}-${entry.label}-${entry.deliveredAt}-${index}`;

const RowBody: React.FC<{ entry: ContextSourceEntry; metaId?: string }> = ({ entry, metaId }) => (
  <>
    <span className={`pm-ws-readin-icon pm-ws-readin-icon-${entry.kind}`} aria-hidden="true">
      <Icon name={KIND_ICONS[entry.kind]} size={13} />
    </span>
    <span className="pm-ws-readin-text">
      <span
        className={`pm-ws-readin-label${entry.configuredResource ? ' pm-ws-readin-label-path' : ''}`}
        title={entry.configuredResource?.path ?? entry.label}
      >
        {entry.label}
      </span>
      <span className="pm-ws-readin-meta" id={metaId}>
        {KIND_LABELS[entry.kind]} · {formatReadInTime(entry.deliveredAt)}
        {entry.stale ? <span className="pm-ws-readin-stale-tag">superseded</span> : null}
      </span>
    </span>
  </>
);

export const WorkshopReadInPanel: React.FC<WorkshopReadInPanelProps> = ({
  entries,
  participantIdentity,
  participantLabel,
  onOpenReader
}) => {
  const idPrefix = React.useId();
  return (
  <section className="pm-ws-block pm-ws-readin" aria-label={`Read in by ${participantLabel}`}>
    <div className="pm-ws-block-head pm-ws-readin-head">
      <div className="pm-ws-eyebrow">
        <Icon name="eye" size={12} /> Read in
      </div>
      <span className="pm-ws-readin-by">
        <span
          className={`pm-context-budget-dot pm-context-budget-dot-${participantIdentityColorIndex(participantIdentity)}`}
          aria-hidden="true"
        />
        by {participantLabel}
      </span>
    </div>
    {entries.length === 0 ? (
      <p className="pm-ws-readin-empty">
        When {participantLabel} reads a file or runs a tool, it shows here.
      </p>
    ) : (
      <ul className="pm-ws-readin-list">
        {entries.map((entry, index) => {
          // `jump` has no producer until rows record their card (Slice 3).
          const action = readInOpenAction(entry);
          const rowClass = `pm-ws-readin-row${entry.stale ? ' pm-ws-readin-row-stale' : ''}`;
          // The button's label names the action; its kind and time stay
          // announced as its description.
          const metaId = `${idPrefix}-meta-${index}`;
          return (
            <li key={rowKey(entry, index)} className={action.kind === 'none' ? rowClass : undefined}>
              {action.kind === 'reader' ? (
                <button
                  type="button"
                  className={`${rowClass} pm-ws-readin-row-action`}
                  aria-label={`Open ${entry.label} in the reader${entry.stale ? ', an earlier read' : ''}`}
                  aria-describedby={metaId}
                  onClick={() => onOpenReader(entry)}
                >
                  <RowBody entry={entry} metaId={metaId} />
                  <span className="pm-ws-readin-trail" aria-hidden="true">
                    <Icon name="chevRight" size={13} />
                  </span>
                </button>
              ) : (
                <RowBody entry={entry} />
              )}
            </li>
          );
        })}
      </ul>
    )}
  </section>
  );
};
