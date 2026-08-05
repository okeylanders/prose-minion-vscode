/**
 * WorkshopGesturePlaygroundModal — the first Conversation Widget's pre-commit
 * surface (ADR 2026-07-22, Sprint 01; design Spread 01).
 *
 * The Draft is LOCAL until commit: Cancel/Esc discards it, Generate makes
 * one deliberate model call for a writer-facing Gesture Dictionary and a
 * grouped multi-select menu. More gestures extends that visible result through
 * a compact stateless call; Regenerate all re-rolls both; commit never re-runs
 * either. Commit posts the whole Draft to the atomic host route; the sheet
 * closes as soon as the host acknowledges that its writer turn and artifact
 * are room truth, without waiting for the participant's model response.
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
  WorkshopGesturePlaygroundGeneratePayload,
  WorkshopGesturePlaygroundGenerationProgressPayload,
  WorkshopGesturePlaygroundMenuResultPayload,
  WorkshopWidgetActionResultPayload,
  WorkshopWidgetSourceReference,
  workshopExcerptTitle
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ModelOption, ModelScope } from '@shared/types';
import { Icon } from '@components/shared/Icon';
import { MarkdownRenderer } from '@components/shared/MarkdownRenderer';
import { ModelSelector } from '@components/shared/ModelSelector';
import { WorkshopModalShell } from '@components/workshop/WorkshopModalShell';
import type {
  WorkshopGestureOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';

interface WorkshopGesturePlaygroundModalProps {
  open: boolean;
  opening: WorkshopGestureOpening;
  menuResult: WorkshopGesturePlaygroundMenuResultPayload | null;
  generationProgress: WorkshopGesturePlaygroundGenerationProgressPayload | null;
  actionResult: WorkshopWidgetActionResultPayload | null;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  onGenerate: (payload: WorkshopGesturePlaygroundGeneratePayload) => void;
  onCancelGenerate: (requestId: string) => void;
  onCommit: (draft: WorkshopGestureDraft, clonedFromConfigId?: string) => void;
  onConsumeActionResult: () => void;
  onCopyDictionary: (content: string) => void;
  onSaveDictionary: (content: string) => void;
  widgetModelOptions: ModelOption[];
  selectedWidgetModel: string;
  onWidgetModelChange: (modelId: string) => void;
  onOpenWidgetModelBrowser: () => void;
  roomRunActive: boolean;
  onClose: () => void;
}

let gestureTokenCounter = 0;
const mintToken = (): string => `gesture-${Date.now()}-${++gestureTokenCounter}`;

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

const sourceReferenceKey = (reference: WorkshopWidgetSourceReference): string =>
  reference.kind === 'active-excerpt'
    ? reference.kind
    : `${reference.kind}:${reference.attachmentId}`;

const stageLabels: Record<WorkshopGesturePlaygroundGenerationProgressPayload['stage'], string> = {
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
  onCopyDictionary,
  onSaveDictionary,
  widgetModelOptions,
  selectedWidgetModel,
  onWidgetModelChange,
  onOpenWidgetModelBrowser,
  roomRunActive,
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
  const [includeDictionaryInCommit, setIncludeDictionaryInCommit] =
    React.useState(false);
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
      setIncludeDictionaryInCommit(draft.includeDictionaryInCommit);
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
      setIncludeDictionaryInCommit(false);
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
      setIncludeDictionaryInCommit(false);
    }
    setGenerateToken(null);
    setGenerateError(null);
    setCommitPending(false);
    setCommitError(null);
    setModelBrowserOpen(false);
    /* Reseed on open only — `opening` is intentionally not a dependency, so a
       background snapshot refresh cannot clobber in-progress editing. */
  }, [open]);

  React.useEffect(() => {
    if (
      !commitPending
      || !actionResult
      || actionResult.action !== 'commit'
      || actionResult.widgetId !== 'gesture-playground'
    ) {
      return;
    }
    setCommitPending(false);
    onConsumeActionResult();
    if (actionResult.ok) {
      onClose();
    } else {
      setCommitError(
        actionResult.message ?? 'Gesture Playground did not reach the room. Your draft is still open.'
      );
    }
  }, [actionResult, commitPending, onClose, onConsumeActionResult]);

  /* Absorb the generate result for OUR in-flight token; stale tokens drop. */
  React.useEffect(() => {
    if (!open || !menuResult || menuResult.token !== generateToken) {
      return;
    }
    setGenerateToken(null);
    if (menuResult.mode === 'full') {
      setDictionaryMarkdown(menuResult.dictionaryMarkdown ?? '');
    }
    if (menuResult.ok && menuResult.menu) {
      if (menuResult.dictionaryMarkdown) {
        setDictionaryMarkdown(menuResult.dictionaryMarkdown);
      }
      setMenu(menuResult.menu);
      setSelections((current) =>
        current.filter((selection) =>
          menuResult.menu!.some((group) => group.options.includes(selection))
        )
      );
      setGenerateError(null);
    } else {
      if (menuResult.mode === 'full') {
        setMenu(undefined);
        setSelections([]);
      }
      setGenerateError(
        menuResult.menuError
        ?? menuResult.error
        ?? 'The menu could not be generated. Try again.'
      );
    }
  }, [open, menuResult, generateToken]);

  const generating = generateToken !== null;
  const interactionLocked = generating || commitPending;
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
  }, []);

  const changeDraftField = React.useCallback((
    setter: React.Dispatch<React.SetStateAction<string>>,
    value: string
  ) => {
    invalidateGeneratedArtifacts();
    setter(value);
  }, [invalidateGeneratedArtifacts]);

  const changeTargetPhrase = React.useCallback(
    (value: string) => changeDraftField(setTargetPhrase, value),
    [changeDraftField]
  );
  const changeWriterInstructions = React.useCallback(
    (value: string) => changeDraftField(setWriterInstructions, value),
    [changeDraftField]
  );
  const changeContextText = React.useCallback(
    (value: string) => changeDraftField(setContextText, value),
    [changeDraftField]
  );
  const changeCharacterNotes = React.useCallback(
    (value: string) => changeDraftField(setCharacterNotes, value),
    [changeDraftField]
  );

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

  const generateAll = React.useCallback(() => {
    if (
      interactionLocked
      || targetPhrase.trim().length === 0
      || hasUnavailableSelectedSources
    ) {
      return;
    }
    const token = mintToken();
    invalidateGeneratedArtifacts();
    setGenerateToken(token);
    setGenerateError(null);
    onGenerate({
      widgetId: 'gesture-playground',
      token,
      mode: 'full',
      targetPhrase,
      writerInstructions,
      contextText,
      characterNotes,
      sourceReferences
    });
  }, [
    interactionLocked,
    hasUnavailableSelectedSources,
    targetPhrase,
    writerInstructions,
    contextText,
    characterNotes,
    sourceReferences,
    invalidateGeneratedArtifacts,
    onGenerate
  ]);

  const generateMore = React.useCallback(() => {
    if (
      interactionLocked
      || !menu
      || dictionaryMarkdown.trim().length === 0
      || menu.every((group) => group.options.length >= BUDGET.gestureOptionsPerGroup)
    ) {
      return;
    }
    const token = mintToken();
    setGenerateToken(token);
    setGenerateError(null);
    onGenerate({
      widgetId: 'gesture-playground',
      token,
      mode: 'more',
      targetPhrase,
      writerInstructions,
      contextText,
      characterNotes,
      sourceReferences,
      dictionaryMarkdown,
      menu
    });
  }, [
    interactionLocked,
    menu,
    dictionaryMarkdown,
    targetPhrase,
    writerInstructions,
    contextText,
    characterNotes,
    sourceReferences,
    onGenerate
  ]);

  const cancelGenerate = React.useCallback(() => {
    setGenerateToken(null);
    if (generateToken) {
      onCancelGenerate(generateToken);
    }
  }, [generateToken, onCancelGenerate]);

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
      generating
      || commitPending
      || roomRunActive
      || !menu
      || dictionaryMarkdown.trim().length === 0
      || selections.length === 0
      || hasUnavailableSelectedSources
    ) {
      return;
    }
    setCommitError(null);
    setCommitPending(true);
    onConsumeActionResult();
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
        note,
        includeDictionaryInCommit
      },
      opening.kind === 'clone' ? opening.config.id : undefined
    );
  }, [
    generating,
    commitPending,
    roomRunActive,
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
    includeDictionaryInCommit,
    onCommit,
    onConsumeActionResult,
    opening
  ]);

  const close = React.useCallback(() => {
    // The model browser is layered over this sheet and owns the first Escape.
    // Keep the underlying draft open while that child overlay dismisses.
    if (modelBrowserOpen || commitPending) {
      return;
    }
    if (generating) {
      cancelGenerate();
    }
    onClose();
  }, [modelBrowserOpen, commitPending, generating, cancelGenerate, onClose]);

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

  const generationProgressPanel = generating ? (
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
  ) : null;

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
              disabled={interactionLocked}
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
              disabled={interactionLocked}
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
              disabled={interactionLocked}
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
              disabled={interactionLocked}
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
                        interactionLocked
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
                      disabled={interactionLocked}
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

          {!menu && (generating ? generationProgressPanel : (
            <button
              type="button"
              className="pm-ws-gesture-gen"
              disabled={
                targetPhrase.trim().length === 0
                || hasUnavailableSelectedSources
              }
              onClick={generateAll}
            >
              <Icon name="sparkle" size={13} /> Generate alternatives
            </button>
          ))}
          {!menu && !dictionaryMarkdown && !generating && (
            <div className="pm-ws-gesture-seam">
              one deliberate model call · craft scan + alternatives · commit never re-runs it
            </div>
          )}
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
                        disabled={interactionLocked}
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

          {menu && (generating ? generationProgressPanel : (
            <div className="pm-ws-gesture-generation-actions">
              <button
                type="button"
                className="pm-ws-gesture-gen"
                disabled={dictionaryMarkdown.trim().length === 0 || menu.every(
                  (group) => group.options.length >= BUDGET.gestureOptionsPerGroup
                )}
                onClick={generateMore}
              >
                <Icon name="sparkle" size={13} /> More gestures
              </button>
              <button
                type="button"
                className="pm-ws-gesture-gen pm-ws-gesture-gen-ghost"
                onClick={generateAll}
              >
                <Icon name="refresh" size={13} /> Regenerate all
              </button>
            </div>
          ))}

          {generateError && <div className="pm-ws-gesture-error" role="alert">{generateError}</div>}
          {commitError && <div className="pm-ws-gesture-error" role="alert">{commitError}</div>}

          {dictionaryMarkdown && (
            <div className="pm-ws-gesture-dictionary-shell">
              <details className="pm-ws-gesture-dictionary">
                <summary>
                  <span>Gesture Dictionary</span>
                  <small>The craft scan for this beat</small>
                </summary>
                <div className="pm-ws-gesture-dictionary-content">
                  <MarkdownRenderer content={dictionaryMarkdown} />
                </div>
              </details>
              <div className="pm-ws-gesture-dictionary-actions">
                <button
                  type="button"
                  title="Copy Gesture Dictionary"
                  aria-label="Copy Gesture Dictionary"
                  onClick={() => onCopyDictionary(dictionaryMarkdown)}
                >
                  <Icon name="copy" size={11} /> Copy
                </button>
                <button
                  type="button"
                  title="Save Gesture Dictionary"
                  aria-label="Save Gesture Dictionary"
                  onClick={() => onSaveDictionary(dictionaryMarkdown)}
                >
                  <Icon name="save" size={11} /> Save
                </button>
              </div>
            </div>
          )}

          {dictionaryMarkdown && (
            <label className="pm-ws-gesture-dictionary-share">
              <input
                type="checkbox"
                checked={includeDictionaryInCommit}
                disabled={interactionLocked}
                onChange={(event) => setIncludeDictionaryInCommit(event.target.checked)}
              />
              <span>
                <b>Include the full Gesture Dictionary for the room</b>
                <small>
                  Delivers it once to every host or guest when this room turn reaches them.
                </small>
              </span>
            </label>
          )}

          {menu && (
            <label className="pm-ws-gesture-field">
              <span className="pm-ws-gesture-flabel">Optional note to the room</span>
              <input
                type="text"
                value={note}
                maxLength={BUDGET.gestureNoteCharacters}
                placeholder="e.g. keep it small"
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
          )}

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
              disabled={interactionLocked}
            />
            {menu && (
              <span className="pm-ws-gesture-count">· {selections.length} selected</span>
            )}
          </div>
          <button
            type="button"
            className="pm-ws-gesture-cancel"
            disabled={commitPending}
            onClick={close}
          >
            Cancel
          </button>
          <button
            type="button"
            className="pm-ws-gesture-commit"
            disabled={
              generating
              || commitPending
              || roomRunActive
              || !menu
              || dictionaryMarkdown.trim().length === 0
              || selections.length === 0
              || hasUnavailableSelectedSources
            }
            onClick={commit}
          >
            {commitPending
              ? 'Committing…'
              : opening.kind === 'clone' ? 'Commit as new turn' : 'Commit to thread'}
          </button>
        </footer>
      </div>
    </WorkshopModalShell>
  );
};
