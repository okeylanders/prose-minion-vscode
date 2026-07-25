/**
 * WorkshopScopeStrip — the center scope banner (Sprint 13A §10; design source:
 * "Prose Minion - Assistant Tab.html", `.wk-scopestrip`).
 *
 * The room says out loud what it is. In open chat that includes the part the
 * writer most needs to know and a persona can least be trusted to volunteer:
 * "<Host> hasn't read any pages." When an excerpt arrives the same strip flips
 * to the passage treatment and names the version, so the transition is legible
 * without scrolling the transcript.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';

interface WorkshopScopeStripProps {
  hostLabel: string;
  /** The pinned passage's display title, when one is pinned. */
  excerptTitle?: string;
  excerptVersion?: number;
  /**
   * True while a shelved passage still has to be withdrawn from the retained
   * host. Until that lands, "hasn't read any pages" would be false — the host
   * read them and has not yet been told to stop.
   */
  withdrawalPending?: boolean;
  /** Blocked while a run or session operation holds the room. */
  disabled: boolean;
  onAddExcerpt: () => void;
  onSetAside: () => void;
}

export const WorkshopScopeStrip: React.FC<WorkshopScopeStripProps> = ({
  hostLabel,
  excerptTitle,
  excerptVersion,
  withdrawalPending = false,
  disabled,
  onAddExcerpt,
  onSetAside
}) => {
  if (excerptTitle !== undefined && excerptVersion !== undefined) {
    return (
      <div className="pm-ws-scope-strip pm-ws-scope-strip-passage" role="status">
        <span className="pm-ws-scope-dot" aria-hidden="true" />
        <span className="pm-ws-scope-text">
          Passage session · {excerptTitle} v{excerptVersion}
        </span>
        <span className="pm-ws-scope-note">Analysis tools available</span>
        <button
          className="pm-ws-scope-btn"
          type="button"
          disabled={disabled}
          onClick={onSetAside}
          title="Set the passage aside and keep this conversation"
        >
          <Icon name="dialogue" size={13} /> Unpin excerpt
        </button>
      </div>
    );
  }

  return (
    <div className="pm-ws-scope-strip" role="status">
      <span className="pm-ws-scope-dot" aria-hidden="true" />
      <span className="pm-ws-scope-text">Open conversation · No excerpt yet</span>
      <span className="pm-ws-scope-note">
        {withdrawalPending
          ? `${hostLabel} still has the passage you set aside until your next message`
          : `${hostLabel} hasn’t read any pages`}
      </span>
      <button
        className="pm-ws-scope-btn"
        type="button"
        disabled={disabled}
        onClick={onAddExcerpt}
        title="Add an excerpt to this session"
      >
        <Icon name="plus" size={13} /> Add excerpt
      </button>
    </div>
  );
};
