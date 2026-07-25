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
 *
 * Sprint 13A: the composer is SCOPE-AWARE (§9/§10). In an open conversation the
 * placeholder asks what you'd like to brainstorm, an "Add excerpt" affordance
 * sits beside the attach button, and Tools is `aria-disabled` with a visible
 * reason rather than silently dead — the writer learns why, and a screen reader
 * hears the same sentence. Starters seed the draft through `draftSeed`.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  WORKSHOP_INTERACTION_MODE_LABELS,
  WORKSHOP_RELATIONAL_DEPTH_LABELS,
  WorkshopConversationBehavior,
  WorkshopMessageAttachmentSnapshot,
  WorkshopSessionScope
} from '@messages';

/** The one sentence the gated tool affordances say, everywhere (§9). */
export const WORKSHOP_TOOLS_GATED_REASON = 'Add an excerpt to use analysis tools.';

interface WorkshopComposerProps {
  /** The session has a subject (excerpt or open scope) and no run is in flight. */
  canMessage: boolean;
  /** Explicit session scope — placeholder, tool gating, and copy all key off it. */
  scope: WorkshopSessionScope;
  /** True when a passage is pinned; the ONLY thing that unlocks analysis tools. */
  hasExcerpt: boolean;
  /**
   * The scope lock (ADR 2026-07-25). Once the room has a memory the path is
   * settled, so the composer's door into the passage path closes.
   */
  roomHasMemory: boolean;
  /** Prefill requested from outside (an open-chat starter chip); appended once. */
  draftSeed?: { text: string; token: number };
  /** Open the shared Edit/Preview sheet to add an excerpt mid-conversation. */
  onAddExcerpt: () => void;
  /** Announce why a gated affordance is unavailable (toast + live region). */
  onGatedAction: (reason: string) => void;
  /** The current recipient already has a retained conversation (drives copy). */
  hasConversation: boolean;
  /** Deterministic current-recipient label for visible, accessible composer language. */
  recipientLabel: string;
  /** A run is streaming — show stop instead of send. */
  isRunning: boolean;
  /** First host snapshot has arrived. */
  sessionReady: boolean;
  /** COMMITTED room behavior (host truth) — the mode chip renders this. */
  conversationBehavior: WorkshopConversationBehavior;
  /** True when the current global profile contributes persona prompt context. */
  writerProfileShared: boolean;
  /** Staged one-shot attachments for the NEXT message (host truth). */
  messageAttachments: WorkshopMessageAttachmentSnapshot[];
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenContext: () => void;
  onAttachToMessage: () => void;
  onRemoveMessageAttachment: (id: string) => void;
  onOpenConversationSettings: () => void;
  onOpenTools: () => void;
}

/**
 * The mode chip's diamond, inlined from the approved comp (Conversation
 * Behavior design) — the shared Icon set has no diamond glyph, and single-use
 * comp svgs stay local to their component (ContextBudget's chevron precedent).
 */
const ModeChipDiamond: React.FC = () => (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 1.5L14.5 8 8 14.5 1.5 8 8 1.5z"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  </svg>
);

export const WorkshopComposer: React.FC<WorkshopComposerProps> = ({
  canMessage,
  scope,
  hasExcerpt,
  roomHasMemory,
  draftSeed,
  onAddExcerpt,
  onGatedAction,
  hasConversation,
  recipientLabel,
  isRunning,
  sessionReady,
  conversationBehavior,
  writerProfileShared,
  messageAttachments,
  onSend,
  onCancel,
  onOpenContext,
  onAttachToMessage,
  onRemoveMessageAttachment,
  onOpenConversationSettings,
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

  // Starter chips seed the draft rather than sending: the writer still owns the
  // turn. Keyed on the token so clicking the same starter twice works, and so a
  // re-render never re-applies a seed the writer has since edited away.
  const appliedSeedRef = React.useRef<number>();
  React.useEffect(() => {
    if (!draftSeed || appliedSeedRef.current === draftSeed.token) {
      return;
    }
    appliedSeedRef.current = draftSeed.token;
    setDraft(draftSeed.text);
    textareaRef.current?.focus();
  }, [draftSeed]);

  const openWithoutExcerpt = scope === 'open' && !hasExcerpt;
  // The passage path is only reachable from here while nobody has been
  // prompted yet; after that it is a new session, not a button.
  const canAddExcerpt = openWithoutExcerpt && !roomHasMemory;
  const placeholder = scope === null
    ? 'Pick a starting path above to begin…'
    : openWithoutExcerpt
      ? `What would you like to brainstorm with ${recipientLabel}?`
      : hasConversation
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
        {canAddExcerpt && (
          /* The composer's own door into the passage path (§4). It sits beside
             the attach button rather than in the action cluster, because it
             changes what the room IS, not how this one message is sent — which
             is also why it closes once the room has a memory. */
          <button
            className="pm-ws-comp-add-excerpt"
            type="button"
            disabled={!sessionReady}
            title="Add an excerpt to this session"
            onClick={onAddExcerpt}
          >
            <Icon name="doc" size={14} /> Add excerpt
          </button>
        )}
        <div className="pm-ws-comp-right">
          {/* Current-mode chip (ADR 2026-07-20 §11): the visible label is the
              ACTIVE state, never the phrase "Interaction Mode"; the accessible
              name is the action it performs. Stays enabled while a response
              streams — the modal is open for inspection; only Apply locks. */}
          <button
            className="pm-ws-comp-pill pm-ws-mode-chip"
            type="button"
            disabled={!sessionReady}
            title={`Conversation settings: ${WORKSHOP_INTERACTION_MODE_LABELS[conversationBehavior.interactionMode]}, ${conversationBehavior.expressionLevel}, ${WORKSHOP_RELATIONAL_DEPTH_LABELS[conversationBehavior.relationalDepth]}, profile ${writerProfileShared ? 'shared' : 'not shared'}`}
            aria-label={`Conversation settings: ${WORKSHOP_INTERACTION_MODE_LABELS[conversationBehavior.interactionMode]}, ${conversationBehavior.expressionLevel}, ${WORKSHOP_RELATIONAL_DEPTH_LABELS[conversationBehavior.relationalDepth]}, profile ${writerProfileShared ? 'shared' : 'not shared'}`}
            onClick={onOpenConversationSettings}
          >
            <ModeChipDiamond />
            {writerProfileShared && <span className="pm-ws-mode-chip-profile-dot" aria-hidden="true" />}
            <span className="pm-ws-mode-chip-label">
              {WORKSHOP_INTERACTION_MODE_LABELS[conversationBehavior.interactionMode]}
            </span>
            <span className="pm-ws-mode-chip-sub">
              {conversationBehavior.expressionLevel.toUpperCase()}
            </span>
          </button>
          {/* §9: gated, not deleted. `aria-disabled` keeps the button
              focusable so the reason is reachable by keyboard and announced,
              which a `disabled` attribute would hide entirely. */}
          <button
            className={`pm-ws-comp-pill${hasExcerpt ? '' : ' pm-ws-comp-pill-off'}`}
            type="button"
            disabled={!sessionReady}
            aria-disabled={hasExcerpt ? undefined : true}
            title={hasExcerpt ? undefined : WORKSHOP_TOOLS_GATED_REASON}
            onClick={hasExcerpt
              ? onOpenTools
              : () => onGatedAction(WORKSHOP_TOOLS_GATED_REASON)}
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
