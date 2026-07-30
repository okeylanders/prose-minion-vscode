/**
 * WorkshopGesturePlaygroundModal — the first Conversation Widget's pre-commit
 * surface (ADR 2026-07-22, Sprint 01; design Spread 01).
 *
 * The Draft is LOCAL until commit: Cancel/Esc costs nothing, Generate makes
 * one deliberate model call for a writer-facing Gesture Dictionary and a
 * grouped multi-select menu (Regenerate re-rolls both; commit never re-runs
 * it), and Commit posts the whole Draft to the atomic host route. The modal
 * freezes while the commit is in flight and closes only on the host's ok —
 * the PendingApply posture of
 * WorkshopConversationBehaviorModal, adapted to the widget action result.
 *
 * Three openings: fresh (from the Widgets browser), persona seed (recommend +
 * prefill — everything editable), and clone (re-opened from a committed
 * turn's chip: the exact prior Draft, committing mints a NEW turn; history is
 * never rewritten).
 */

import * as React from 'react';
import {
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopGestureDraft,
  WorkshopGestureMenuGroup,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetConfigSnapshot,
  WorkshopWidgetGeneratePayload,
  WorkshopWidgetGenerationProgressPayload,
  WorkshopWidgetMenuResultPayload,
  WorkshopWidgetRecommendationSeed,
  WorkshopWidgetSourceReference,
  workshopExcerptTitle
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { ModelSelector } from '@components/shared/ModelSelector';
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
  generationProgress: WorkshopWidgetGenerationProgressPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  onGenerate: (payload: WorkshopWidgetGeneratePayload) => void;
  onCancelGenerate: () => void;
  onCommit: (draft: WorkshopGestureDraft, clonedFromConfigId?: string) => void;
  onConsumeActionResult: () => void;
  widgetModelOptions: ModelOption[];
  selectedWidgetModel: string;
  onWidgetModelChange: (modelId: string) => void;
  onOpenWidgetModelBrowser: () => void;
  onClose: () => void;
}

let gestureTokenCounter = 0;
const mintToken = (): string => `gesture-${Date.now()}-${++gestureTokenCounter}`;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

const sourceReferenceKey = (reference: WorkshopWidgetSourceReference): string =>
  reference.kind === 'active-excerpt'
    ? reference.kind
    : `${reference.kind}:${reference.attachmentId}`;

const stageLabels: Record<WorkshopWidgetGenerationProgressPayload['stage'], string> = {
  requesting: 'Preparing the request',
  dictionary: 'Building the gesture dictionary',
  menu: 'Building creative alternatives',
  validating: 'Validating the craft scan'
};

