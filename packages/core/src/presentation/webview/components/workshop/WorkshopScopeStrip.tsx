/**
 * WorkshopScopeStrip — the center scope banner (Sprint 13A §10; design source:
 * "Prose Minion - Assistant Tab.html", `.wk-scopestrip`).
 *
 * The room says out loud what it is. In open chat that includes the part the
 * writer most needs to know and a persona can least be trusted to volunteer:
 * "<Host> hasn't read any pages."
 *
 * Since ADR 2026-07-25 an open conversation stays open — it can gain an
 * excerpt only before anyone has been prompted — so this strip describes ONE
 * state and offers its path change only while the room has no memory.
 */

import * as React from 'react';
import { WorkshopSessionScope } from '@messages';
import { Icon } from '@components/shared/Icon';
import {
  WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE
} from '@shared/constants/workshopScope';

interface WorkshopScopeStripProps {
  /**
   * The session's declared scope (Sprint 13A §1). This strip states what the
   * session IS from `scope` alone — never from excerpt presence.
   */
  scope: WorkshopSessionScope;
  hostLabel: string;
  /**
   * The scope lock (ADR 2026-07-25). Once the room has a memory the path is
   * settled, so the strip becomes purely declarative.
   */
  roomHasMemory: boolean;
  /** The set-aside passage, when one is on the shelf. */
  shelvedExcerptTitle?: string;
  shelvedExcerptVersion?: number;
  /** Blocked while a run or session operation holds the room. */
  disabled: boolean;
  onAddExcerpt: () => void;
  /** Bring the set-aside passage back. Pre-lock only. */
  onRepinExcerpt: () => void;
}

export const WorkshopScopeStrip: React.FC<WorkshopScopeStripProps> = ({
  scope,
  hostLabel,
  roomHasMemory,
  shelvedExcerptTitle,
  shelvedExcerptVersion,
  disabled,
  onAddExcerpt,
  onRepinExcerpt
}) => {
  // The strip describes an OPEN conversation, and it is chosen by scope — never
  // by a missing excerpt. A passage session is not a state this strip can
  // honestly describe, so it renders nothing rather than announcing the wrong
  // session (Sprint 13A §1).
  if (scope !== 'open') {
    return null;
  }

  const hasShelf = shelvedExcerptTitle !== undefined && shelvedExcerptVersion !== undefined;

  return (
    <div className="pm-ws-scope-strip" role="status">
      <span className="pm-ws-scope-dot" aria-hidden="true" />
      <span className="pm-ws-scope-text">Open conversation · No excerpt yet</span>
      <span className="pm-ws-scope-note">
        {roomHasMemory
          ? `${hostLabel} hasn’t read any pages. ${WORKSHOP_SCOPE_LOCK_RECOVERY_MESSAGE}`
          : `${hostLabel} hasn’t read any pages`}
      </span>
      {/* Both affordances are pre-lock only. Once the host has been answering
          without a passage, handing it one would make everything already said
          ambiguous — so the strip stops offering and names the way out
          instead (ADR 2026-07-25). */}
      {roomHasMemory ? null : (
        <>
          {hasShelf ? (
            <button
              className="pm-ws-scope-btn"
              type="button"
              disabled={disabled}
              onClick={onRepinExcerpt}
              title="Bring the passage you set aside back into this session"
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
        </>
      )}
    </div>
  );
};
