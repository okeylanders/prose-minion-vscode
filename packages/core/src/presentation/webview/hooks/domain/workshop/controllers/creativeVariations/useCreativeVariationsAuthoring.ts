/** Transient Creative Variations authoring state machine. */

import * as React from 'react';
import type {
  SelectionDataMessage,
  WorkshopContextAttachmentSnapshot,
  WorkshopCreativeVariationsCarryMode,
  WorkshopCreativeVariationsDistance,
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsGenerationProgressPayload,
  WorkshopCreativeVariationsRequestedCount,
  WorkshopCreativeVariationsResultPayload,
  WorkshopExcerptSnapshot,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCreativeVariationsAvailableSource,
  WorkshopCreativeVariationsGenerationPhase
} from '@components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal';
import {
  creativeVariationsSourceReferenceKey
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';
import {
  buildCreativeVariationsArtifact
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact';
import {
  creativeVariationsSelectionCommitIssues
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsCommitEligibility';
import type {
  WorkshopCreativeVariationsOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import type {
  WorkshopCreativeVariationsArtifactUsage,
  WorkshopCreativeVariationsCommitBlocker
} from '@components/workshop/widgets/creativeVariations/WorkshopCreativeVariationsModal';

export interface CreativeVariationsCommitOutcome {
  ok: boolean;
  message?: string;
}

export interface UseCreativeVariationsAuthoringOptions {
  opening: WorkshopCreativeVariationsOpening | null;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /** Host-owned effective widget model; changes invalidate dependent transient work. */
  widgetModelId: string;
  generationProgress: WorkshopCreativeVariationsGenerationProgressPayload | null;
  generationResult: WorkshopCreativeVariationsResultPayload | null;
  requestSubjectSelection: () => void;
  generate: (draft: WorkshopCreativeVariationsDraft) => string;
  cancelGeneration: (token?: string) => void;
  roomRunActive: boolean;
  toolTargetActive: boolean;
  commitPending: boolean;
  commitOutcome: CreativeVariationsCommitOutcome | null;
  commit: (draft: WorkshopCreativeVariationsDraft, clonedFromConfigId?: string) => void;
  clearCommitResult: () => void;
  resetCommitState: () => void;
  onCommitAccepted: () => void;
}

export interface CreativeVariationsAuthoringState {
  draft: WorkshopCreativeVariationsDraft;
  generation: WorkshopCreativeVariationsGenerationPhase;
  invalidationNotice: string | null;
  commitError: string | null;
  commitBlockers: readonly WorkshopCreativeVariationsCommitBlocker[];
  artifactUsage: WorkshopCreativeVariationsArtifactUsage | null;
  availableSources: readonly WorkshopCreativeVariationsAvailableSource[];
}

export interface CreativeVariationsAuthoringActions {
  requestSubjectSelection: () => void;
  handleSubjectSelection: (message: SelectionDataMessage) => void;
  changeSubjectText: (text: string) => void;
  changeSurroundingContext: (text: string) => void;
  toggleSourceReference: (reference: WorkshopWidgetSourceReference) => void;
  changeMustSurvive: (text: string) => void;
  changeMustNotChange: (text: string) => void;
  changeAim: (text: string) => void;
  changeDistance: (distance: WorkshopCreativeVariationsDistance) => void;
  changeRequestedCount: (count: WorkshopCreativeVariationsRequestedCount) => void;
  generateWorkup: () => void;
  cancelGenerate: () => void;
  toggleCardSelection: (position: number) => void;
  changeCarryMode: (position: number, mode: WorkshopCreativeVariationsCarryMode) => void;
  changeNote: (note: string) => void;
  commitDraft: () => void;
}

export interface CreativeVariationsAuthoringPersistence {
  // The host owns persisted widget configuration; this controller is transient.
}

export type UseCreativeVariationsAuthoringReturn = CreativeVariationsAuthoringState &
  CreativeVariationsAuthoringActions & {
    persistedState: CreativeVariationsAuthoringPersistence;
  };

export function createCreativeVariationsAuthoringDraft(): WorkshopCreativeVariationsDraft {
  return {
    subject: { text: '', provenance: { kind: 'pasted' } },
    surroundingContext: { writerText: '', sourceReferences: [] },
    invariants: { mustSurvive: '', mustNotChange: '' },
    intent: { kind: 'custom-aim', aim: '', distance: 'tail' },
    requestedCount: 3,
    workup: null,
    selections: [],
    note: ''
  };
}

function createCreativeVariationsRecommendationDraft(
  opening: Extract<WorkshopCreativeVariationsOpening, { kind: 'seed' }>
): WorkshopCreativeVariationsDraft {
  const seed = opening.seed;
  return {
    subject: {
      text: seed.subjectText ?? '',
      provenance: {
        kind: 'persona-prefill',
        personaId: opening.personaId,
        editedByWriter: false
      }
    },
    surroundingContext: {
      writerText: seed.contextText ?? '',
      sourceReferences: seed.sourceReferences?.map((reference) => ({ ...reference })) ?? []
    },
    invariants: {
      mustSurvive: seed.mustSurvive ?? '',
      mustNotChange: seed.mustNotChange ?? ''
    },
    intent: {
      kind: 'custom-aim',
      aim: seed.aim ?? '',
      distance: seed.distance ?? 'tail'
    },
    requestedCount: seed.requestedCount ?? 3,
    workup: null,
    selections: [],
    note: ''
  };
}

function generationDetail(
  progress: WorkshopCreativeVariationsGenerationProgressPayload
): string {
  switch (progress.stage) {
    case 'requesting':
      return 'Requesting variations';
    case 'variations':
      return `Receiving variations · ${progress.outputCharacters.toLocaleString()} characters`;
    case 'validating':
      return 'Validating the closed response';
  }
}

type CreativeVariationsInputLabel =
  | 'passage'
  | 'surrounding context'
  | 'source material'
  | '“Must survive” constraint'
  | '“Must not change” constraint'
  | 'creative aim'
  | 'sampling distance'
  | 'take count'
  | 'widget model';

function changedWorkNotice(
  label: CreativeVariationsInputLabel,
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

function sameSubject(
  left: WorkshopCreativeVariationsDraft['subject'],
  right: WorkshopCreativeVariationsDraft['subject']
): boolean {
  if (left.text !== right.text || left.provenance.kind !== right.provenance.kind) {
    return false;
  }
  if (left.provenance.kind === 'pasted' && right.provenance.kind === 'pasted') {
    return true;
  }
  if (
    left.provenance.kind === 'persona-prefill'
    && right.provenance.kind === 'persona-prefill'
  ) {
    return left.provenance.personaId === right.provenance.personaId
      && left.provenance.editedByWriter === right.provenance.editedByWriter;
  }
  if (left.provenance.kind !== 'excerpt' || right.provenance.kind !== 'excerpt') {
    return false;
  }
  return left.provenance.relativePath === right.provenance.relativePath
    && left.provenance.startLine === right.provenance.startLine
    && left.provenance.endLine === right.provenance.endLine;
}

export function useCreativeVariationsAuthoring({
  opening,
  activeExcerpt,
  contextAttachments,
  widgetModelId,
  generationProgress,
  generationResult,
  requestSubjectSelection,
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
}: UseCreativeVariationsAuthoringOptions): UseCreativeVariationsAuthoringReturn {
  const open = opening !== null;
  const [draft, setDraftState] = React.useState<WorkshopCreativeVariationsDraft>(
    createCreativeVariationsAuthoringDraft
  );
  const draftRef = React.useRef(draft);
  const setDraft = React.useCallback((
    update: WorkshopCreativeVariationsDraft
      | ((current: WorkshopCreativeVariationsDraft) => WorkshopCreativeVariationsDraft)
  ) => {
    const next = typeof update === 'function' ? update(draftRef.current) : update;
    draftRef.current = next;
    setDraftState(next);
  }, []);
  const [generation, setGeneration] = React.useState<WorkshopCreativeVariationsGenerationPhase>({
    kind: 'idle'
  });
  const [invalidationNotice, setInvalidationNotice] = React.useState<string | null>(null);
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const activeTokenRef = React.useRef<string>();
  const ignoredOpeningCommitOutcomeRef = React.useRef<CreativeVariationsCommitOutcome | null>();
  const wasOpenRef = React.useRef(false);
  const seededCloneConfigIdRef = React.useRef<string>();
  const previousWidgetModelIdRef = React.useRef(widgetModelId);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      activeTokenRef.current = undefined;
      seededCloneConfigIdRef.current = opening?.kind === 'clone'
        ? opening.config.id
        : undefined;
      previousWidgetModelIdRef.current = widgetModelId;
      ignoredOpeningCommitOutcomeRef.current = commitOutcome;
      setDraft(
        opening?.kind === 'clone'
          ? opening.config.draft
          : opening?.kind === 'seed'
            ? createCreativeVariationsRecommendationDraft(opening)
          : createCreativeVariationsAuthoringDraft()
      );
      setGeneration({ kind: 'idle' });
      setInvalidationNotice(null);
      setCommitError(null);
      resetCommitState();
    } else if (!open && wasOpenRef.current) {
      seededCloneConfigIdRef.current = undefined;
    }
    wasOpenRef.current = open;
  }, [commitOutcome, open, opening, resetCommitState, setDraft, widgetModelId]);

  React.useEffect(() => {
    if (!open || !commitOutcome) {
      return;
    }
    if (ignoredOpeningCommitOutcomeRef.current === commitOutcome) {
      ignoredOpeningCommitOutcomeRef.current = null;
      return;
    }
    clearCommitResult();
    if (commitOutcome.ok) {
      setCommitError(null);
      onCommitAccepted();
      return;
    }
    setCommitError(
      commitOutcome.message
        ?? 'Creative Variations did not reach the room. Your exact draft is still open.'
    );
  }, [clearCommitResult, commitOutcome, onCommitAccepted, open]);

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
    setGeneration({
      kind: 'generating',
      detail: generationDetail(generationProgress)
    });
  }, [generationProgress, open]);

  React.useEffect(() => {
    const token = activeTokenRef.current;
    if (!open || !token || generationResult?.token !== token) {
      return;
    }
    activeTokenRef.current = undefined;
    if (generationResult.ok) {
      setDraft((current) => ({
        ...current,
        workup: generationResult.workup,
        selections: []
      }));
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

  const updateAuthoringInput = React.useCallback((
    label: CreativeVariationsInputLabel,
    update: (current: WorkshopCreativeVariationsDraft) => WorkshopCreativeVariationsDraft
  ) => {
    if (commitPending) {
      return;
    }
    const current = draftRef.current;
    const next = update(current);
    if (next === current) {
      return;
    }
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadSettledWork = current.workup !== null || current.selections.length > 0;
    cancelActiveGeneration();
    setDraft({ ...next, workup: null, selections: [] });
    const notice = changedWorkNotice(label, hadActiveGeneration, hadSettledWork);
    if (notice) {
      setInvalidationNotice(notice);
    }
  }, [cancelActiveGeneration, commitPending, setDraft]);

  const requestCurrentSubjectSelection = React.useCallback(() => {
    if (!commitPending) {
      requestSubjectSelection();
    }
  }, [commitPending, requestSubjectSelection]);

  const handleSubjectSelection = React.useCallback((message: SelectionDataMessage) => {
    /* Normal delivery is target-routed; retain the check for direct hook consumers. */
    if (!open || activeTokenRef.current !== undefined
      || message.payload.target !== 'workshop_creative_variations_subject') {
      return;
    }
    const payload = message.payload;
    const provenance = payload.sourceUri && payload.relativePath
      ? {
          kind: 'excerpt' as const,
          relativePath: payload.relativePath,
          ...(payload.startLine !== undefined ? { startLine: payload.startLine } : {}),
          ...(payload.endLine !== undefined ? { endLine: payload.endLine } : {})
        }
      : { kind: 'pasted' as const };
    const subject = { text: payload.content, provenance };
    updateAuthoringInput('passage', (current) => sameSubject(subject, current.subject)
      ? current
      : { ...current, subject });
  }, [open, updateAuthoringInput]);

  const changeSubjectText = React.useCallback((text: string) => {
    updateAuthoringInput('passage', (current) => {
      if (text === current.subject.text) {
        return current;
      }
      return {
        ...current,
        subject: {
          text,
          provenance: current.subject.provenance.kind === 'excerpt'
            ? { kind: 'pasted' }
            : current.subject.provenance.kind === 'persona-prefill'
              ? { ...current.subject.provenance, editedByWriter: true }
              : current.subject.provenance
        }
      };
    });
  }, [updateAuthoringInput]);

  const changeSurroundingContext = React.useCallback((writerText: string) => {
    updateAuthoringInput('surrounding context', (current) => writerText === current.surroundingContext.writerText
      ? current
      : {
          ...current,
          surroundingContext: { ...current.surroundingContext, writerText }
        });
  }, [updateAuthoringInput]);

  const toggleSourceReference = React.useCallback((reference: WorkshopWidgetSourceReference) => {
    updateAuthoringInput('source material', (current) => {
      const key = creativeVariationsSourceReferenceKey(reference);
      const selected = current.surroundingContext.sourceReferences.some(
        (candidate) => creativeVariationsSourceReferenceKey(candidate) === key
      );
      if (
        !selected
        && current.surroundingContext.sourceReferences.length
          >= PROMPT_BUDGETS.workshopWidgets.creativeSourceReferences
      ) {
        return current;
      }
      return {
        ...current,
        surroundingContext: {
          ...current.surroundingContext,
          sourceReferences: selected
            ? current.surroundingContext.sourceReferences.filter(
                (candidate) => creativeVariationsSourceReferenceKey(candidate) !== key
              )
            : [...current.surroundingContext.sourceReferences, reference]
        }
      };
    });
  }, [updateAuthoringInput]);

  const changeMustSurvive = React.useCallback((mustSurvive: string) => {
    updateAuthoringInput('“Must survive” constraint', (current) => mustSurvive === current.invariants.mustSurvive
      ? current
      : { ...current, invariants: { ...current.invariants, mustSurvive } });
  }, [updateAuthoringInput]);

  const changeMustNotChange = React.useCallback((mustNotChange: string) => {
    updateAuthoringInput('“Must not change” constraint', (current) => mustNotChange === current.invariants.mustNotChange
      ? current
      : { ...current, invariants: { ...current.invariants, mustNotChange } });
  }, [updateAuthoringInput]);

  const changeAim = React.useCallback((aim: string) => {
    updateAuthoringInput('creative aim', (current) => aim === current.intent.aim
      ? current
      : { ...current, intent: { ...current.intent, aim } });
  }, [updateAuthoringInput]);

  const changeDistance = React.useCallback((distance: WorkshopCreativeVariationsDistance) => {
    updateAuthoringInput('sampling distance', (current) => distance === current.intent.distance
      ? current
      : { ...current, intent: { ...current.intent, distance } });
  }, [updateAuthoringInput]);

  const changeRequestedCount = React.useCallback((
    requestedCount: WorkshopCreativeVariationsRequestedCount
  ) => {
    updateAuthoringInput('take count', (current) => requestedCount === current.requestedCount
      ? current
      : { ...current, requestedCount });
  }, [updateAuthoringInput]);

  React.useEffect(() => {
    const previousWidgetModelId = previousWidgetModelIdRef.current;
    if (!open) {
      previousWidgetModelIdRef.current = widgetModelId;
      return;
    }
    if (commitPending || previousWidgetModelId === widgetModelId) {
      return;
    }
    previousWidgetModelIdRef.current = widgetModelId;
    const current = draftRef.current;
    const hadActiveGeneration = activeTokenRef.current !== undefined;
    const hadSettledWork = current.workup !== null || current.selections.length > 0;
    if (!hadActiveGeneration && !hadSettledWork) {
      return;
    }
    cancelActiveGeneration();
    if (hadSettledWork) {
      setDraft({ ...current, workup: null, selections: [] });
    }
    setInvalidationNotice(
      changedWorkNotice('widget model', hadActiveGeneration, hadSettledWork)
    );
  }, [cancelActiveGeneration, commitPending, open, setDraft, widgetModelId]);

  const generateWorkup = React.useCallback(() => {
    if (commitPending) {
      return;
    }
    cancelActiveGeneration();
    setDraft((current) => ({ ...current, workup: null, selections: [] }));
    setInvalidationNotice(null);
    activeTokenRef.current = generate(draftRef.current);
    setGeneration({ kind: 'generating', detail: 'Requesting variations' });
  }, [cancelActiveGeneration, commitPending, generate, setDraft]);

  const cancelGenerate = React.useCallback(() => {
    cancelActiveGeneration();
  }, [cancelActiveGeneration]);

  const toggleCardSelection = React.useCallback((position: number) => {
    if (commitPending) {
      return;
    }
    setDraft((current) => {
      const card = current.workup?.cards.find((candidate) => candidate.position === position);
      if (!card) {
        return current;
      }
      const selected = current.selections.some((selection) => selection.position === position);
      return {
        ...current,
        selections: selected
          ? current.selections.filter((selection) => selection.position !== position)
          : [
              ...current.selections,
              { position, carryMode: 'direction' as const }
            ].sort((left, right) => left.position - right.position)
      };
    });
  }, [commitPending]);

  const changeCarryMode = React.useCallback((
    position: number,
    carryMode: WorkshopCreativeVariationsCarryMode
  ) => {
    if (commitPending) {
      return;
    }
    setDraft((current) => ({
      ...current,
      selections: current.selections.map((selection) => selection.position === position
        ? { ...selection, carryMode }
        : selection)
    }));
  }, [commitPending]);

  const changeNote = React.useCallback((note: string) => {
    if (!commitPending) {
      setDraft((current) => ({ ...current, note }));
    }
  }, [commitPending, setDraft]);

  const availableSources = React.useMemo<WorkshopCreativeVariationsAvailableSource[]>(() => [
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
      reference: {
        kind: 'context-attachment' as const,
        attachmentId: attachment.id
      },
      label: attachment.label,
      detail: `${attachment.kind === 'file' ? attachment.relativePath ?? 'Project file' : 'Workshop text'} · ${attachment.words.toLocaleString()} words`
    }))
  ], [activeExcerpt, contextAttachments]);

  const artifactProjection = React.useMemo<{
    usage: WorkshopCreativeVariationsArtifactUsage | null;
    error: unknown | null;
  }>(() => {
    if (draft.selections.length === 0) {
      return { usage: null, error: null };
    }
    try {
      return {
        usage: {
          characters: buildCreativeVariationsArtifact(draft).length,
          budget: PROMPT_BUDGETS.workshopWidgets.creativeArtifactCharacters
        },
        error: null
      };
    } catch (error) {
      return { usage: null, error };
    }
  }, [draft]);
  const artifactUsage = artifactProjection.usage;

  React.useEffect(() => {
    if (artifactProjection.error !== null) {
      console.warn(
        '[CreativeVariations] Could not compile artifact usage',
        artifactProjection.error
      );
    }
  }, [artifactProjection.error]);

  const commitBlockers = React.useMemo<WorkshopCreativeVariationsCommitBlocker[]>(() => {
    const blockers: WorkshopCreativeVariationsCommitBlocker[] = [];
    if (generation.kind === 'generating') {
      blockers.push('generation-in-flight');
    }
    if (commitPending) {
      blockers.push('commit-in-flight');
    }
    if (roomRunActive) {
      blockers.push('room-run-active');
    }
    if (toolTargetActive) {
      blockers.push('tool-target');
    }
    if (!draft.workup) {
      blockers.push('no-workup');
      return blockers;
    }
    if (draft.selections.length === 0) {
      blockers.push('no-selection');
      return blockers;
    }
    const selectionIssues = creativeVariationsSelectionCommitIssues(draft);
    for (const selectionIssue of selectionIssues) {
      const blocker =
        selectionIssue.code === 'selection-not-in-workup'
          ? 'artifact-compilation-failed'
          : selectionIssue.code;
      if (!blockers.includes(blocker)) {
        blockers.push(blocker);
      }
    }
    if (artifactProjection.error !== null && !blockers.includes('artifact-compilation-failed')) {
      blockers.push('artifact-compilation-failed');
    }
    if (artifactUsage && artifactUsage.characters > artifactUsage.budget) {
      blockers.push('over-artifact-budget');
    }
    return blockers;
  }, [
    artifactUsage,
    artifactProjection.error,
    commitPending,
    draft.selections,
    draft.workup,
    generation.kind,
    roomRunActive,
    toolTargetActive
  ]);

  const commitDraft = React.useCallback(() => {
    if (commitBlockers.length > 0) {
      return;
    }
    setCommitError(null);
    clearCommitResult();
    commit(
      draftRef.current,
      seededCloneConfigIdRef.current
    );
  }, [clearCommitResult, commit, commitBlockers.length]);

  return {
    draft,
    generation,
    invalidationNotice,
    commitError,
    commitBlockers,
    artifactUsage,
    availableSources,
    requestSubjectSelection: requestCurrentSubjectSelection,
    handleSubjectSelection,
    changeSubjectText,
    changeSurroundingContext,
    toggleSourceReference,
    changeMustSurvive,
    changeMustNotChange,
    changeAim,
    changeDistance,
    changeRequestedCount,
    generateWorkup,
    cancelGenerate,
    toggleCardSelection,
    changeCarryMode,
    changeNote,
    commitDraft,
    persistedState: {}
  };
}
