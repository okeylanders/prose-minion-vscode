/**
 * WorkshopConversationBehaviorModal — the room-level "how should personas
 * interact with me" settings (ADR 2026-07-20 §11; design source: the
 * Conversation Behavior comp's modal).
 *
 * The modal edits a LOCAL draft seeded from the committed object each time it
 * opens; "Apply to next turn" submits the COMPLETE draft atomically and waits
 * for the host to round-trip it via WORKSHOP_SESSION_STATE — there is no
 * optimistic commit, so the chip keeps the previous value while replacement
 * prompts are assembled and validated. Cancel/Escape/backdrop discard the
 * draft. While a response streams the modal stays open for inspection, but
 * Apply is disabled and the footer says changes wait for the run to finish.
 * Future rows (cross-session preferences, room memory) are visibly disabled
 * rather than pretending to work.
 */

import * as React from 'react';
import { Icon, IconName } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';
import {
  WORKSHOP_INTERACTION_MODE_LABELS,
  WorkshopConversationBehavior,
  WorkshopInteractionMode,
  WorkshopPersonaExpressionLevel
} from '@messages';

/** Card copy is design-verbatim presentation text; labels stay shared/deterministic. */
const MODE_CARDS: ReadonlyArray<{
  mode: WorkshopInteractionMode;
  icon: IconName;
  description: string;
}> = [
  {
    mode: 'analysis',
    icon: 'bars',
    description: 'Leads with the most important finding, traces evidence, offers next moves.'
  },
  {
    mode: 'balanced',
    icon: 'scale',
    description: 'A workshop exchange — one meaningful observation, mixed with real conversation.'
  },
  {
    mode: 'conversational',
    icon: 'dialogue',
    description: 'Shorter, responsive turns that follow your thought — no forced reports.'
  }
];

const EXPRESSION_CARDS: ReadonlyArray<{
  level: WorkshopPersonaExpressionLevel;
  name: string;
  description: string;
}> = [
  {
    level: 'subtle',
    name: 'Subtle',
    description: 'Quieter delivery — fewer quirks and metaphors, same person and expertise.'
  },
  {
    level: 'full',
    name: 'Full',
    description: 'Their natural voice, tastes, trait tensions, and verbal palette without muting.'
  },
  {
    level: 'amplified',
    name: 'Amplified',
    description: 'Strongest authored differentiation — calibrated language and communication pressure.'
  }
];

const ADAPTATION_TOGGLES: ReadonlyArray<{
  key: 'reactToCurrentMessage' | 'carryCuesThroughSession';
  name: string;
  description: string;
}> = [
  {
    key: 'reactToCurrentMessage',
    name: 'React to each message',
    description:
      'Pick up the tone, energy, humor, or urgency in the message you just sent and respond ' +
      'in kind. Applies to that message only — nothing is labeled or stored.'
  },
  {
    key: 'carryCuesThroughSession',
    name: 'Carry cues through this session',
    description:
      'Let cues build up across the conversation — like preferring blunt critique or brief ' +
      'answers — and shape later turns. Cleared when the session ends or when you turn this off.'
  }
];

/**
 * Expression glyphs, inlined from the approved comp — the shared Icon set has
 * no dashed/solid-center circle pair (ContextBudget's chevron precedent).
 */
const ExpressionGlyph: React.FC<{ level: WorkshopPersonaExpressionLevel }> = ({ level }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    {level === 'subtle' ? (
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2.6" />
    ) : level === 'full' ? (
      <>
        <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="8" cy="8" r="2.2" fill="currentColor" />
      </>
    ) : (
      <>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="4.2" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="8" cy="8" r="1.8" fill="currentColor" />
      </>
    )}
  </svg>
);

/** Whole-object equality — the behavior contract is four flat fields (ADR §3). */
const behaviorEquals = (
  a: WorkshopConversationBehavior,
  b: WorkshopConversationBehavior
): boolean =>
  a.interactionMode === b.interactionMode &&
  a.expressionLevel === b.expressionLevel &&
  a.reactToCurrentMessage === b.reactToCurrentMessage &&
  a.carryCuesThroughSession === b.carryCuesThroughSession;

/** In-flight Apply: what was submitted, and what was committed at submit time. */
interface PendingApply {
  submitted: WorkshopConversationBehavior;
  /** Distinguishes "no round-trip yet" from "the host committed something else". */
  baseline: WorkshopConversationBehavior;
}

