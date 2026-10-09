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
  WorkshopShowVsTellBeat,
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
  SHOW_VS_TELL_CHANNELS,
  SHOW_VS_TELL_DEFAULTS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  showVsTellSourceReferenceKey,
  showVsTellWorkupVariants,
  type ShowVsTellGenerationInput
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
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
}

export interface ShowVsTellAuthoringState {
  draft: WorkshopShowVsTellDraft;
  generation: ShowVsTellGenerationPhase;
  invalidationNotice: string | null;
  /** Visible explanation when intake had to shorten a selection into a beat. */
  intakeNotice: string | null;
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
}

/** Explicitly empty: the host owns durable truth, and this controller is transient. */
export interface ShowVsTellAuthoringPersistence {
  // The host owns persisted widget configuration; this controller is transient.
}

export type UseShowVsTellAuthoringReturn = ShowVsTellAuthoringState &
  ShowVsTellAuthoringActions & {
    persistedState: ShowVsTellAuthoringPersistence;
  };

export function createShowVsTellAuthoringDraft(): WorkshopShowVsTellDraft {
  return {
    beat: { text: '', provenance: { kind: 'pasted' } },
    surroundingContext: { sourceReferences: [] },
    pov: { ...SHOW_VS_TELL_DEFAULTS.pov },
    invariants: { mustSurvive: '', mustNotChange: '' },
    channels: [...SHOW_VS_TELL_DEFAULTS.channels],
    lengthBudget: SHOW_VS_TELL_DEFAULTS.lengthBudget,
    position: SHOW_VS_TELL_DEFAULTS.position,
    workup: null,
    kept: [],
    note: ''
  };
}

const LINE_BREAK_RUN = /\s*(?:\r\n|[\r\n\u2028\u2029])+\s*/gu;

/** A beat, a focal character, and the note are single-line fields. */
export function collapseShowVsTellLineBreaks(text: string): string {
  return text.replace(LINE_BREAK_RUN, ' ');
}

type ShowVsTellInputLabel =
  | 'beat'
  | 'surrounding passage source'
  | 'point of view'
  | '“Must survive” constraint'
  | '“Must not change” constraint'
  | 'channels'
  | 'length budget'
  | 'widget model'
  | 'room';

function changedWorkNotice(
  label: ShowVsTellInputLabel,
  hadActiveGeneration: boolean,
  hadSettledWork: boolean
): string | null {
  if (hadSettledWork) {
    return `Generated workup cleared because the ${label} changed.`;
  }
  return hadActiveGeneration
    ? `Generation cancelled because the ${label} changed.`
    : null;
}

function generationDetail(progress: WorkshopShowVsTellGenerationProgressPayload): string {
  switch (progress.stage) {
    case 'requesting':
      return 'Requesting the workup';
    case 'workup':
      return `Receiving the workup · ${progress.outputCharacters.toLocaleString()} characters`;
    case 'validating':
      return 'Validating the closed response';
  }
}

function sameBeat(left: WorkshopShowVsTellBeat, right: WorkshopShowVsTellBeat): boolean {
  if (left.text !== right.text || left.provenance.kind !== right.provenance.kind) {
    return false;
  }
  if (left.provenance.kind === 'excerpt' && right.provenance.kind === 'excerpt') {
    return left.provenance.relativePath === right.provenance.relativePath
      && left.provenance.startLine === right.provenance.startLine
      && left.provenance.endLine === right.provenance.endLine;
  }
  if (left.provenance.kind === 'persona-prefill' && right.provenance.kind === 'persona-prefill') {
    return left.provenance.personaId === right.provenance.personaId
      && left.provenance.editedByWriter === right.provenance.editedByWriter;
  }
  return true;
}

