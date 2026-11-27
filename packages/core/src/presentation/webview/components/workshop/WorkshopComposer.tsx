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
 * Everyday Conveniences (ADR 2026-11-14 D9, D14): an "Include selected text"
 * toggle sits in the controls row, after the cache estimate. While it is on, the editor's current
 * selection is drawn after the staged pills as a live "Selected Text" pill,
 * from props (`WorkshopSelectedTextControls`); the composer posts nothing.
 *
 * The local draft belongs to the composer. Staged attachments survive reloads with the host snapshot.
 *
 * Sprint 13A: the composer is SCOPE-AWARE (§9/§10). In an open conversation the
 * placeholder asks what you'd like to brainstorm, an "Add excerpt" affordance
 * sits beside the attach button, and Tools is `aria-disabled` with a visible
 * reason rather than silently dead — the writer learns why, and a screen reader
 * hears the same sentence. Starters seed the draft through `draftSeed`.
 *
 * Everyday Conveniences round two (item G): typing `@` opens a list of
 * project files above the composer (`WorkshopComposerMentionList`, driven by
 * `useWorkshopComposerMentions`). A pick stages the same pill the attach menu
 * stages and writes the file's token into the draft as prose. While the list
 * has an active option, Enter and Tab pick it; otherwise Enter sends.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import { workshopComposerDraftAfterSeed } from '@utils/workshop/workshopComposerDraft';
export { workshopComposerDraftAfterSeed };
import { workshopComposerPasteHandlers } from './workshopComposerPasteHandlers';
import type { WorkshopComposerPastedText } from '@hooks/domain/workshop/useWorkshopPastedText';
import { WorkshopComposerAttachments } from '@components/workshop/WorkshopComposerAttachments';
import { WorkshopCacheIndicator } from '@components/workshop/WorkshopCacheIndicator';
import { WorkshopComposerMentionList, workshopMentionOptionId } from '@components/workshop/WorkshopComposerMentionList';
import {
  WorkshopSelectedTextToggle,
  type WorkshopComposerSelectedText
} from '@components/workshop/WorkshopSelectedTextControls';
import { useWorkshopComposerMentions } from '@hooks/domain/workshop/controllers/useWorkshopComposerMentions';
import type { WorkshopMentionEdit } from '@utils/workshop/workshopComposerMentions';
import {
  ConfiguredResourceEntry,
  ConfiguredResourceRef,
  WORKSHOP_INTERACTION_MODE_LABELS,
  WORKSHOP_RELATIONAL_DEPTH_LABELS,
  WorkshopConversationBehavior,
  WorkshopMessageAttachmentSnapshot,
  WorkshopSessionScope
} from '@messages';

/** `@` in the composer: the catalog it lists and the message-attach action a pick stages through. */
export interface WorkshopComposerMentions {
  /** The configured-resource catalog; null until the host has answered once. */
  catalog: readonly ConfiguredResourceEntry[] | null;
  onRequestCatalog: () => void;
  onAttach: (items: ConfiguredResourceRef[]) => void;
}

const NO_MENTION_EFFECT = () => undefined;

/** The one sentence the gated tool affordances say, everywhere (§9). */
export const WORKSHOP_TOOLS_GATED_REASON = 'Add an excerpt to run analysis tools directly.';