interface WorkshopConversationBehaviorModalProps {
  open: boolean;
  /** The COMMITTED room behavior (host truth via the session snapshot). */
  behavior: WorkshopConversationBehavior;
  /** A response is streaming — Apply locks; inspection stays available. */
  isRunning: boolean;
  /** Host rejection details; a new error releases a pending Apply for retry. */
  errorMessage?: string;
  onApply: (behavior: WorkshopConversationBehavior) => void;
  onClose: () => void;
}

export const WorkshopConversationBehaviorModal: React.FC<WorkshopConversationBehaviorModalProps> = ({
  open,
  behavior,
  isRunning,
  errorMessage,
  onApply,
  onClose
}) => {
  const [draft, setDraft] = React.useState<WorkshopConversationBehavior>({ ...behavior });
  const [pending, setPending] = React.useState<PendingApply | null>(null);

  // Reseed from the committed object on each open; a stray snapshot while the
  // modal is open must not clobber mid-edit draft state, so deps are [open]
  // only (the open-transition closure carries the current committed value).
  React.useEffect(() => {
    if (open) {
      setDraft({ ...behavior });
      setPending(null);
    }
  }, [open]);

  // Pending resolution: the host round-trips the applied object through the
  // next session state. Committed === submitted → done, close. Committed
  // moved somewhere ELSE (handler rejected or another change won) → drop the
  // wait state and hand the modal back. Closed mid-wait → nothing to resolve.
  React.useEffect(() => {
    if (!pending) {
      return;
    }
    if (!open) {
      setPending(null);
      return;
    }
    if (behaviorEquals(behavior, pending.submitted)) {
      setPending(null);
      onClose();
    } else if (!behaviorEquals(behavior, pending.baseline)) {
      setPending(null);
    }
  }, [behavior, onClose, open, pending]);

  React.useEffect(() => {
    if (pending && errorMessage) {
      setPending(null);
    }
  }, [errorMessage, pending]);

  const editingLocked = pending !== null;
  const applyLocked = isRunning || editingLocked;

  const apply = () => {
    if (applyLocked) {
      return;
    }
    const submitted = { ...draft };
    onApply(submitted);
    setPending({ submitted, baseline: { ...behavior } });
  };

  const selectMode = (interactionMode: WorkshopInteractionMode) =>
    setDraft((current) => ({ ...current, interactionMode }));
  const selectExpression = (expressionLevel: WorkshopPersonaExpressionLevel) =>
    setDraft((current) => ({ ...current, expressionLevel }));
  const flipToggle = (key: 'reactToCurrentMessage' | 'carryCuesThroughSession') =>
    setDraft((current) => ({ ...current, [key]: !current[key] }));

  return (
    <WorkshopModalShell
      open={open}
      titleId="pm-ws-behavior-title"
      closeLabel="Close conversation behavior"
      className="pm-ws-behavior-modal"
      onClose={onClose}
    >
      <div className="pm-ws-tools-modal-head">
        <div>
          <div className="pm-ws-eyebrow">Workshop · Room settings</div>
          <h2 id="pm-ws-behavior-title">Conversation behavior</h2>
          <p>Choose how Workshop personas respond. Applies to Jill and invited personas; tools are unchanged.</p>
        </div>
        <WorkshopModalShell.CloseButton />
      </div>

      <section className="pm-ws-tools-modal-section">
        <div className="pm-ws-tools-modal-rule">
          <span className="pm-ws-eyebrow">Response style</span>
          <hr />
        </div>
        <div className="pm-ws-behavior-cards">
          {MODE_CARDS.map((card) => (
            <button
              key={card.mode}
              className={`pm-ws-behavior-card ${
                draft.interactionMode === card.mode ? 'pm-ws-behavior-card-selected' : ''
              }`}
              type="button"
              aria-pressed={draft.interactionMode === card.mode}
              disabled={editingLocked}
              onClick={() => selectMode(card.mode)}
            >
              <span className="pm-ws-behavior-card-top">
                <Icon name={card.icon} size={14} />
                <span className="pm-ws-behavior-card-name">
                  {WORKSHOP_INTERACTION_MODE_LABELS[card.mode]}
                </span>
              </span>
              <span className="pm-ws-behavior-card-desc">{card.description}</span>
            </button>
          ))}
        </div>
        <p className="pm-ws-behavior-note">
          What you ask for always wins — “analyze this” gets analysis in any style.
        </p>
      </section>

      <section className="pm-ws-tools-modal-section">
        <div className="pm-ws-tools-modal-rule">
          <span className="pm-ws-eyebrow">Persona expression</span>
          <hr />
        </div>
        <div className="pm-ws-behavior-cards">
          {EXPRESSION_CARDS.map((card) => (
            <button
              key={card.level}
              className={`pm-ws-behavior-card ${
                draft.expressionLevel === card.level ? 'pm-ws-behavior-card-selected' : ''
              }`}
              type="button"
              aria-pressed={draft.expressionLevel === card.level}
              disabled={editingLocked}
              onClick={() => selectExpression(card.level)}
            >
              <span className="pm-ws-behavior-card-top">
                <ExpressionGlyph level={card.level} />
                <span className="pm-ws-behavior-card-name">{card.name}</span>
              </span>
              <span className="pm-ws-behavior-card-desc">{card.description}</span>
            </button>
          ))}
        </div>
        <p className="pm-ws-behavior-note">
          Identity and craft expertise remain present at every level.
        </p>
      </section>

      <section className="pm-ws-tools-modal-section">
        <div className="pm-ws-tools-modal-rule">
          <span className="pm-ws-eyebrow">Adaptation</span>
          <hr />
        </div>
        {ADAPTATION_TOGGLES.map((row) => (
          <div key={row.key} className="pm-ws-behavior-row">
            <div className="pm-ws-behavior-row-text">
              <div className="pm-ws-behavior-row-name">{row.name}</div>
              <div className="pm-ws-behavior-row-desc">{row.description}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draft[row.key]}
              aria-label={row.name}
              disabled={editingLocked}
              className={`pm-ws-behavior-toggle ${
                draft[row.key] ? 'pm-ws-behavior-toggle-on' : ''
              }`}
              onClick={() => flipToggle(row.key)}
            >
              <span className="pm-ws-behavior-toggle-thumb" />
            </button>
          </div>
        ))}
        {/* Future control, visibly disabled — never a nonfunctional consent
            toggle (ADR §11 rule 5 applies to every not-yet-real switch). */}
        <div className="pm-ws-behavior-row pm-ws-behavior-row-future">
          <div className="pm-ws-behavior-row-text">
            <div className="pm-ws-behavior-row-name">
              Remember stable preferences across sessions
              <span className="pm-ws-behavior-ftag">Future</span>
            </div>
            <div className="pm-ws-behavior-row-desc">
              Off until you can view, correct, and delete what is retained. Never stores
              temporary moods or emotions.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={false}
            aria-label="Remember stable preferences across sessions"
            title="Coming later"
            disabled
            className="pm-ws-behavior-toggle pm-ws-behavior-toggle-locked"
          >
            <span className="pm-ws-behavior-toggle-thumb" />
          </button>
        </div>
      </section>

      <section className="pm-ws-tools-modal-section">
        <div className="pm-ws-tools-modal-rule">
          <span className="pm-ws-eyebrow">Room memory</span>
          <hr />
          <span className="pm-ws-behavior-ftag">Coming later</span>
        </div>
        <div className="pm-ws-behavior-room-row">
          <div className="pm-ws-behavior-row-text">
            <div className="pm-ws-behavior-room-name">Shared history and continuity</div>
            <div className="pm-ws-behavior-room-desc">
              View, manage, and delete what the room remembers across sessions. Arrives with
              its own decision — nothing is stored today.
            </div>
          </div>
        </div>
      </section>

      <div className="pm-ws-behavior-foot">
        {pending ? (
          <span className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy" role="status">
            Conversation style is updating…
          </span>
        ) : isRunning ? (
          <span className="pm-ws-behavior-foot-note pm-ws-behavior-foot-note-busy" role="status">
            A response is in progress — changes are available when it finishes.
          </span>
        ) : (
          <span className="pm-ws-behavior-foot-note">
            Takes effect on your next message. The conversation is never reset.
          </span>
        )}
        <button className="pm-ws-action-btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="pm-ws-primary-btn"
          type="button"
          disabled={applyLocked}
          onClick={apply}
        >
          Apply to next turn
        </button>
      </div>
    </WorkshopModalShell>
  );
};
