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
import { WorkshopSessionScope } from '@messages';
import { Icon } from '@components/shared/Icon';

interface WorkshopScopeStripProps {
  /**
   * The session's declared scope (Sprint 13A §1). This strip states what the
   * session IS from `scope` alone — `excerptTitle` says only what is currently
   * pinned, and a missing excerpt never means "open conversation" here any
   * more than it does anywhere else in the room.
   */
  scope: WorkshopSessionScope;
  hostLabel: string;
  /** The pinned passage's display title, when one is pinned. */
  excerptTitle?: string;
  excerptVersion?: number;
  /** The set-aside passage, when one is on the shelf. */
  shelvedExcerptTitle?: string;
  shelvedExcerptVersion?: number;
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
  /** Bring the set-aside passage back without leaving the open conversation. */
  onRepinExcerpt: () => void;
}

export const WorkshopScopeStrip: React.FC<WorkshopScopeStripProps> = ({
  scope,
  hostLabel,
  excerptTitle,
  excerptVersion,
  shelvedExcerptTitle,
  shelvedExcerptVersion,
  withdrawalPending = false,
  disabled,
  onAddExcerpt,
  onSetAside,
  onRepinExcerpt
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

  // The empty branch describes an OPEN conversation, and it is chosen by scope
  // — never by a missing excerpt. A passage session with nothing pinned is not
  // a state this strip can honestly describe, so it renders nothing rather
  // than announcing the wrong session (Sprint 13A §1).
  if (scope !== 'open') {
    return null;
  }

  const hasShelf = shelvedExcerptTitle !== undefined && shelvedExcerptVersion !== undefined;

  return (
    <div className="pm-ws-scope-strip" role="status">
      <span className="pm-ws-scope-dot" aria-hidden="true" />
      <span className="pm-ws-scope-text">Open conversation · No excerpt yet</span>
      <span className="pm-ws-scope-note">
        {withdrawalPending
          ? `${hostLabel} still has the passage you set aside until your next message`
          : `${hostLabel} hasn’t read any pages`}
      </span>
      {/* With a passage on the shelf, re-pinning is the non-destructive route
          back and it belongs beside the button that would replace it. Without
          this, "Add excerpt" was the only affordance here and it discards the
          set-aside passage (§4: the strip gets the re-pin the rail already
          had). */}
      {hasShelf ? (
        <button
          className="pm-ws-scope-btn"
          type="button"
          disabled={disabled}
          onClick={onRepinExcerpt}
          title="Bring the passage you set aside back into this conversation"
        >
          <Icon name="pin" size={13} /> Re-pin {shelvedExcerptTitle} v{shelvedExcerptVersion}
        </button>
      ) : null}
      <button
        className="pm-ws-scope-btn"
        type="button"
        disabled={disabled}
        onClick={onAddExcerpt}
        title={
          hasShelf
            ? `Pin a different excerpt — replaces the set-aside ${shelvedExcerptTitle}`
            : 'Add an excerpt to this session'
        }
      >
        <Icon name="plus" size={13} /> Add excerpt
      </button>
    </div>
  );
};