export const WorkshopGesturePlaygroundModal: React.FC<WorkshopGesturePlaygroundModalProps> = ({
  open,
  opening,
  menuResult,
  generationProgress,
  actionResult,
  activeExcerpt,
  contextAttachments,
  onGenerate,
  onCancelGenerate,
  onCommit,
  onConsumeActionResult,
  widgetModelOptions,
  selectedWidgetModel,
  onWidgetModelChange,
  onOpenWidgetModelBrowser,
  onClose
}) => {
  const [targetPhrase, setTargetPhrase] = React.useState('');
  const [writerInstructions, setWriterInstructions] = React.useState('');
  const [contextText, setContextText] = React.useState('');
  const [characterNotes, setCharacterNotes] = React.useState('');
  const [sourceReferences, setSourceReferences] = React.useState<WorkshopWidgetSourceReference[]>([]);
  const [note, setNote] = React.useState('');
  const [menu, setMenu] = React.useState<WorkshopGestureMenuGroup[] | undefined>(undefined);
  const [dictionaryMarkdown, setDictionaryMarkdown] = React.useState('');
  const [selections, setSelections] = React.useState<string[]>([]);
  const [generateToken, setGenerateToken] = React.useState<string | null>(null);
  const [generateError, setGenerateError] = React.useState<string | null>(null);
  const [commitPending, setCommitPending] = React.useState(false);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const [modelBrowserOpen, setModelBrowserOpen] = React.useState(false);

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
      setWriterInstructions(draft.writerInstructions);
      setContextText(draft.contextText);
      setCharacterNotes(draft.characterNotes);
      setSourceReferences(draft.sourceReferences.map((reference) => ({ ...reference })));
      setNote(draft.note);
      setMenu(draft.menu.map((group) => ({ ...group, options: [...group.options] })));
      setDictionaryMarkdown(draft.dictionaryMarkdown);
      setSelections([...draft.selections]);
    } else if (opening.kind === 'seed') {
      setTargetPhrase(opening.seed.targetPhrase ?? '');
      setWriterInstructions(opening.seed.writerInstructions ?? '');
      setContextText(opening.seed.contextText ?? '');
      setCharacterNotes(opening.seed.characterNotes ?? '');
      setSourceReferences(
        (opening.seed.sourceReferences ?? []).map((reference) => ({ ...reference }))
      );
      // The post-selection note belongs to the writer, never the recommending persona.
      setNote('');
      setMenu(undefined);
      setDictionaryMarkdown('');
      setSelections([]);
    } else {
      setTargetPhrase(opening.seedTargetPhrase ?? '');
      setWriterInstructions('');
      setContextText('');
      setCharacterNotes('');
      setSourceReferences([]);
      setNote('');
      setMenu(undefined);
      setDictionaryMarkdown('');
      setSelections([]);
    }
    setGenerateToken(null);
    setGenerateError(null);
    setCommitPending(false);
    setCommitError(null);
    setModelBrowserOpen(false);
    /* Reseed on open only — `opening` is intentionally not a dependency, so a
       background snapshot refresh cannot clobber in-progress editing. */
  }, [open]);

  /* Absorb the generate result for OUR in-flight token; stale tokens drop. */
  React.useEffect(() => {
    if (!open || !menuResult || menuResult.token !== generateToken) {
      return;
    }
    setGenerateToken(null);
    setDictionaryMarkdown(menuResult.dictionaryMarkdown ?? '');
    if (menuResult.ok && menuResult.menu) {
      setMenu(menuResult.menu);
      setSelections((current) =>
        current.filter((selection) =>
          menuResult.menu!.some((group) => group.options.includes(selection))
        )
      );
      setGenerateError(null);
    } else {
      setMenu(undefined);
      setSelections([]);
      setGenerateError(
        menuResult.menuError
        ?? menuResult.error
        ?? 'The menu could not be generated. Try again.'
      );
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
  const visibleProgress =
    generationProgress?.token === generateToken ? generationProgress : null;
  const progressStage = stageLabels[visibleProgress?.stage ?? 'requesting'];
  const estimatedVisibleTokens = visibleProgress?.estimatedOutputTokens ?? 0;

  const availableSources = React.useMemo(() => {
    const sources: Array<{
      reference: WorkshopWidgetSourceReference;
      label: string;
      detail: string;
    }> = [];
    if (activeExcerpt) {
      const words = activeExcerpt.text.trim().length === 0
        ? 0
        : activeExcerpt.text.trim().split(/\s+/).length;
      sources.push({
        reference: { kind: 'active-excerpt' },
        label: `Active excerpt — ${workshopExcerptTitle(activeExcerpt.source)}`,
        detail: `${words.toLocaleString()} words`
      });
    }
    contextAttachments.forEach((attachment) => {
      sources.push({
        reference: { kind: 'context-attachment', attachmentId: attachment.id },
        label: `Context — ${attachment.label}`,
        detail: [
          `${attachment.words.toLocaleString()} words`,
          attachment.relativePath
        ].filter(Boolean).join(' · ')
      });
    });
    return sources;
  }, [activeExcerpt, contextAttachments]);

  const availableSourceKeys = React.useMemo(
    () => new Set(availableSources.map(({ reference }) => sourceReferenceKey(reference))),
    [availableSources]
  );
  const unavailableSelectedSources = sourceReferences.filter(
    (reference) => !availableSourceKeys.has(sourceReferenceKey(reference))
  );
  const hasUnavailableSelectedSources = unavailableSelectedSources.length > 0;
  const sourceSelectionAtLimit =
    sourceReferences.length >= BUDGET.gestureSourceReferences;

  const invalidateGeneratedArtifacts = React.useCallback(() => {
    setMenu(undefined);
    setDictionaryMarkdown('');
    setSelections([]);
    setGenerateError(null);
    setCommitError(null);
  }, []);

  const changeTargetPhrase = React.useCallback((value: string) => {
    invalidateGeneratedArtifacts();
    setTargetPhrase(value);
  }, [invalidateGeneratedArtifacts]);

  const changeWriterInstructions = React.useCallback((value: string) => {
    invalidateGeneratedArtifacts();
    setWriterInstructions(value);
  }, [invalidateGeneratedArtifacts]);

  const changeContextText = React.useCallback((value: string) => {
    invalidateGeneratedArtifacts();
    setContextText(value);
  }, [invalidateGeneratedArtifacts]);

  const changeCharacterNotes = React.useCallback((value: string) => {
    invalidateGeneratedArtifacts();
    setCharacterNotes(value);
  }, [invalidateGeneratedArtifacts]);

  const toggleSourceReference = React.useCallback(
    (reference: WorkshopWidgetSourceReference) => {
      invalidateGeneratedArtifacts();
      const key = sourceReferenceKey(reference);
      setSourceReferences((current) => {
        const selected = current.some(
          (candidate) => sourceReferenceKey(candidate) === key
        );
        if (selected) {
          return current.filter((candidate) => sourceReferenceKey(candidate) !== key);
        }
        return current.length < BUDGET.gestureSourceReferences
          ? [...current, reference]
          : current;
      });
    },
    [invalidateGeneratedArtifacts]
  );

  const generate = React.useCallback(() => {
    if (
      generating
      || locked
      || targetPhrase.trim().length === 0
      || hasUnavailableSelectedSources
    ) {
      return;
    }
    const token = mintToken();
    setGenerateToken(token);
    setGenerateError(null);
    onGenerate({
      widgetId: 'gesture-playground',
      token,
      targetPhrase,
      writerInstructions,
      contextText,
      characterNotes,
      sourceReferences
    });
  }, [
    generating,
    locked,
    hasUnavailableSelectedSources,
    targetPhrase,
    writerInstructions,
    contextText,
    characterNotes,
    sourceReferences,
    onGenerate
  ]);

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
    if (
      locked
      || generating
      || !menu
      || dictionaryMarkdown.trim().length === 0
      || selections.length === 0
      || hasUnavailableSelectedSources
    ) {
      return;
    }
    setCommitPending(true);
    setCommitError(null);
    onCommit(
      {
        targetPhrase,
        writerInstructions,
        contextText,
        characterNotes,
        sourceReferences,
        dictionaryMarkdown,
        menu,
        selections,
        note
      },
      opening.kind === 'clone' ? opening.config.id : undefined
    );
  }, [
    locked,
    generating,
    menu,
    selections,
    hasUnavailableSelectedSources,
    targetPhrase,
    writerInstructions,
    contextText,
    characterNotes,
    sourceReferences,
    dictionaryMarkdown,
    note,
    onCommit,
    opening
  ]);

  const close = React.useCallback(() => {
    // The model browser is layered over this sheet and owns the first Escape.
    // Keep the underlying draft open while that child overlay dismisses.
    if (modelBrowserOpen) {
      return;
    }
    if (generating) {
      cancelGenerate();
    }
    onClose();
  }, [modelBrowserOpen, generating, cancelGenerate, onClose]);

  const changeWidgetModel = React.useCallback(
    (_scope: ModelScope, modelId: string) => {
      if (modelId === selectedWidgetModel) {
        return;
      }
      invalidateGeneratedArtifacts();
      onWidgetModelChange(modelId);
    },
    [selectedWidgetModel, invalidateGeneratedArtifacts, onWidgetModelChange]
  );

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
            A craft scan and creative menu for one beat. Play freely —{' '}
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
              disabled={locked || generating}
              placeholder="e.g. she smiled"
              onChange={(event) => changeTargetPhrase(event.target.value)}
            />
          </label>
          <label className="pm-ws-gesture-field">
            <span className="pm-ws-gesture-flabel">
              Writer instructions{' '}
              <i>
                {opening.kind === 'seed' && opening.seed.writerInstructions
                  ? `prefilled by ${opening.personaLabel}`
                  : 'optional'}
              </i>
            </span>
            <textarea
              value={writerInstructions}
              maxLength={BUDGET.gestureWriterInstructionsCharacters}
              disabled={locked || generating}
              rows={3}
              placeholder="What should the alternatives preserve, avoid, or emphasize?"
              onChange={(event) => changeWriterInstructions(event.target.value)}
            />
          </label>
          <label className="pm-ws-gesture-field">
            <span className="pm-ws-gesture-flabel">
              Surrounding context{' '}
              <i>
                {opening.kind === 'seed' && opening.seed.contextText
                  ? `prefilled by ${opening.personaLabel}`
                  : 'optional'}
              </i>
            </span>
            <textarea
              value={contextText}
              maxLength={BUDGET.gestureContextCharacters}
              disabled={locked || generating}
              rows={3}
              placeholder="The sentences around the phrase."
              onChange={(event) => changeContextText(event.target.value)}
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
              disabled={locked || generating}
              rows={2}
              placeholder="Who is this person in this beat?"
              onChange={(event) => changeCharacterNotes(event.target.value)}
            />
          </label>

          <fieldset className="pm-ws-gesture-sources">
            <legend className="pm-ws-gesture-flabel">
              Source material{' '}
              <i>
                {opening.kind === 'seed' && (opening.seed.sourceReferences?.length ?? 0) > 0
                  ? `prefilled by ${opening.personaLabel}`
                  : 'optional'}
              </i>
            </legend>
            <p>
              Writer instructions and surrounding context still ride with the request. Selected
              sources add their full host-owned text without asking anyone to copy it here.
            </p>
            <span className="pm-ws-gesture-source-limit">
              {sourceReferences.length}/{BUDGET.gestureSourceReferences} sources selected
              {sourceSelectionAtLimit ? ' · maximum reached' : ''}
            </span>
            <div className="pm-ws-gesture-source-list">
              {availableSources.map(({ reference, label, detail }) => {
                const key = sourceReferenceKey(reference);
                const selected = sourceReferences.some(
                  (candidate) => sourceReferenceKey(candidate) === key
                );
                return (
                  <label className="pm-ws-gesture-source" key={key}>
                    <input
                      type="checkbox"
                      checked={selected}
                      disabled={
                        locked
                        || generating
                        || (!selected && sourceSelectionAtLimit)
                      }
                      onChange={() => toggleSourceReference(reference)}
                    />
                    <span>
                      <b>{label}</b>
                      <small>{detail}</small>
                    </span>
                  </label>
                );
              })}
              {unavailableSelectedSources.map((reference) => {
                const key = sourceReferenceKey(reference);
                const label = reference.kind === 'active-excerpt'
                  ? 'Active excerpt — unavailable'
                  : `Context attachment ${reference.attachmentId} — unavailable`;
                return (
                  <label
                    className="pm-ws-gesture-source pm-ws-gesture-source-unavailable"
                    key={key}
                  >
                    <input
                      type="checkbox"
                      checked
                      disabled={locked || generating}
                      onChange={() => toggleSourceReference(reference)}
                    />
                    <span>
                      <b>{label}</b>
                      <small>Remove this reference before generating again.</small>
                    </span>
                  </label>
                );
              })}
              {availableSources.length === 0 && unavailableSelectedSources.length === 0 && (
                <span className="pm-ws-gesture-source-empty">
                  No active excerpt or standing context is available in this room.
                </span>
              )}
            </div>
          </fieldset>

          {generating ? (
            <div className="pm-ws-gesture-progress">
              <div className="pm-ws-gesture-progress-copy" role="status" aria-live="polite">
                <span>{progressStage}…</span>
                <strong>
                  ~{estimatedVisibleTokens.toLocaleString()} estimated visible tokens
                </strong>
              </div>
              <div
                className="pm-ws-gesture-progress-track"
                role="progressbar"
                aria-label="Gesture generation in progress"
                aria-valuetext={`${progressStage}; approximately ${estimatedVisibleTokens.toLocaleString()} estimated visible tokens`}
              >
                <span />
              </div>
              <button type="button" onClick={cancelGenerate}>
                Cancel generation
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`pm-ws-gesture-gen${menu || dictionaryMarkdown ? ' pm-ws-gesture-gen-ghost' : ''}`}
              disabled={
                locked
                || targetPhrase.trim().length === 0
                || hasUnavailableSelectedSources
              }
              onClick={generate}
            >
              <Icon name={menu || dictionaryMarkdown ? 'refresh' : 'sparkle'} size={13} />{' '}
              {menu || dictionaryMarkdown ? 'Regenerate' : 'Generate alternatives'}
            </button>
          )}
          {!menu && !dictionaryMarkdown && !generating && (
            <div className="pm-ws-gesture-seam">
              one deliberate model call · craft scan + alternatives · commit never re-runs it
            </div>
          )}
          {generateError && <div className="pm-ws-gesture-error" role="alert">{generateError}</div>}

          {menu && (
            <div className="pm-ws-gesture-menu">
              {menu.map((group, groupIndex) => (
                <React.Fragment key={`${groupIndex}-${group.heading}`}>
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
                        disabled={locked || generating}
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
            </div>
          )}

          {dictionaryMarkdown && (
            <details className="pm-ws-gesture-dictionary">
              <summary>
                <span>Gesture Dictionary</span>
                <small>The craft scan for this beat</small>
              </summary>
              <div className="pm-ws-gesture-dictionary-content">
                <MarkdownRenderer content={dictionaryMarkdown} />
              </div>
            </details>
          )}

          {menu && (
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
          )}

          {commitError && <div className="pm-ws-gesture-error" role="alert">{commitError}</div>}
        </div>

        <footer className="pm-ws-gesture-foot">
          <div className="pm-ws-gesture-model">
            <ModelSelector
              scope="widget"
              options={widgetModelOptions}
              value={selectedWidgetModel}
              onChange={changeWidgetModel}
              onOpenBrowser={onOpenWidgetModelBrowser}
              onBrowserOpenChange={setModelBrowserOpen}
              label="Widget Model"
              disabled={locked || generating}
            />
            {menu && (
              <span className="pm-ws-gesture-count">· {selections.length} selected</span>
            )}
          </div>
          <button type="button" className="pm-ws-gesture-cancel" disabled={locked} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className="pm-ws-gesture-commit"
            disabled={
              locked
              || generating
              || !menu
              || dictionaryMarkdown.trim().length === 0
              || selections.length === 0
              || hasUnavailableSelectedSources
            }
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