const hasSettledWork = (draft: WorkshopShowVsTellDraft): boolean =>
  draft.workup !== null || draft.kept.length > 0;

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
  cancelGeneration
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
  const previousWidgetModelIdRef = React.useRef(widgetModelId);
  const previousRoomKeyRef = React.useRef(roomKey);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      activeTokenRef.current = undefined;
      previousWidgetModelIdRef.current = widgetModelId;
      previousRoomKeyRef.current = roomKey;
      setDraft(createShowVsTellAuthoringDraft());
      setGeneration({ kind: 'idle' });
      setInvalidationNotice(null);
      setIntakeNotice(null);
    } else if (!open && wasOpenRef.current) {
      // Closing discards any reply still in flight: its token is no longer ours.
      activeTokenRef.current = undefined;
    }
    wasOpenRef.current = open;
  }, [open, roomKey, setDraft, widgetModelId]);

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
    if (next === current) {
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
    if (!open || activeTokenRef.current !== undefined
      || message.payload.target !== 'workshop_show_vs_tell_beat') {
      return;
    }
    const payload = message.payload;
    const collapsed = collapseShowVsTellLineBreaks(payload.content).trim();
    const text = collapsed.slice(0, BUDGET.showVsTellBeatCharacters).trim();
    // Display-safe provenance: the editor URI is dropped; the relative path and
    // line range stay. Clipboard intake carries no range and is recorded as pasted.
    const provenance = payload.sourceUri && payload.relativePath
      ? {
          kind: 'excerpt' as const,
          relativePath: payload.relativePath,
          ...(payload.startLine !== undefined ? { startLine: payload.startLine } : {}),
          ...(payload.endLine !== undefined ? { endLine: payload.endLine } : {})
        }
      : { kind: 'pasted' as const };
    const beat: WorkshopShowVsTellBeat = { text, provenance };
    setIntakeNotice(
      collapsed.length > BUDGET.showVsTellBeatCharacters
        ? `That selection was longer than ${BUDGET.showVsTellBeatCharacters} characters, so the beat holds its first ${BUDGET.showVsTellBeatCharacters}. A beat is one line — use Creative Variations for a passage.`
        : null
    );
    updateGenerationInput('beat', (current) => sameBeat(beat, current.beat)
      ? current
      : { ...current, beat });
  }, [open, updateGenerationInput]);

  const requestCurrentBeatSelection = React.useCallback(() => {
    requestBeatSelection();
  }, [requestBeatSelection]);

  const changeBeatText = React.useCallback((raw: string) => {
    const text = collapseShowVsTellLineBreaks(raw).slice(0, BUDGET.showVsTellBeatCharacters);
    setIntakeNotice(null);
    updateGenerationInput('beat', (current) => {
      if (text === current.beat.text) {
        return current;
      }
      // Editing seeded text follows Creative Variations' provenance-flip rule.
      const provenance = current.beat.provenance;
      return {
        ...current,
        beat: {
          text,
          provenance: provenance.kind === 'excerpt'
            ? { kind: 'pasted' }
            : provenance.kind === 'persona-prefill'
              ? { ...provenance, editedByWriter: true }
              : provenance
        }
      };
    });
  }, [updateGenerationInput]);

  const selectSourceReference = React.useCallback((
    reference: WorkshopWidgetSourceReference | null
  ) => {
    updateGenerationInput('surrounding passage source', (current) => {
      const existing = current.surroundingContext.sourceReferences[0];
      const unchanged = reference === null
        ? existing === undefined
        : existing !== undefined
          && showVsTellSourceReferenceKey(existing) === showVsTellSourceReferenceKey(reference);
      return unchanged
        ? current
        : {
            ...current,
            surroundingContext: { sourceReferences: reference === null ? [] : [{ ...reference }] }
          };
    });
  }, [updateGenerationInput]);

  const changePovMode = React.useCallback((mode: WorkshopShowVsTellPovMode) => {
    updateGenerationInput('point of view', (current) => mode === current.pov.mode
      ? current
      // `unspecified` names no focal character, so the character is blanked with it.
      : { ...current, pov: { mode, focalCharacter: mode === 'unspecified' ? '' : current.pov.focalCharacter } });
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
      const selected = current.channels.includes(channel);
      if (selected && current.channels.length === 1) {
        return current; // The last selected channel cannot be turned off.
      }
      const wanted = selected
        ? current.channels.filter((candidate) => candidate !== channel)
        : [...current.channels, channel];
      // Stored in the fixed channel order, whatever order the writer clicked.
      return {
        ...current,
        channels: SHOW_VS_TELL_CHANNELS
          .map((descriptor) => descriptor.id)
          .filter((id) => wanted.includes(id))
      };
    });
  }, [updateGenerationInput]);

  const changeLengthBudget = React.useCallback((lengthBudget: WorkshopShowVsTellLengthBudget) => {
    updateGenerationInput('length budget', (current) => lengthBudget === current.lengthBudget
      ? current
      : { ...current, lengthBudget });
  }, [updateGenerationInput]);

  /** The one exception: moving the position keeps the workup, the kept variants, and any attempt. */
  const changePosition = React.useCallback((position: NarrativeHandlingPosition) => {
    if (position !== draftRef.current.position) {
      setDraft((current) => ({ ...current, position }));
    }
  }, [setDraft]);

  React.useEffect(() => {
    const previousWidgetModelId = previousWidgetModelIdRef.current;
    if (!open) {
      previousWidgetModelIdRef.current = widgetModelId;
      return;
    }
    if (previousWidgetModelId === widgetModelId) {
      return;
    }
    previousWidgetModelIdRef.current = widgetModelId;
    const current = draftRef.current;
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadWork = hasSettledWork(current);
    if (!hadActiveGeneration && !hadWork) {
      return;
    }
    cancelActiveGeneration();
    if (hadWork) {
      setDraft({ ...current, workup: null, kept: [] });
    }
    setInvalidationNotice(changedWorkNotice('widget model', hadActiveGeneration, hadWork));
  }, [cancelActiveGeneration, open, setDraft, widgetModelId]);

  React.useEffect(() => {
    const previousRoomKey = previousRoomKeyRef.current;
    if (!open) {
      previousRoomKeyRef.current = roomKey;
      return;
    }
    if (previousRoomKey === roomKey) {
      return;
    }
    previousRoomKeyRef.current = roomKey;
    const current = draftRef.current;
    // Only work grounded on a source reference depends on the room: a beat
    // generated with no source is the same request in any room.
    if (current.surroundingContext.sourceReferences.length === 0) {
      return;
    }
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadWork = hasSettledWork(current);
    if (!hadActiveGeneration && !hadWork) {
      return;
    }
    cancelActiveGeneration();
    if (hadWork) {
      setDraft({ ...current, workup: null, kept: [] });
    }
    setInvalidationNotice(changedWorkNotice('room', hadActiveGeneration, hadWork));
  }, [cancelActiveGeneration, open, roomKey, setDraft]);

  const availableSources = React.useMemo<ShowVsTellAvailableSource[]>(() => [
    ...(activeExcerpt
      ? [{
          reference: { kind: 'active-excerpt' } as const,
          label: 'Active excerpt',
          detail: activeExcerpt.source.kind === 'manual'
            ? `Pasted Workshop passage · version ${activeExcerpt.version}`
            : `${activeExcerpt.source.relativePath} · version ${activeExcerpt.version}`
        }]
      : []),
    ...contextAttachments.map((attachment) => ({
      reference: { kind: 'context-attachment' as const, attachmentId: attachment.id },
      label: attachment.label,
      detail: `${attachment.kind === 'file' ? attachment.relativePath ?? 'Project file' : 'Workshop text'} · ${attachment.words.toLocaleString()} words`
    }))
  ], [activeExcerpt, contextAttachments]);

  const generateBlockers = React.useMemo<ShowVsTellGenerateBlocker[]>(() => {
    const blockers: ShowVsTellGenerateBlocker[] = [];
    if (draft.beat.text.trim().length === 0) {
      blockers.push('beat-required');
    }
    if (draft.invariants.mustSurvive.trim().length === 0) {
      blockers.push('must-survive-required');
    }
    const reference = draft.surroundingContext.sourceReferences[0];
    if (
      reference !== undefined
      && !availableSources.some((source) =>
        showVsTellSourceReferenceKey(source.reference) === showVsTellSourceReferenceKey(reference))
    ) {
      blockers.push('source-unavailable');
    }
    return blockers;
  }, [availableSources, draft.beat.text, draft.invariants.mustSurvive, draft.surroundingContext]);

  const generateWorkup = React.useCallback(() => {
    const current = draftRef.current;
    if (generateBlockers.length > 0) {
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
    setDraft((current) => {
      const variants = current.workup ? showVsTellWorkupVariants(current.workup) : [];
      if (!variants.some((variant) => variant.id === variantId)) {
        return current;
      }
      const kept = current.kept.some((entry) => entry.variantId === variantId)
        ? current.kept.filter((entry) => entry.variantId !== variantId)
        : [...current.kept, { variantId, carryMode: SHOW_VS_TELL_DEFAULTS.carryMode }];
      // Kept variants are stored in workup order.
      const order = new Map(variants.map((variant, index) => [variant.id, index]));
      return {
        ...current,
        kept: [...kept].sort(
          (left, right) => (order.get(left.variantId) ?? 0) - (order.get(right.variantId) ?? 0)
        )
      };
    });
  }, [setDraft]);

  const changeCarryMode = React.useCallback((
    variantId: string,
    carryMode: WorkshopShowVsTellCarryMode
  ) => {
    setDraft((current) => ({
      ...current,
      kept: current.kept.map((entry) => entry.variantId === variantId
        ? { ...entry, carryMode }
        : entry)
    }));
  }, [setDraft]);

  const changeNote = React.useCallback((raw: string) => {
    const note = collapseShowVsTellLineBreaks(raw).slice(0, BUDGET.showVsTellNoteCharacters);
    setDraft((current) => note === current.note ? current : { ...current, note });
  }, [setDraft]);

  const artifactProjection = React.useMemo<{
    usage: ShowVsTellArtifactUsage | null;
    error: unknown | null;
  }>(() => {
    if (draft.kept.length === 0) {
      return { usage: null, error: null };
    }
    try {
      // The webview meter calls the same projection the host re-checks with.
      const text = buildShowVsTellArtifact(draft);
      return {
        usage: { text, characters: text.length, budget: BUDGET.showVsTellArtifactCharacters },
        error: null
      };
    } catch (error) {
      return { usage: null, error };
    }
  }, [draft]);
  const artifactUsage = artifactProjection.usage;

  React.useEffect(() => {
    if (artifactProjection.error !== null) {
      console.warn('[ShowVsTell] Could not compile artifact usage', artifactProjection.error);
    }
  }, [artifactProjection.error]);

  const commitBlockers = React.useMemo<ShowVsTellCommitBlocker[]>(() => {
    const blockers: ShowVsTellCommitBlocker[] = [];
    if (generation.kind === 'generating') {
      blockers.push('generation-in-flight');
    }
    if (!draft.workup) {
      blockers.push('no-workup');
    } else if (draft.kept.length === 0) {
      blockers.push('no-keep');
    }
    if (artifactProjection.error !== null) {
      blockers.push('artifact-compilation-failed');
    }
    if (artifactUsage && artifactUsage.characters > artifactUsage.budget) {
      blockers.push('over-artifact-budget');
    }
    // Slice 4 wires the commit route and removes this entry.
    blockers.push('commit-not-wired');
    return blockers;
  }, [artifactProjection.error, artifactUsage, draft.kept.length, draft.workup, generation.kind]);

  return {
    draft,
    generation,
    invalidationNotice,
    intakeNotice,
    generateBlockers,
    commitBlockers,
    artifactUsage,
    availableSources,
    requestBeatSelection: requestCurrentBeatSelection,
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
    persistedState: {}
  };
}
