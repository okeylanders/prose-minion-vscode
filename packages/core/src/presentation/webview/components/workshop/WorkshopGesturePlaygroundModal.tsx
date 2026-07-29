/**
 * WorkshopGesturePlaygroundModal — the first Conversation Widget's pre-commit
 * surface (ADR 2026-07-22, Sprint 01; design Spread 01).
 *
 * The Draft is LOCAL until commit: Cancel/Esc costs nothing, Generate rolls
 * one fast-tier model call into a grouped multi-select menu (Regenerate
 * re-rolls it; commit never re-runs it), and Commit posts the whole Draft to
 * the atomic host route. The modal freezes while the commit is in flight and
 * closes only on the host's ok — the PendingApply posture of
 * WorkshopConversationBehaviorModal, adapted to the widget action result.
 *
 * Three openings: fresh (from the Widgets browser), persona seed (recommend +
 * prefill — everything editable), and clone (re-opened from a committed
 * turn's chip: the exact prior Draft, committing mints a NEW turn; history is
 * never rewritten).
 */

import * as React from 'react';
import {
  WorkshopGestureDraft,
  WorkshopGestureMenuGroup,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetGeneratePayload,
  WorkshopWidgetMenuResultPayload,
  WorkshopWidgetRecommendationSeed
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { Icon } from '@components/shared/Icon';
import { WorkshopModalShell } from './WorkshopModalShell';

/** How the modal was opened; decides seeding and the commit button's label. */
export type WorkshopGestureOpening =
  | { kind: 'new'; seedTargetPhrase?: string }
  | { kind: 'seed'; seed: WorkshopWidgetRecommendationSeed; personaLabel: string }
  | { kind: 'clone'; config: WorkshopWidgetConfigSnapshot };

interface WorkshopGesturePlaygroundModalProps {
  open: boolean;
  opening: WorkshopGestureOpening;
  menuResult: WorkshopWidgetMenuResultPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
  onGenerate: (payload: WorkshopWidgetGeneratePayload) => void;
  onCancelGenerate: () => void;
  onCommit: (draft: WorkshopGestureDraft, clonedFromConfigId?: string) => void;
  onConsumeActionResult: () => void;
  onClose: () => void;
}

let gestureTokenCounter = 0;
const mintToken = (): string => `gesture-${Date.now()}-${++gestureTokenCounter}`;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export const WorkshopGesturePlaygroundModal: React.FC<WorkshopGesturePlaygroundModalProps> = ({
  open,
  opening,
  menuResult,
  actionResult,
  onGenerate,
  onCancelGenerate,
  onCommit,
  onConsumeActionResult,
  onClose
}) => {
  const [targetPhrase, setTargetPhrase] = React.useState('');
  const [contextText, setContextText] = React.useState('');
  const [characterNotes, setCharacterNotes] = React.useState('');
  const [note, setNote] = React.useState('');
  const [menu, setMenu] = React.useState<WorkshopGestureMenuGroup[] | undefined>(undefined);
  const [selections, setSelections] = React.useState<string[]>([]);
  const [generateToken, setGenerateToken] = React.useState<string | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [commitPending, setCommitPending] = React.useState(false);
  const [commitError, setCommitError] = React.useState<string | null>(null);

  /* Re-seed the whole Draft on every open, from the opening's source of
     truth. Clone restores the exact persisted Draft — menu and selections
     included — which is the chip's re-hydration contract. */
  React.useEffect(() => {
    if (!open) {
      return;
    }
    if (opening.kind === 'clone') {
      const { draft } = opening.config;
      setTargetPhrase(draft.targetPhrase);
      setContextText(draft.contextText);
      setCharacterNotes(draft.characterNotes);
      setNote(draft.note);
      setMenu(draft.menu ? draft.menu.map((group) => ({ ...group, options: [...group.options] })) : undefined);
      setSelections([...draft.selections]);
    } else if (opening.kind === 'seed') {
      setTargetPhrase(opening.seed.targetPhrase ?? '');
      setContextText('');
      setCharacterNotes(opening.seed.characterNotes ?? '');
      setNote(opening.seed.note ?? '');
      setMenu(undefined);
      setSelections([]);
    } else {
      setTargetPhrase(opening.seedTargetPhrase ?? '');
      setContextText('');
      setCharacterNotes('');
      setNote('');
      setMenu(undefined);
      setSelections([]);
    }
    setGenerateToken(null);
    setGenerateError(null);
    setCommitPending(false);
    setCommitError(null);
    /* Reseed on open only — `opening` is intentionally not a dependency, so a
       background snapshot refresh cannot clobber in-progress editing. */
  }, [open]);

  /* Absorb the generate result for OUR in-flight token; stale tokens drop. */
  React.useEffect(() => {
    if (!open || !menuResult || menuResult.token !== generateToken) {
      return;
    }
    setGenerateToken(null);
    if (menuResult.ok && menuResult.menu) {
      setMenu(menuResult.menu);
      setSelections((current) =>
        current.filter((selection) =>
          menuResult.menu!.some((group) => group.options.includes(selection))
        )
      );
      setGenerateError(null);
    } else {
      setGenerateError(menuResult.error ?? 'The menu could not be generated. Try again.');
    }
  }, [open, menuResult, generateToken]);

  /* Commit reconciliation: close on ok; surface the failure and unfreeze
     otherwise. The Draft survives either way. */
  React.useEffect(() => {
    if (!open || !commitPending || !actionResult || actionResult.action !== 'commit') {
      return;
    }
    onConsumeActionResult();
    setCommitPending(false);
    if (actionResult.ok) {
      onClose();
    } else {
      setCommitError(actionResult.message ?? 'The commit did not land. Try again.');
    }
  }, [open, commitPending, actionResult, onConsumeActionResult, onClose]);

  const generating = generateToken !== null;
  const locked = commitPending;

  const generate = React.useCallback(() => {
    if (generating || locked || targetPhrase.trim().length === 0) {
      return;
    }
    const token = mintToken();
    setGenerateToken(token);
    setGenerateError(null);
    onGenerate({
      widgetId: 'gesture-playground',
      token,
      targetPhrase,
      contextText,
      characterNotes
    });
  }, [generating, locked, targetPhrase, contextText, characterNotes, onGenerate]);

  const cancelGenerate = React.useCallback(() => {
    setGenerateToken(null);
    onCancelGenerate();
  }, [onCancelGenerate]);

  const toggleSelection = React.useCallback((option: string) => {
    setSelections((current) =>
      current.includes(option)
        ? current.filter((candidate) => candidate !== option)
        : current.length < BUDGET.gestureSelectionsPerCommit
          ? [...current, option]
          : current
    );
  }, []);

  const commit = React.useCallback(() => {
    if (locked || selections.length === 0) {
      return;
    }
    setCommitPending(true);
    setCommitError(null);
    onCommit(
      { targetPhrase, contextText, characterNotes, menu, selections, note },
      opening.kind === 'clone' ? opening.config.id : undefined
    );
  }, [locked, selections, targetPhrase, contextText, characterNotes, menu, note, onCommit, opening]);

  const close = React.useCallback(() => {
    if (generating) {
      cancelGenerate();
    }
    onClose();
  }, [generating, cancelGenerate, onClose]);

  return (
    <WorkshopModalShell
      open={open}
      variant="sheet"
      titleId="pm-ws-gesture-title"
      closeLabel="Close Gesture Playground"
      className="pm-ws-gesture-modal"
      onClose={close}
    >
      <div className="pm-ws-gesture">
        <header className="pm-ws-gesture-head">
          <div className="pm-ws-eyebrow pm-ws-gesture-eyebrow">
            Widget <span className="pm-ws-sb-railtag pm-ws-sb-railtag-oneshot">one-shot · thread-artifact</span>
          </div>
          <h2 id="pm-ws-gesture-title">
            <Icon name="hand" size={17} /> Gesture Playground
          </h2>
          <p className="pm-ws-gesture-sub">
            A menu of creative alternatives for one beat. Play freely —{' '}
            <b>nothing touches the conversation until you commit</b>.
          </p>

          {opening.kind === 'seed' && (
            <div className="pm-ws-gesture-banner pm-ws-gesture-banner-seed">
              <Icon name="sparkle" size={13} />
              <span>
                <b>Recommended and prefilled by {opening.personaLabel}.</b> Everything here is
                editable — they set the table, you decide what commits.
              </span>
            </div>
          )}
          {opening.kind === 'clone' && (
            <div className="pm-ws-gesture-banner pm-ws-gesture-banner-clone">
              <Icon name="refresh" size={13} />
              <span>
                <b>Re-opened from a committed turn.</b> The old chip stays as history — committing
                again creates a <b>new</b> turn at the head. History is never rewritten.
              </span>
            </div>
          )}
          <WorkshopModalShell.CloseButton />
        </header>

        <div className="pm-ws-gesture-body">
          <label className="pm-ws-gesture-field">
            <span className="pm-ws-gesture-flabel">Target phrase</span>
            <input
              type="text"
              value={targetPhrase}
              maxLength={BUDGET.gestureTargetPhraseCharacters}
              disabled={locked}
              placeholder="e.g. she smiled"
              onChange={(event) => setTargetPhrase(event.target.value)}
            />
          </label>
          <label className="pm-ws-gesture-field">
            <span className="pm-ws-gesture-flabel">Surrounding context <i>optional</i></span>
            <textarea
              value={contextText}
              maxLength={BUDGET.gestureContextCharacters}
              disabled={locked}
              rows={3}
              placeholder="The sentences around the phrase."
              onChange={(event) => setContextText(event.target.value)}
            />
          </label>
          <label className="pm-ws-gesture-field">
            <span className="pm-ws-gesture-flabel">
              Character notes{' '}
              <i>{opening.kind === 'seed' && opening.seed.characterNotes ? `prefilled by ${opening.personaLabel}` : 'optional'}</i>
            </span>
            <textarea
              value={characterNotes}
              maxLength={BUDGET.gestureCharacterNotesCharacters}
              disabled={locked}
              rows={2}
              placeholder="Who is this person in this beat?"
              onChange={(event) => setCharacterNotes(event.target.value)}
            />
          </label>

          {generating ? (
            <button type="button" className="pm-ws-gesture-gen pm-ws-gesture-gen-busy" onClick={cancelGenerate}>
              One fast model call… (click to cancel)
            </button>
          ) : (
            <button
              type="button"
              className={`pm-ws-gesture-gen${menu ? ' pm-ws-gesture-gen-ghost' : ''}`}
              disabled={locked || targetPhrase.trim().length === 0}
              onClick={generate}
            >
              <Icon name={menu ? 'refresh' : 'sparkle'} size={13} />{' '}
              {menu ? 'Regenerate' : 'Generate alternatives'}
            </button>
          )}
          {!menu && !generating && (
            <div className="pm-ws-gesture-seam">
              deterministic scaffold · one model call, fast tier · commit never re-runs it
            </div>
          )}
          {generateError && <div className="pm-ws-gesture-error" role="alert">{generateError}</div>}

          {menu && (
            <div className="pm-ws-gesture-menu">
              {menu.map((group) => (
                <React.Fragment key={group.heading}>
                  <div className="pm-ws-gesture-mgh">
                    <span>{group.heading}</span>
                    <hr />
                  </div>
                  {group.options.map((option) => {
                    const selected = selections.includes(option);
                    return (
                      <button
                        key={option}
                        type="button"
                        className={`pm-ws-gesture-opt${selected ? ' pm-ws-gesture-opt-selected' : ''}`}
                        aria-pressed={selected}
                        disabled={locked}
                        onClick={() => toggleSelection(option)}
                      >
                        <span className="pm-ws-gesture-opt-bx" aria-hidden="true">
                          <Icon name="check" size={10} />
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </React.Fragment>
              ))}
              <label className="pm-ws-gesture-field">
                <span className="pm-ws-gesture-flabel">Optional note to the room</span>
                <input
                  type="text"
                  value={note}
                  maxLength={BUDGET.gestureNoteCharacters}
                  disabled={locked}
                  placeholder="e.g. keep it small"
                  onChange={(event) => setNote(event.target.value)}
                />
              </label>
            </div>
          )}

          {commitError && <div className="pm-ws-gesture-error" role="alert">{commitError}</div>}
        </div>

        <footer className="pm-ws-gesture-foot">
          <span className="pm-ws-gesture-fnote">
            {menu && <span className="pm-ws-gesture-count">{selections.length} selected · </span>}
            Pre-commit play is free — only the commit pays context.
          </span>
          <button type="button" className="pm-ws-gesture-cancel" disabled={locked} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="pm-ws-gesture-commit"
            disabled={locked || selections.length === 0}
            onClick={commit}
          >
            {commitPending
              ? 'Committing…'
              : opening.kind === 'clone'
                ? 'Commit as new turn'
                : 'Commit to thread'}
          </button>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
