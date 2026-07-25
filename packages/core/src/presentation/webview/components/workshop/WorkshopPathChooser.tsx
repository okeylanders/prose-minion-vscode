/**
 * WorkshopPathChooser — the first-run center state (Sprint 13A §2; design
 * source: "Prose Minion - Assistant Tab.html", the `wk-first` block).
 *
 * Replaces "Pin an excerpt to start the Workshop." Two equal-weight cards, both
 * of which open a REAL session with the chosen host — the point of the comp is
 * that neither path is the consolation prize.
 *
 * Rendered whenever session scope is unchosen, including after a new session
 * that carried an excerpt over: that case leads with "Continue with current
 * excerpt" so the writer never re-pins text the room already holds (§3).
 */

import * as React from 'react';
import { Icon } from '@components/shared/Icon';
import {
  WorkshopExcerptSnapshot,
  workshopExcerptSourcePath,
  workshopExcerptTitle
} from '@messages';

interface WorkshopPathChooserProps {
  hostLabel: string;
  /** The host's craft specialty, named in the footer beside it. */
  hostSpecialty: string;
  /**
   * The excerpt this room already holds — pinned or shelved — which a new
   * session deliberately carries across the boundary.
   */
  carriedExcerpt?: WorkshopExcerptSnapshot;
  carriedExcerptWordCount: number;
  /** True when there is an excerpt, a shelved passage, or an attachment to clear. */
  hasWorkingSet: boolean;
  /** How many context attachments would be discarded; names the cost honestly. */
  contextAttachmentCount: number;
  disabled: boolean;
  onContinueWithExcerpt: () => void;
  onPasteExcerpt: () => void;
  onChooseFromProject: () => void;
  onStartOpenConversation: () => void;
  /** Clear the carried-over working set and start genuinely empty. */
  onResetWorkingSet: () => void;
}

export const WorkshopPathChooser: React.FC<WorkshopPathChooserProps> = ({
  hostLabel,
  hostSpecialty,
  carriedExcerpt,
  carriedExcerptWordCount,
  hasWorkingSet,
  contextAttachmentCount,
  disabled,
  onContinueWithExcerpt,
  onPasteExcerpt,
  onChooseFromProject,
  onStartOpenConversation,
  onResetWorkingSet
}) => {
  const carriedSourcePath = carriedExcerpt
    ? workshopExcerptSourcePath(carriedExcerpt.source) ?? 'pasted text'
    : undefined;

  return (
    <div className="pm-ws-first">
      <div className="pm-ws-first-spark">
        <Icon name="sparkle" size={24} />
      </div>
      <h2>What are we making today?</h2>
      <p className="pm-ws-first-sub">
        Two ways in. Both open a real session with {hostLabel} — pick the one that matches where
        the work is right now.
      </p>

      <div className="pm-ws-paths">
        <div className="pm-ws-path-card">
          <div className="pm-ws-path-head">
            <span className="pm-ws-path-icon">
              <Icon name="doc" size={16} />
            </span>
            <span>
              <span className="pm-ws-path-title">Workshop an excerpt</span>
              <span className="pm-ws-path-kicker">Passage session</span>
            </span>
          </div>
          <div className="pm-ws-path-desc">
            Bring in a passage for close reading, analysis, and writing tools. Talk through the
            analysis in chat with {hostLabel} or other persona hosts — you can even invite
            multiple hosts to the chat.
          </div>
          <div className="pm-ws-path-actions">
            {carriedExcerpt ? (
              <>
                <button
                  className="pm-ws-path-btn pm-ws-path-btn-solid"
                  type="button"
                  disabled={disabled}
                  onClick={onContinueWithExcerpt}
                >
                  <Icon name="pin" size={14} /> Continue with current excerpt
                </button>
                <div className="pm-ws-path-carry">
                  {workshopExcerptTitle(carriedExcerpt.source)} v{carriedExcerpt.version} ·{' '}
                  {carriedSourcePath} · {carriedExcerptWordCount.toLocaleString()} words
                </div>
              </>
            ) : null}
            <button
              className={`pm-ws-path-btn${carriedExcerpt ? '' : ' pm-ws-path-btn-solid'}`}
              type="button"
              disabled={disabled}
              onClick={onPasteExcerpt}
            >
              <Icon name="pen" size={14} /> Paste or type…
            </button>
            <button
              className="pm-ws-path-btn"
              type="button"
              disabled={disabled}
              onClick={onChooseFromProject}
            >
              <Icon name="doc" size={14} /> Choose from project…
            </button>
          </div>
          <div className="pm-ws-path-note">All 14 tools available · guests can be invited</div>
        </div>

        <div className="pm-ws-path-card pm-ws-path-card-chat">
          <div className="pm-ws-path-head">
            <span className="pm-ws-path-icon">
              <Icon name="dialogue" size={16} />
            </span>
            <span>
              <span className="pm-ws-path-title">Just chatting / brainstorming</span>
              <span className="pm-ws-path-kicker">Open conversation</span>
            </span>
          </div>
          <div className="pm-ws-path-desc">
            Talk through an idea, scene, character, or craft problem. You can add pages later.
          </div>
          <div className="pm-ws-path-actions">
            <button
              className="pm-ws-path-btn pm-ws-path-btn-calm"
              type="button"
              disabled={disabled}
              onClick={onStartOpenConversation}
            >
              <Icon name="dialogue" size={14} /> Start a conversation
            </button>
          </div>
          <div className="pm-ws-path-note">
            No excerpt needed · context still attaches · analysis tools stay off until you add one
          </div>
        </div>
      </div>

      {/* Offered only when something would actually be discarded: a button that
          promises to clear nothing is noise, and this one is styled as
          destructive precisely because it usually is not what the writer wants
          (the whole point of the boundary is that the passage survives it). */}
      {hasWorkingSet ? (
        <button
          className="pm-ws-reset-working-set"
          type="button"
          disabled={disabled}
          onClick={onResetWorkingSet}
          title="Discard the carried-over excerpt and context and start empty"
        >
          <Icon name="x" size={13} /> Reset excerpt and context
          <span className="pm-ws-reset-working-set-note">
            {[
              carriedExcerpt ? '1 excerpt' : undefined,
              contextAttachmentCount > 0
                ? `${contextAttachmentCount} attachment${contextAttachmentCount === 1 ? '' : 's'}`
                : undefined
            ].filter(Boolean).join(' · ')}
          </span>
        </button>
      ) : null}

      <div className="pm-ws-first-foot">
        Host for either path:{' '}
        <b>
          {hostLabel} · {hostSpecialty}
        </b>{' '}
        — <span className="pm-ws-first-foot-accent">Or select another host up top.</span>
      </div>
    </div>
  );
};
