/**
 * Transient Show vs. Tell authoring state machine (Sprint 05, Slice 3).
 *
 * Transport-free by contract: host effects arrive as injected callbacks, and
 * this file owns no webview API handle, message-type enum, or message posting.
 *
 * The rule that shapes everything here: every generation input EXCEPT the
 * continuum position invalidates the workup and clears kept variants and
 * carry modes. The position re-weighs the readout and changes what commits,
 * but keeps the workup and the kept variants.
 */

import * as React from 'react';
import type {
  SelectionDataMessage,
  WorkshopContextAttachmentSnapshot,
  WorkshopExcerptSnapshot,
  WorkshopShowVsTellCarryMode,
  WorkshopShowVsTellChannel,
  WorkshopShowVsTellDraft,
  WorkshopShowVsTellGenerationProgressPayload,
  WorkshopShowVsTellLengthBudget,
  WorkshopShowVsTellPovMode,
  WorkshopShowVsTellResultPayload,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { NarrativeHandlingPosition } from '@shared/constants/narrativeHandlingVocabulary';
import {
  showVsTellSourceReferenceKey,
  type ShowVsTellGenerationInput
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import type {
  ShowVsTellArtifactUsage,
  ShowVsTellAvailableSource,
  ShowVsTellCommitBlocker,
  ShowVsTellGenerateBlocker,
  ShowVsTellGenerationPhase
} from '@components/workshop/widgets/showVsTell/showVsTellAuthoringTypes';
import type {
  WorkshopShowVsTellOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import {
  beatFromSelection,
  beatWithEditedText,
  changedWorkNotice,
  collapseShowVsTellLineBreaks,
  createShowVsTellAuthoringDraft,
  deriveShowVsTellAvailableSources,
  deriveShowVsTellCommitBlockers,
  deriveShowVsTellGenerateBlockers,
  generationDetail,
  hasSettledWork,
  projectShowVsTellArtifact,
  sameBeat,
  toggledShowVsTellChannels,
  toggledShowVsTellKeep,
  withShowVsTellCarryMode,
  withShowVsTellPovMode,
  withShowVsTellSourceReference,
  type ShowVsTellInputLabel
} from './showVsTellAuthoringRules';
import { useShowVsTellInvalidationWatch } from './useShowVsTellInvalidationWatch';
import {
  useShowVsTellCommitFlow,
  type ShowVsTellCommitOutcome
} from './useShowVsTellCommitFlow';

// The rule helpers live beside this owner; these two are part of its public face.
export { collapseShowVsTellLineBreaks, createShowVsTellAuthoringDraft };

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export interface UseShowVsTellAuthoringOptions {
  opening: WorkshopShowVsTellOpening | null;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /**
   * Host revision of what the room's source references resolve to (room
   * generation, context revision, excerpt version). A change while the sheet
   * is open cancels and discards an in-flight reply, and clears a settled
   * workup, when a source reference grounded them: they no longer describe the
   * room the writer is looking at.
   */
  roomKey: string;
  /** Host-owned effective widget model; changes invalidate dependent transient work. */
  widgetModelId: string;
  generationProgress: WorkshopShowVsTellGenerationProgressPayload | null;
  generationResult: WorkshopShowVsTellResultPayload | null;
  requestBeatSelection: () => void;
  generate: (input: ShowVsTellGenerationInput) => string;
  cancelGeneration: (token?: string) => void;
  /** Host truth about the room, so Commit explains why it is unavailable. */
  roomRunActive: boolean;
  toolTargetActive: boolean;
  commitPending: boolean;
  commitOutcome: ShowVsTellCommitOutcome | null;
  commit: (draft: WorkshopShowVsTellDraft, clonedFromConfigId?: string) => void;
  clearCommitResult: () => void;
  resetCommitState: () => void;
  onCommitAccepted: () => void;
}

export interface ShowVsTellAuthoringState {
  draft: WorkshopShowVsTellDraft;
  generation: ShowVsTellGenerationPhase;
  invalidationNotice: string | null;
  /** Visible explanation when intake had to shorten a selection into a beat. */
  intakeNotice: string | null;
  /** The host's refusal or a transport failure; the exact draft stays open. */
  commitError: string | null;
  generateBlockers: readonly ShowVsTellGenerateBlocker[];
  commitBlockers: readonly ShowVsTellCommitBlocker[];
  /** The exact counted artifact body; null until a variant is kept. */
  artifactUsage: ShowVsTellArtifactUsage | null;
  availableSources: readonly ShowVsTellAvailableSource[];
}

export interface ShowVsTellAuthoringActions {
  requestBeatSelection: () => void;
  handleBeatSelection: (message: SelectionDataMessage) => void;
  changeBeatText: (text: string) => void;
  selectSourceReference: (reference: WorkshopWidgetSourceReference | null) => void;
  changePovMode: (mode: WorkshopShowVsTellPovMode) => void;
  changePovFocalCharacter: (text: string) => void;
  changeMustSurvive: (text: string) => void;
  changeMustNotChange: (text: string) => void;
  toggleChannel: (channel: WorkshopShowVsTellChannel) => void;
  changeLengthBudget: (budget: WorkshopShowVsTellLengthBudget) => void;
  changePosition: (position: NarrativeHandlingPosition) => void;
  generateWorkup: () => void;
  cancelGenerate: () => void;
  toggleKeep: (variantId: string) => void;
  changeCarryMode: (variantId: string, mode: WorkshopShowVsTellCarryMode) => void;
  changeNote: (note: string) => void;
  commitDraft: () => void;
}

/** Explicitly empty: the host owns durable truth, and this controller is transient. */
export interface ShowVsTellAuthoringPersistence {
  // The host owns persisted widget configuration; this controller is transient.
}

export type UseShowVsTellAuthoringReturn = ShowVsTellAuthoringState &
  ShowVsTellAuthoringActions & {
    persistedState: ShowVsTellAuthoringPersistence;
  };

export function useShowVsTellAuthoring({
  opening,
  activeExcerpt,
  contextAttachments,
  roomKey,
  widgetModelId,
  generationProgress,
  generationResult,
  requestBeatSelection,
  generate,
  cancelGeneration,
  roomRunActive,
  toolTargetActive,
  commitPending,
  commitOutcome,
  commit,
  clearCommitResult,
  resetCommitState,
  onCommitAccepted
}: UseShowVsTellAuthoringOptions): UseShowVsTellAuthoringReturn {
  const open = opening !== null;
  const [draft, setDraftState] = React.useState<WorkshopShowVsTellDraft>(
    createShowVsTellAuthoringDraft
  );
  const draftRef = React.useRef(draft);
  const setDraft = React.useCallback((
    update: WorkshopShowVsTellDraft | ((current: WorkshopShowVsTellDraft) => WorkshopShowVsTellDraft)
  ) => {
    const next = typeof update === 'function' ? update(draftRef.current) : update;
    draftRef.current = next;
    setDraftState(next);
  }, []);
  const [generation, setGeneration] = React.useState<ShowVsTellGenerationPhase>({ kind: 'idle' });
  const [invalidationNotice, setInvalidationNotice] = React.useState<string | null>(null);
  const [intakeNotice, setIntakeNotice] = React.useState<string | null>(null);
  const activeTokenRef = React.useRef<string>();
  const wasOpenRef = React.useRef(false);
  /**
   * While a commit is pending the draft is what was submitted. Every
   * writer-driven edit and every late intake reply is refused, so a refusal
   * leaves the exact draft to retry and a success discards nothing visible.
   */
  const commitPendingRef = React.useRef(commitPending);
  commitPendingRef.current = commitPending;
  const editDraft = React.useCallback((
    update: (current: WorkshopShowVsTellDraft) => WorkshopShowVsTellDraft
  ) => {
    if (!commitPendingRef.current) {
      setDraft(update);
    }
  }, [setDraft]);
  /** Set only when the sheet opened from a committed config; recommit records it as lineage. */
  const seededCloneConfigIdRef = React.useRef<string>();
  const commitFlow = useShowVsTellCommitFlow({
    open,
    commitOutcome,
    commit,
    clearCommitResult,
    resetCommitState,
    onCommitAccepted
  });

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      activeTokenRef.current = undefined;
      // The one place a draft is seeded: a chip reopens the exact committed
      // draft, anything else starts fresh.
      seededCloneConfigIdRef.current = opening?.kind === 'clone' ? opening.config.id : undefined;
      setDraft(opening?.kind === 'clone' ? opening.config.draft : createShowVsTellAuthoringDraft());
      setGeneration({ kind: 'idle' });
      setInvalidationNotice(null);
      setIntakeNotice(null);
    } else if (!open && wasOpenRef.current) {
      // Closing discards any reply still in flight: its token is no longer ours.
      activeTokenRef.current = undefined;
      seededCloneConfigIdRef.current = undefined;
    }
    wasOpenRef.current = open;
  }, [open, opening, setDraft]);

  React.useEffect(() => {
    const token = activeTokenRef.current;
    if (!open || !token || generationProgress?.token !== token) {
      return;
    }
    if (generationProgress.phase === 'cancelled') {
      activeTokenRef.current = undefined;
      setGeneration({ kind: 'idle' });
      return;
    }
    setGeneration({ kind: 'generating', detail: generationDetail(generationProgress) });
  }, [generationProgress, open]);

  React.useEffect(() => {
    const token = activeTokenRef.current;
    if (!open || !token || generationResult?.token !== token) {
      return;
    }
    activeTokenRef.current = undefined;
    if (generationResult.ok) {
      // Kept variants were already cleared when this attempt started; a new
      // workup has new cards, so none of them can be kept yet.
      setDraft((current) => ({ ...current, workup: generationResult.workup, kept: [] }));
      setGeneration({ kind: 'idle' });
      setInvalidationNotice(null);
    } else {
      setGeneration({ kind: 'failed', message: generationResult.error });
    }
  }, [generationResult, open, setDraft]);

  const cancelActiveGeneration = React.useCallback(() => {
    const token = activeTokenRef.current;
    if (token) {
      cancelGeneration(token);
      activeTokenRef.current = undefined;
    }
    setGeneration({ kind: 'idle' });
  }, [cancelGeneration]);

  /**
   * Every generation input flows through here. It cancels an in-flight
   * attempt, drops the workup, and clears kept variants and carry modes in the
   * same state update, so no card from the old workup can outlive its inputs.
   */
  const updateGenerationInput = React.useCallback((
    label: ShowVsTellInputLabel,
    update: (current: WorkshopShowVsTellDraft) => WorkshopShowVsTellDraft
  ) => {
    const current = draftRef.current;
    const next = update(current);
    if (next === current || commitPendingRef.current) {
      return;
    }
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadWork = hasSettledWork(current);
    cancelActiveGeneration();
    setDraft({ ...next, workup: null, kept: [] });
    const notice = changedWorkNotice(label, hadActiveGeneration, hadWork);
    if (notice) {
      setInvalidationNotice(notice);
    }
  }, [cancelActiveGeneration, setDraft]);

  const handleBeatSelection = React.useCallback((message: SelectionDataMessage) => {
    /* Normal delivery is target-routed; retain the check for direct hook consumers. */
    if (!open || activeTokenRef.current !== undefined || commitPendingRef.current
      || message.payload.target !== 'workshop_show_vs_tell_beat') {
      return;
    }
    const { beat, notice } = beatFromSelection(message.payload);
    setIntakeNotice(notice);
    updateGenerationInput('beat', (current) => sameBeat(beat, current.beat)
      ? current
      : { ...current, beat });
  }, [open, updateGenerationInput]);

  const changeBeatText = React.useCallback((raw: string) => {
    const text = collapseShowVsTellLineBreaks(raw).slice(0, BUDGET.showVsTellBeatCharacters);
    setIntakeNotice(null);
    updateGenerationInput('beat', (current) => {
      if (text === current.beat.text) {
        return current;
      }
      return { ...current, beat: beatWithEditedText(current.beat, text) };
    });
  }, [updateGenerationInput]);

  const selectSourceReference = React.useCallback((
    reference: WorkshopWidgetSourceReference | null
  ) => {
    updateGenerationInput('surrounding passage source', (current) =>
      withShowVsTellSourceReference(current, reference));
  }, [updateGenerationInput]);

  const changePovMode = React.useCallback((mode: WorkshopShowVsTellPovMode) => {
    updateGenerationInput('point of view', (current) => withShowVsTellPovMode(current, mode));
  }, [updateGenerationInput]);

  const changePovFocalCharacter = React.useCallback((raw: string) => {
    const focalCharacter = collapseShowVsTellLineBreaks(raw)
      .slice(0, BUDGET.showVsTellPovFocalCharacterCharacters);
    updateGenerationInput('point of view', (current) =>
      current.pov.mode === 'unspecified' || focalCharacter === current.pov.focalCharacter
        ? current
        : { ...current, pov: { ...current.pov, focalCharacter } });
  }, [updateGenerationInput]);

  const changeMustSurvive = React.useCallback((raw: string) => {
    const mustSurvive = raw.slice(0, BUDGET.showVsTellMustSurviveCharacters);
    updateGenerationInput('“Must survive” constraint', (current) =>
      mustSurvive === current.invariants.mustSurvive
        ? current
        : { ...current, invariants: { ...current.invariants, mustSurvive } });
  }, [updateGenerationInput]);

  const changeMustNotChange = React.useCallback((raw: string) => {
    const mustNotChange = raw.slice(0, BUDGET.showVsTellMustNotChangeCharacters);
    updateGenerationInput('“Must not change” constraint', (current) =>
      mustNotChange === current.invariants.mustNotChange
        ? current
        : { ...current, invariants: { ...current.invariants, mustNotChange } });
  }, [updateGenerationInput]);

  const toggleChannel = React.useCallback((channel: WorkshopShowVsTellChannel) => {
    updateGenerationInput('channels', (current) => {
      const channels = toggledShowVsTellChannels(current.channels, channel);
      return channels === current.channels ? current : { ...current, channels };
    });
  }, [updateGenerationInput]);

  const changeLengthBudget = React.useCallback((lengthBudget: WorkshopShowVsTellLengthBudget) => {
    updateGenerationInput('length budget', (current) => lengthBudget === current.lengthBudget
      ? current
      : { ...current, lengthBudget });
  }, [updateGenerationInput]);

  /**
   * The one exception: moving the position keeps the workup, the kept
   * variants, and any attempt. It is still refused while a commit is pending.
   */
  const changePosition = React.useCallback((position: NarrativeHandlingPosition) => {
    if (position !== draftRef.current.position) {
      editDraft((current) => ({ ...current, position }));
    }
  }, [editDraft]);

  const clearSettledWork = React.useCallback(
    (current: WorkshopShowVsTellDraft) => setDraft({ ...current, workup: null, kept: [] }),
    [setDraft]
  );
  useShowVsTellInvalidationWatch({
    open,
    widgetModelId,
    roomKey,
    draftRef,
    activeTokenRef,
    cancelActiveGeneration,
    clearSettledWork,
    setInvalidationNotice
  });

  const availableSources = React.useMemo(
    () => deriveShowVsTellAvailableSources(activeExcerpt, contextAttachments),
    [activeExcerpt, contextAttachments]
  );

  const generateBlockers = React.useMemo(
    () => deriveShowVsTellGenerateBlockers(draft, availableSources),
    [availableSources, draft]
  );

  const generateWorkup = React.useCallback(() => {
    const current = draftRef.current;
    if (generateBlockers.length > 0 || commitPendingRef.current) {
      return;
    }
    cancelActiveGeneration();
    // Regenerating clears kept variants and carry modes before any new card settles.
    setDraft({ ...current, workup: null, kept: [] });
    setInvalidationNotice(null);
    activeTokenRef.current = generate({
      beat: current.beat,
      surroundingContext: current.surroundingContext,
      pov: current.pov,
      invariants: current.invariants,
      channels: current.channels,
      lengthBudget: current.lengthBudget,
      position: current.position
    });
    setGeneration({ kind: 'generating', detail: 'Requesting the workup' });
  }, [cancelActiveGeneration, generate, generateBlockers.length, setDraft]);

  const cancelGenerate = React.useCallback(() => {
    cancelActiveGeneration();
  }, [cancelActiveGeneration]);

  const toggleKeep = React.useCallback((variantId: string) => {
    editDraft((current) => toggledShowVsTellKeep(current, variantId));
  }, [editDraft]);

  const changeCarryMode = React.useCallback((
    variantId: string,
    carryMode: WorkshopShowVsTellCarryMode
  ) => {
    editDraft((current) => withShowVsTellCarryMode(current, variantId, carryMode));
  }, [editDraft]);

  const changeNote = React.useCallback((raw: string) => {
    const note = collapseShowVsTellLineBreaks(raw).slice(0, BUDGET.showVsTellNoteCharacters);
    editDraft((current) => note === current.note ? current : { ...current, note });
  }, [editDraft]);

  const artifactProjection = React.useMemo(() => projectShowVsTellArtifact(draft), [draft]);
  const artifactUsage = artifactProjection.usage;

  React.useEffect(() => {
    if (artifactProjection.error !== null) {
      console.warn('[ShowVsTell] Could not compile artifact usage', artifactProjection.error);
    }
  }, [artifactProjection.error]);

  const commitBlockers = React.useMemo(
    () => deriveShowVsTellCommitBlockers({
      generating: generation.kind === 'generating',
      commitPending,
      roomRunActive,
      toolTargetActive,
      draft
    }),
    [commitPending, draft, generation.kind, roomRunActive, toolTargetActive]
  );

  const { submitCommit } = commitFlow;
  const commitDraft = React.useCallback(() => {
    if (commitBlockers.length > 0) {
      return;
    }
    submitCommit(draftRef.current, seededCloneConfigIdRef.current);
  }, [commitBlockers.length, submitCommit]);

  return {
    draft,
    generation,
    invalidationNotice,
    intakeNotice,
    commitError: commitFlow.commitError,
    generateBlockers,
    commitBlockers,
    artifactUsage,
    availableSources,
    requestBeatSelection,
    handleBeatSelection,
    changeBeatText,
    selectSourceReference,
    changePovMode,
    changePovFocalCharacter,
    changeMustSurvive,
    changeMustNotChange,
    toggleChannel,
    changeLengthBudget,
    changePosition,
    generateWorkup,
    cancelGenerate,
    toggleKeep,
    changeCarryMode,
    changeNote,
    commitDraft,
    persistedState: {}
  };
}
