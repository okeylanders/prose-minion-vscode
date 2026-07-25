/**
 * ExcerptPanel — the rail's excerpt block.
 *
 * Sprint 12 established the intake semantics: setting an excerpt IS the
 * commitment (no "pin" vocabulary), pasted text that matches the active editor
 * selection earns verified provenance, and once the host conversation exists
 * the card locks to `Update text…` (typed origin) or `Re-read from file` (file
 * origin), both riding replaceExcerpt's revision semantics.
 *
 * Sprint 13A (design source: "Prose Minion - Assistant Tab.html",
 * `excerptSection`) makes the block SCOPE-AWARE and moves authoring into the
 * shared Edit/Preview sheet (§5 — "paste or type is a widget, not an instant
 * action"), so this component no longer owns a draft at all. Three states:
 *
 *   • path unchosen  — two big intake buttons, then an "or" split into
 *                      "Start a conversation" (the rail's copy of §2's second
 *                      path), plus "Continue with <title> vN" when a passage
 *                      carried over from the previous session.
 *   • open, no excerpt — the dashed no-excerpt card that says plainly that the
 *                      host has read nothing, that the conversation and its
 *                      history survive, and that CONTEXT still rides along (§8).
 *   • excerpt pinned  — the preview, intake affordances, and the reversal into
 *                      open conversation ("Set this aside" / "Unpin").
 *
 * The excerpt itself is HOST state and arrives via props; this component never
 * talks to the wire.
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  WorkshopExcerptSnapshot,
  WorkshopExcerptSource,
  WorkshopExcerptSourceSnapshot,
  WorkshopSessionScope,
  workshopExcerptTitle
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

export const EXCERPT_WORD_BUDGET = PROMPT_BUDGETS.fileExcerpt.words;

interface ExcerptPanelProps {
  excerpt: WorkshopExcerptSnapshot | null;
  /** The passage set aside for an open conversation; re-pinnable, never deleted. */
  shelvedExcerpt: WorkshopExcerptSnapshot | null;
  /** Explicit session scope — this block's three states key off it, not off `excerpt`. */
  scope: WorkshopSessionScope;
  /** The current host's display label, named in the honesty copy. */
  hostLabel: string;
  /** Disables intake while a run is in flight (host guards too). */
  isRunning: boolean;
  /** True once the host conversation exists — switches to locked affordances. */
  locked: boolean;
  /** Open the shared Edit/Preview sheet to paste or type the passage. */
  onOpenPasteSheet: () => void;
  /** Ask the host to open its file picker and set the chosen file's content. */
  onChooseFile: () => void;
  /** Ask the host to re-read a file-backed excerpt from disk. */
  onRereadFile: () => void;
  /** Continue the carried-over passage: choose the passage path (§3). */
  onContinueWithExcerpt: () => void;
  /** Re-pin the shelved passage without leaving the open conversation (§4). */
  onRepinExcerpt: () => void;
  /** Shelve the passage and switch to open conversation (§4). */
  onSetAside: () => void;
  /** Start an open conversation from the rail's second path (§2). */
  onStartOpenConversation: () => void;
}

const sourceLine = (
  source: WorkshopExcerptSource | WorkshopExcerptSourceSnapshot
): React.ReactNode => {
  if (source.kind === 'manual') {
    return (
      <>
        <Icon name="pen" size={12} /> Pasted or typed · source unknown
      </>
    );
  }
  const lines =
    source.kind === 'editor-selection' && source.startLine !== undefined && source.endLine !== undefined
      ? source.startLine === source.endLine
        ? ` · line ${source.startLine}`
        : ` · lines ${source.startLine}–${source.endLine}`
      : '';
  return (
    <>
      <Icon name="doc" size={12} /> From {source.relativePath}
      {lines}
    </>
  );
};