interface WorkshopComposerProps {
  /** The session has a subject (excerpt or open scope) and no run is in flight. */
  canMessage: boolean;
  /** Explicit session scope — placeholder, tool gating, and copy all key off it. */
  scope: WorkshopSessionScope;
  /** True when a passage is pinned; controls direct-run copy, not persona asks. */
  hasExcerpt: boolean;
  /**
   * The scope lock (ADR 2026-07-25). Once the room has a memory the path is
   * settled, so the composer's door into the passage path closes.
   */
  roomHasMemory: boolean;
  /**
   * `keepDraft`: a text the host gives back (a refused or rolled-back send, a
   * rewound message) never replaces what the writer has typed since. It goes
   * ahead of it, a blank line between (PR #264 P2).
   */
  draftSeed?: { text: string; token: number; keepDraft?: boolean };
  /** Open the shared Edit/Preview sheet to choose the passage path before memory exists. */
  onAddExcerpt: () => void;
  /** The current recipient already has a retained conversation (drives copy). */
  hasConversation: boolean;
  /** Deterministic current-recipient label for visible, accessible composer language. */
  recipientLabel: string;
  estimatedCacheExpiresAt?: number;
  cacheRequestModelId?: string;
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
  /** Selected Text (ADR 2026-11-14 D14): the "Include selected text" toggle and its live pill; absent, neither is drawn. */
  selectedText?: WorkshopComposerSelectedText;
  pastedText?: WorkshopComposerPastedText;
  /** `@` attaches a project file to this message (item G); absent, `@` is only a character. */
  mentions?: WorkshopComposerMentions;
  onSend: (text: string) => void;
  onCancel: () => void;
  onOpenContext: () => void;
  onAttachToMessage: () => void;
  onRemoveMessageAttachment: (id: string) => void;
  onOpenConversationSettings: () => void;
  onOpenTools: () => void;
  onOpenWidgets: () => void;
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
  hasConversation,
  recipientLabel,
  estimatedCacheExpiresAt,
  cacheRequestModelId,
  isRunning,
  sessionReady,
  conversationBehavior,
  writerProfileShared,
  messageAttachments,
  selectedText, pastedText,
  mentions,
  onSend,
  onCancel,
  onOpenContext,
  onAttachToMessage,
  onRemoveMessageAttachment,
  onOpenConversationSettings,
  onOpenTools,
  onOpenWidgets
}) => {
  const [draft, setDraft] = React.useState('');
  const [addMenuOpen, setAddMenuOpen] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const addMenuRef = React.useRef<HTMLDivElement>(null);
  const mentionListId = React.useId();
  const composerCaretRef = React.useRef<number | null>(null);
  const mention = useWorkshopComposerMentions({
    catalog: mentions?.catalog ?? null,
    staged: messageAttachments,
    enabled: mentions !== undefined && sessionReady,
    onRequestCatalog: mentions?.onRequestCatalog ?? NO_MENTION_EFFECT,
    onAttach: mentions?.onAttach ?? NO_MENTION_EFFECT,
    onBrowse: onAttachToMessage
  });
  const { syncDraft: syncMentionDraft } = mention;
  const applyComposerEdit = (edit: WorkshopMentionEdit | undefined) => {
    if (edit) {
      composerCaretRef.current = edit.caret;
      setDraft(edit.text);
    }
  };

  const trimmed = draft.trim();
  const canSend = canMessage && !pastedText?.mutating() && (trimmed.length > 0 || messageAttachments.length > 0);

  const { paste, insertPaste } = workshopComposerPasteHandlers(pastedText, textareaRef, applyComposerEdit, canMessage && sessionReady);

  const sendDraft = () => {
    if (!canSend || pastedText?.mutating()) {
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
    // Nothing acts while an IME is composing: its Enter confirms a candidate.
    if (event.nativeEvent.isComposing) {
      return;
    }
    // The open file list takes its keys first; Enter sends only when it did not.
    const taken = mention.keyDown(event, draft);
    if (taken.handled) {
      event.preventDefault();
      event.stopPropagation();
      applyComposerEdit(taken.edit);
      return;
    }
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
    if (composerCaretRef.current !== null) {
      textarea.setSelectionRange(composerCaretRef.current, composerCaretRef.current);
      composerCaretRef.current = null;
    }
    syncMentionDraft(draft, textarea.selectionStart);
  }, [draft, syncMentionDraft]);

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
    setDraft((current) => workshopComposerDraftAfterSeed(current, draftSeed));
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
      <WorkshopComposerAttachments
        attachments={messageAttachments}
        pastedText={pastedText}
        locked={!canMessage || !sessionReady}
        onInsert={insertPaste}
        focusDraft={() => textareaRef.current?.focus()}
        livePill={selectedText?.livePill ?? null}
        onRemove={onRemoveMessageAttachment}
      />
      {/* Sprint 13C: the composer stacks — full-width text entry on top, the
          controls row docked beneath it (approved workshop comp `.wk-crow`).
          Chips beside the textarea were squeezing the writing space. */}
      <form className="pm-ws-composer" onSubmit={submit}>
        <WorkshopComposerMentionList
          listId={mentionListId}
          mentions={mention}
          onPick={(index) => applyComposerEdit(mention.pickOption(index, draft))}
          onActivate={mention.setActiveIndex}
        />
        <textarea
          ref={textareaRef}
          className="pm-ws-comp-input"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onPaste={paste}
          onKeyDown={handleKeyDown}
          onSelect={(event) => syncMentionDraft(event.currentTarget.value, event.currentTarget.selectionStart)}
          onBlur={mention.close}
          onCompositionStart={() => mention.setComposing(true)}
          onCompositionEnd={() => mention.setComposing(false)}
          aria-autocomplete={mentions ? 'list' : undefined}
          aria-controls={mention.open ? mentionListId : undefined}
          aria-activedescendant={
            mention.activeIndex >= 0 ? workshopMentionOptionId(mentionListId, mention.activeIndex) : undefined
          }
          disabled={!canMessage}
          placeholder={placeholder}
          aria-label={`Message ${recipientLabel}`}
        />
        <div className="pm-ws-comp-controls">
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
        <WorkshopCacheIndicator
          estimatedExpiresAt={estimatedCacheExpiresAt}
          cacheRequestModelId={cacheRequestModelId}
          recipientLabel={recipientLabel}
        />
        {selectedText && (
          <WorkshopSelectedTextToggle
            on={selectedText.includeSelectedText}
            disabled={!sessionReady}
            onChange={selectedText.onIncludeSelectedTextChange}
          />
        )}
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
            title={`Conversation settings: ${WORKSHOP_INTERACTION_MODE_LABELS[conversationBehavior.interactionMode]}, ${conversationBehavior.expressionLevel}, ${WORKSHOP_RELATIONAL_DEPTH_LABELS[conversationBehavior.relationalDepth]}, proactive assistance ${conversationBehavior.proactiveAssistance ? 'on' : 'off'}, profile ${writerProfileShared ? 'shared' : 'not shared'}`}
            aria-label={`Conversation settings: ${WORKSHOP_INTERACTION_MODE_LABELS[conversationBehavior.interactionMode]}, ${conversationBehavior.expressionLevel}, ${WORKSHOP_RELATIONAL_DEPTH_LABELS[conversationBehavior.relationalDepth]}, proactive assistance ${conversationBehavior.proactiveAssistance ? 'on' : 'off'}, profile ${writerProfileShared ? 'shared' : 'not shared'}`}
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
          {/* Sprint 14: the Conversation Widgets preview — browsable registry,
              nothing opens yet. Not excerpt-gated; browsing never mutates the room. */}
          <button
            className="pm-ws-comp-pill"
            type="button"
            disabled={!sessionReady}
            title="Browse the Conversation Widgets preview"
            onClick={onOpenWidgets}
          >
            <Icon name="sparkle" size={13} /> Widgets
          </button>
          {/* Sprint 13B: this is the "ask the host" door. With an excerpt its
              picker still runs directly; without one it seeds an editable ask
              and never sends on the writer's behalf. The rail remains gated. */}
          <button
            className="pm-ws-comp-pill"
            type="button"
            disabled={!sessionReady}
            title={hasExcerpt ? 'Run a tool against the pinned excerpt' : 'Ask your host to run a tool'}
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
