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
  canMessage: boolean;
  /** The current recipient already has a retained conversation (drives copy). */
  hasConversation: boolean;
  /** Deterministic current-recipient label for visible, accessible composer language. */
  recipientLabel: string;
  /** A run is streaming — show stop instead of send. */
  isRunning: boolean;
  /** First host snapshot has arrived. */
  sessionReady: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenContext: () => void;
  onOpenTools: () => void;
}

export const WorkshopComposer: React.FC<WorkshopComposerProps> = ({
  canMessage,
  hasConversation,
  recipientLabel,
  isRunning,
  sessionReady,
  onSend,
  onCancel,
  onOpenContext,
  onOpenTools
}) => {
  const [draft, setDraft] = React.useState('');
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const trimmed = draft.trim();
  const canSend = canMessage && trimmed.length > 0;

  const sendDraft = () => {
    if (!canSend) {
      return;
    }
    onSend(trimmed);
    setDraft('');
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    sendDraft();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends; Shift+Enter remains native textarea behavior so writers can
    // compose a deliberate multi-line prompt without fighting the form.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  };

  React.useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 240)}px`;
  }, [draft]);

  const placeholder = hasConversation
    ? `Continue with ${recipientLabel}…`
    : `Message ${recipientLabel} about this excerpt…`;

  return (
    <div className="pm-ws-composer-wrap">
      <form className="pm-ws-composer" onSubmit={submit}>
        <button
          className="pm-ws-comp-add"
          type="button"
          disabled={!sessionReady}
          title="Add project context"
          aria-label="Add project context"
          onClick={onOpenContext}
        >
          <Icon name="plus" size={18} />
        </button>
        <textarea
          ref={textareaRef}
          className="pm-ws-comp-input"
          rows={3}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canMessage}
          placeholder={placeholder}
          aria-label={`Message ${recipientLabel}`}
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
                  ? `Continue with ${recipientLabel}`
                  : `Message ${recipientLabel}`
              }
              aria-label={`Send message to ${recipientLabel}`}
            >
              <Icon name="send" size={16} />
            </button>
          )}
        </div>
      </form>
      {/* Learn-once chrome, centered in the quiet zone below the input: the
          accent on Shift+Enter does the noticing work, so the hint doesn't
          need the prime band above the composer (composer-messaging v2). */}
      <p className="pm-ws-composer-hint">
        Enter to send · <span className="pm-ws-hint-key">Shift+Enter</span> for a new line
      </p>
    </div>
  );
};
