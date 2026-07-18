/**
 * WorkshopComposer — the free-text follow-up bar (ADR 2026-07-03, Sprint 3).
 *
 * Sends WORKSHOP_SEND_MESSAGE through the callback; the host decides whether
 * that starts/continues the selected persona or an explicit direct-tool
 * target. A pinned excerpt enables the first host message before any tool has
 * run. While a run streams, the send button becomes a stop affordance wired
 * to CANCEL_WORKSHOP_REQUEST.
 *
 * Phase 6B: the `+` button opens a two-item menu — add to STANDING context
 * (re-shipped, budgeted) or attach to THIS message (a one-shot
 * thread-artifact). Staged message attachments render as removable pills
 * above the input and ride the next send only.
 *
 * The draft is deliberately LOCAL state: it's unsent user input, not session
 * truth, so it doesn't belong in WorkshopSessionService (and losing it on a
 * webview reload is acceptable alpha behavior). Staged attachments are HOST
 * state — they survive reloads with the session snapshot.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { WorkshopMessageAttachmentSnapshot } from '@messages';

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
  /** Staged one-shot attachments for the NEXT message (host truth). */
  messageAttachments: WorkshopMessageAttachmentSnapshot[];
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenContext: () => void;
  onAttachToMessage: () => void;
  onRemoveMessageAttachment: (id: string) => void;
  onOpenTools: () => void;
}

export const WorkshopComposer: React.FC<WorkshopComposerProps> = ({
  canMessage,
  hasConversation,
  recipientLabel,
  isRunning,
  sessionReady,
  messageAttachments,
  onSend,
  onCancel,
  onOpenContext,
  onAttachToMessage,
  onRemoveMessageAttachment,
  onOpenTools
}) => {
  const [draft, setDraft] = React.useState('');
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const addMenuRef = React.useRef<HTMLDivElement>(null);

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

  // Close the add menu on any outside click or Escape.
  React.useEffect(() => {
    if (!addMenuOpen) {
      return undefined;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (!addMenuRef.current?.contains(event.target as Node)) {
        setAddMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setAddMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [addMenuOpen]);

  const chooseAdd = (action: () => void) => {
    setAddMenuOpen(false);
    action();
  };

  const placeholder = hasConversation
    ? `Continue with ${recipientLabel}…`
    : `Message ${recipientLabel} about this excerpt…`;

  return (
    <div className="pm-ws-composer-wrap">
      {messageAttachments.length > 0 && (
        <div className="pm-ws-comp-attachments" aria-label="Attachments for this message">
          {messageAttachments.map((attachment) => (
            <span key={attachment.id} className="pm-ws-comp-attachment" title={attachment.relativePath ?? attachment.label}>
              <Icon name="doc" size={11} />
              <span className="pm-ws-comp-attachment-label">{attachment.label}</span>
              <span className="pm-ws-comp-attachment-size">
                {attachment.words.toLocaleString()} words{attachment.truncation ? ' · head slice' : ''}
              </span>
              <button
                type="button"
                className="pm-ws-comp-attachment-remove"
                title={`Remove ${attachment.label} from this message`}
                aria-label={`Remove ${attachment.label} from this message`}
                onClick={() => onRemoveMessageAttachment(attachment.id)}
              >
                <Icon name="x" size={10} />
              </button>
            </span>
          ))}
          <span className="pm-ws-comp-attachment-hint">rides the next message only</span>
        </div>
      )}
      <form className="pm-ws-composer" onSubmit={submit}>
        <div className="pm-ws-comp-add-wrap" ref={addMenuRef}>
          <button
            className="pm-ws-comp-add"
            type="button"
            disabled={!sessionReady}
            title="Add context"
            aria-label="Add context"
            aria-haspopup="menu"
            aria-expanded={addMenuOpen}
            onClick={() => setAddMenuOpen((open) => !open)}
          >
            <Icon name="plus" size={18} />
          </button>
          {addMenuOpen && (
            <div className="pm-ws-comp-add-menu" role="menu" aria-label="Add context options">
              <button
                type="button"
                role="menuitem"
                onClick={() => chooseAdd(onAttachToMessage)}
              >
                <Icon name="doc" size={13} />
                <span>
                  Attach to this message
                  <small>rides one message, then becomes history</small>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => chooseAdd(onOpenContext)}
              >
                <Icon name="pin" size={13} />
                <span>
                  Add to standing context
                  <small>stays attached for the whole session</small>
                </span>
              </button>
            </div>
          )}
        </div>
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
