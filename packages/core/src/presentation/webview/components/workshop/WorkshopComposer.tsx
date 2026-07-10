/**
 * WorkshopComposer — the free-text follow-up bar (ADR 2026-07-03, Sprint 3).
 *
 * Sends WORKSHOP_SEND_MESSAGE through the callback; the host decides whether
 * that starts/continues the selected persona or an explicit direct-tool
 * target. A pinned excerpt enables the first host message before any tool has
 * run. While a run streams, the send button becomes a stop affordance wired
 * to CANCEL_WORKSHOP_REQUEST.
 *
 * The draft is deliberately LOCAL state: it's unsent user input, not session
 * truth, so it doesn't belong in WorkshopSessionService (and losing it on a
 * webview reload is acceptable alpha behavior).
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';

interface WorkshopComposerProps {
  /** A valid excerpt is pinned and no run is in flight — sending is possible. */
  canFollowUp: boolean;
  /** The selected host already has a retained conversation (drives copy). */
  hasConversation: boolean;
  /** Deterministic host label for visible, accessible composer language. */
  personaLabel: string;
  /** A run is streaming — show stop instead of send. */
  isRunning: boolean;
  /** First host snapshot has arrived. */
  sessionReady: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenTools: () => void;
}

export const WorkshopComposer: React.FC<WorkshopComposerProps> = ({
  canFollowUp,
  hasConversation,
  personaLabel,
  isRunning,
  sessionReady,
  onSend,
  onCancel,
  onOpenTools
}) => {
  const [draft, setDraft] = React.useState('');

  const trimmed = draft.trim();
  const canSend = canFollowUp && trimmed.length > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    onSend(trimmed);
    setDraft('');
  };

  const placeholder = hasConversation
    ? `Continue with ${personaLabel}…`
    : `Message ${personaLabel} about this excerpt…`;

  return (
    <div className="pm-ws-composer-wrap">
      <form className="pm-ws-composer" onSubmit={submit}>
        <button
          className="pm-ws-comp-add"
          type="button"
          disabled={!sessionReady}
          title="Writing tools"
          onClick={onOpenTools}
        >
          <Icon name="plus" size={18} />
        </button>
        <input
          className="pm-ws-comp-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!sessionReady}
          placeholder={placeholder}
          aria-label={`Message ${personaLabel}`}
        />
        <div className="pm-ws-comp-right">
          <button
            className="pm-ws-comp-pill"
            type="button"
            disabled={!sessionReady}
            onClick={onOpenTools}
          >
            <Icon name="grid" size={13} /> Tools
          </button>
          {isRunning ? (
            <button
              className="pm-ws-comp-send pm-ws-comp-stop"
              type="button"
              onClick={onCancel}
              title="Stop the current response"
              aria-label="Stop the current response"
            >
              <Icon name="stop" size={16} />
            </button>
          ) : (
            <button
              className="pm-ws-comp-send"
              type="submit"
              disabled={!canSend}
              title={
                hasConversation
                  ? `Continue with ${personaLabel}`
                  : `Message ${personaLabel}`
              }
              aria-label={`Send message to ${personaLabel}`}
            >
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
