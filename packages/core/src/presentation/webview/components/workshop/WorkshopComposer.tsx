/**
 * WorkshopComposer — the free-text follow-up bar (ADR 2026-07-03, Sprint 3).
 *
 * Sends WORKSHOP_SEND_MESSAGE through the callback (the host continues the
 * session's retained conversation); while a run streams, the send button
 * becomes a stop affordance wired to CANCEL_WORKSHOP_REQUEST. The composer
 * enables only when a conversation exists — the first tool run opens it —
 * and the placeholder says so instead of leaving a mystery-disabled input.
 *
 * The draft is deliberately LOCAL state: it's unsent user input, not session
 * truth, so it doesn't belong in WorkshopSessionService (and losing it on a
 * webview reload is acceptable alpha behavior). The plus button and Tools
 * pill remain Sprint 4 placeholders.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';

interface WorkshopComposerProps {
  /** A conversation exists and no run is in flight — sending is possible. */
  canFollowUp: boolean;
  /** A conversation exists (drives placeholder copy). */
  hasConversation: boolean;
  /** A run is streaming — show stop instead of send. */
  isRunning: boolean;
  /** First host snapshot has arrived. */
  sessionReady: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}

export const WorkshopComposer: React.FC<WorkshopComposerProps> = ({
  canFollowUp,
  hasConversation,
  isRunning,
  sessionReady,
  onSend,
  onCancel
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
    ? 'Ask a follow-up — it continues this conversation…'
    : 'Run a tool to start the conversation, then follow up here.';

  return (
    <div className="pm-ws-composer-wrap">
      <form className="pm-ws-composer" onSubmit={submit}>
        <button className="pm-ws-comp-add" type="button" disabled title="Writing tools (Sprint 4)">
          <Icon name="plus" size={18} />
        </button>
        <input
          className="pm-ws-comp-input"
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={!sessionReady}
          placeholder={placeholder}
          aria-label="Message the Workshop"
        />
        <div className="pm-ws-comp-right">
          <span className="pm-ws-comp-pill">
            <Icon name="grid" size={13} /> Tools
          </span>
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
                  ? 'Send follow-up'
                  : 'Run a tool first — follow-ups continue its conversation'
              }
              aria-label="Send follow-up"
            >
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </form>
    </div>
  );
};