export const ExcerptPanel: React.FC<ExcerptPanelProps> = ({
  excerpt,
  shelvedExcerpt,
  scope,
  hostLabel,
  isRunning,
  locked,
  onOpenPasteSheet,
  onChooseFile,
  onRereadFile,
  onContinueWithExcerpt,
  onRepinExcerpt,
  onSetAside,
  onStartOpenConversation
}) => {
  const fileBacked = excerpt?.source.kind === 'file';
  const shelvedTitle = shelvedExcerpt ? workshopExcerptTitle(shelvedExcerpt.source) : undefined;

  // ── Open conversation with no passage: the honest no-excerpt card (§8) ──
  if (!excerpt && scope === 'open') {
    return (
      <div className="pm-ws-block">
        <div className="pm-ws-block-head">
          <div className="pm-ws-eyebrow">
            <Icon name="doc" size={12} /> Excerpt
          </div>
          <span className="pm-ws-pill pm-ws-pill-open">Open conversation</span>
        </div>
        <div className="pm-ws-no-excerpt">
          <div className="pm-ws-no-excerpt-title">
            <Icon name="doc" size={14} /> No excerpt yet
          </div>
          <div className="pm-ws-no-excerpt-desc">
            {hostLabel} hasn’t read any pages. Add one whenever you’re ready — this conversation
            stays, and the session keeps its history. Context attachments below still ride along
            with every message.
          </div>
          <div className="pm-ws-excerpt-actions">
            <button
              className="pm-ws-action-btn pm-ws-action-btn-grow"
              type="button"
              disabled={isRunning}
              onClick={onOpenPasteSheet}
            >
              <Icon name="pen" size={13} /> Paste or type
            </button>
            <button
              className="pm-ws-action-btn pm-ws-action-btn-grow"
              type="button"
              disabled={isRunning}
              onClick={onChooseFile}
            >
              <Icon name="doc" size={13} /> From project…
            </button>
          </div>
          {shelvedExcerpt && shelvedTitle ? (
            <div className="pm-ws-excerpt-actions">
              <button
                className="pm-ws-action-btn pm-ws-action-btn-grow"
                type="button"
                disabled={isRunning}
                onClick={onRepinExcerpt}
                title="Bring the passage you set aside back into this conversation"
              >
                <Icon name="pin" size={13} /> Re-pin {shelvedTitle} v{shelvedExcerpt.version}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  // ── Path unchosen: intake, then the "or" split into open conversation (§2) ──
  if (!excerpt) {
    return (
      <div className="pm-ws-block">
        <div className="pm-ws-block-head">
          <div className="pm-ws-eyebrow">
            <Icon name="doc" size={12} /> Excerpt
          </div>
        </div>
        {shelvedExcerpt && shelvedTitle ? (
          <button
            className="pm-ws-action-btn pm-ws-action-btn-grow pm-ws-excerpt-continue"
            type="button"
            disabled={isRunning}
            onClick={onContinueWithExcerpt}
          >
            <Icon name="pin" size={13} /> Continue with {shelvedTitle} v{shelvedExcerpt.version}
          </button>
        ) : null}
        <div className="pm-ws-intake-stack">
          <button
            className="pm-ws-intake-btn"
            type="button"
            disabled={isRunning}
            onClick={onOpenPasteSheet}
          >
            <Icon name="pen" size={16} />
            Paste or type
            <span className="pm-ws-intake-sub">verified if it matches your editor selection</span>
          </button>
          <button
            className="pm-ws-intake-btn"
            type="button"
            disabled={isRunning}
            onClick={onChooseFile}
          >
            <Icon name="doc" size={16} />
            Choose from project…
            <span className="pm-ws-intake-sub">
              reads the file, head-slices past {EXCERPT_WORD_BUDGET.toLocaleString()} words
            </span>
          </button>
        </div>
        <p className="pm-ws-intake-caption">
          The excerpt is the text this room is workshopping.
        </p>
        <div className="pm-ws-or">
          <hr />
          <span>or</span>
          <hr />
        </div>
        <button
          className="pm-ws-chat-entry"
          type="button"
          disabled={isRunning}
          onClick={onStartOpenConversation}
        >
          <span className="pm-ws-chat-entry-icon">
            <Icon name="dialogue" size={16} />
          </span>
          <span>
            <span className="pm-ws-chat-entry-name">Start a conversation</span>
            <span className="pm-ws-chat-entry-sub">
              Just chatting / brainstorming — no excerpt needed.
            </span>
          </span>
        </button>
      </div>
    );
  }

  // ── Excerpt pinned ──
  return (
    <div className="pm-ws-block">
      <div className="pm-ws-block-head">
        <div className="pm-ws-eyebrow">
          <Icon name="doc" size={12} /> Excerpt
        </div>
        <span className="pm-ws-pill">Excerpt · v{excerpt.version}</span>
        {locked ? <span className="pm-ws-pill pm-ws-pill-lock">Session live</span> : null}
      </div>

      <div className="pm-ws-provenance">{sourceLine(excerpt.source)}</div>
      <div className="pm-ws-excerpt">{excerpt.text}</div>
      {excerpt.truncation && (
        <p className="pm-ws-excerpt-truncated">
          Head slice: the first {excerpt.truncation.pinnedWords.toLocaleString()} of{' '}
          {excerpt.truncation.totalWords.toLocaleString()} words in this file. The rest is not in
          context.
        </p>
      )}
      <div className="pm-ws-excerpt-actions">
        {locked && fileBacked ? (
          <button
            className="pm-ws-action-btn"
            type="button"
            onClick={onRereadFile}
            disabled={isRunning}
            title="Re-read this file from disk; on-disk edits land as a new excerpt version"
          >
            <Icon name="refresh" size={12} /> Re-read from file
          </button>
        ) : (
          <>
            <button
              className="pm-ws-action-btn"
              type="button"
              disabled={isRunning}
              onClick={onOpenPasteSheet}
              title={
                locked
                  ? 'Replace the excerpt text; the room keeps its memory and sees a new version'
                  : undefined
              }
            >
              <Icon name="pen" size={12} /> {locked ? 'Update text…' : 'Paste or type'}
            </button>
            {locked ? null : (
              <button
                className="pm-ws-action-btn"
                type="button"
                onClick={onChooseFile}
                disabled={isRunning}
                title="Pick a file and set its content as the working excerpt"
              >
                <Icon name="doc" size={12} /> Choose from project…
              </button>
            )}
          </>
        )}
      </div>

      {/* Passage → open, in both directions of the sprint's copy (§4). The
          passage is SHELVED: the button says what happens to it, and the
          sub-line says what happens to the host's claim on it. */}
      <button
        className="pm-ws-chat-entry pm-ws-chat-entry-mini"
        type="button"
        disabled={isRunning}
        onClick={onSetAside}
      >
        <span className="pm-ws-chat-entry-icon">
          <Icon name="dialogue" size={15} />
        </span>
        <span>
          <span className="pm-ws-chat-entry-name">
            {scope === 'open' ? 'Unpin — back to open conversation' : 'Set this aside — just chat'}
          </span>
          <span className="pm-ws-chat-entry-sub">
            {scope === 'open'
              ? `Shelves the passage and keeps this conversation. ${hostLabel} stops treating it as read.`
              : `Keeps the passage on the shelf. ${hostLabel} stops treating it as read.`}
          </span>
        </span>
      </button>
    </div>
  );
};
