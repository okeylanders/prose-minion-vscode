/** Transient Creative Variations authoring state machine. */

import * as React from 'react';
import type {
  SelectionDataPayload,
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
import {
  creativeVariationsSourceReferenceKey
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';

export type CreativeVariationsGenerationPhase =
  | { kind: 'idle' }
  | { kind: 'generating'; detail?: string }
  | { kind: 'failed'; message: string };

export type CreativeVariationsCommitBlocker =
  | 'generation-in-flight'
  | 'no-workup'
  | 'no-selection'
  | 'unaccepted-advisory-risk';

export interface CreativeVariationsAvailableSource {
  reference: WorkshopWidgetSourceReference;
  label: string;
  detail: string;
}

export interface UseCreativeVariationsAuthoringOptions {
  open: boolean;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  contextAttachments: WorkshopContextAttachmentSnapshot[];
  /** Host-owned effective widget model; changes invalidate dependent transient work. */
  widgetModelId: string;
  generationProgress: WorkshopCreativeVariationsGenerationProgressPayload | null;
  generationResult: WorkshopCreativeVariationsResultPayload | null;
  requestSubjectSelection: () => void;
  generate: (draft: WorkshopCreativeVariationsDraft) => string;
  cancelGeneration: (token?: string) => void;
}

export interface CreativeVariationsAuthoringState {
  draft: WorkshopCreativeVariationsDraft;
  generation: CreativeVariationsGenerationPhase;
  commitBlockers: readonly CreativeVariationsCommitBlocker[];
  availableSources: readonly CreativeVariationsAvailableSource[];
}

export interface CreativeVariationsAuthoringActions {
  requestSubjectSelection: () => void;
  handleSubjectSelection: (payload: SelectionDataPayload) => void;
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
  toggleAdvisoryRisk: (position: number, riskId: string) => void;
  changeNote: (note: string) => void;
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

export function useCreativeVariationsAuthoring({
  open,
  activeExcerpt,
  contextAttachments,
  widgetModelId,
  generationProgress,
  generationResult,
  requestSubjectSelection,
  generate,
  cancelGeneration
}: UseCreativeVariationsAuthoringOptions): UseCreativeVariationsAuthoringReturn {
  const [draft, setDraft] = React.useState<WorkshopCreativeVariationsDraft>(
    createCreativeVariationsAuthoringDraft
  );
  const [generation, setGeneration] = React.useState<CreativeVariationsGenerationPhase>({
    kind: 'idle'
  });
  const activeTokenRef = React.useRef<string>();
  const wasOpenRef = React.useRef(false);
  const previousWidgetModelIdRef = React.useRef(widgetModelId);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      activeTokenRef.current = undefined;
      setDraft(createCreativeVariationsAuthoringDraft());
      setGeneration({ kind: 'idle' });
    }
    wasOpenRef.current = open;
  }, [open]);

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
    } else {
      setGeneration({ kind: 'failed', message: generationResult.error });
    }
  }, [generationResult, open]);

  const cancelActiveGeneration = React.useCallback(() => {
    const token = activeTokenRef.current;
    if (token) {
      cancelGeneration(token);
      activeTokenRef.current = undefined;
    }
    setGeneration({ kind: 'idle' });
  }, [cancelGeneration]);

  const updateAuthoringInput = React.useCallback((
    update: (current: WorkshopCreativeVariationsDraft) => WorkshopCreativeVariationsDraft
  ) => {
    cancelActiveGeneration();
    setDraft((current) => {
      const next = update(current);
      return next === current
        ? current
        : { ...next, workup: null, selections: [] };
    });
  }, [cancelActiveGeneration]);

  const handleSubjectSelection = React.useCallback((payload: SelectionDataPayload) => {
    if (payload.target !== 'workshop_creative_variations_subject') {
      return;
    }
    const provenance = payload.sourceUri && payload.relativePath
      ? {
          kind: 'excerpt' as const,
          relativePath: payload.relativePath,
          ...(payload.startLine !== undefined ? { startLine: payload.startLine } : {}),
          ...(payload.endLine !== undefined ? { endLine: payload.endLine } : {})
        }
      : { kind: 'pasted' as const };
    updateAuthoringInput((current) => ({
      ...current,
      subject: { text: payload.content, provenance }
    }));
  }, [updateAuthoringInput]);

  const changeSubjectText = React.useCallback((text: string) => {
    updateAuthoringInput((current) => {
      if (text === current.subject.text) {
        return current;
      }
      return {
        ...current,
        subject: {
          text,
          provenance: current.subject.provenance.kind === 'excerpt'
            ? { kind: 'pasted' }
            : current.subject.provenance
        }
      };
    });
  }, [updateAuthoringInput]);

  const changeSurroundingContext = React.useCallback((writerText: string) => {
    updateAuthoringInput((current) => writerText === current.surroundingContext.writerText
      ? current
      : {
          ...current,
          surroundingContext: { ...current.surroundingContext, writerText }
        });
  }, [updateAuthoringInput]);

  const toggleSourceReference = React.useCallback((reference: WorkshopWidgetSourceReference) => {
    updateAuthoringInput((current) => {
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
    updateAuthoringInput((current) => mustSurvive === current.invariants.mustSurvive
      ? current
      : { ...current, invariants: { ...current.invariants, mustSurvive } });
  }, [updateAuthoringInput]);

  const changeMustNotChange = React.useCallback((mustNotChange: string) => {
    updateAuthoringInput((current) => mustNotChange === current.invariants.mustNotChange
      ? current
      : { ...current, invariants: { ...current.invariants, mustNotChange } });
  }, [updateAuthoringInput]);

  const changeAim = React.useCallback((aim: string) => {
    updateAuthoringInput((current) => aim === current.intent.aim
      ? current
      : { ...current, intent: { ...current.intent, aim } });
  }, [updateAuthoringInput]);

  const changeDistance = React.useCallback((distance: WorkshopCreativeVariationsDistance) => {
    updateAuthoringInput((current) => distance === current.intent.distance
      ? current
      : { ...current, intent: { ...current.intent, distance } });
  }, [updateAuthoringInput]);

  const changeRequestedCount = React.useCallback((
    requestedCount: WorkshopCreativeVariationsRequestedCount
  ) => {
    updateAuthoringInput((current) => requestedCount === current.requestedCount
      ? current
      : { ...current, requestedCount });
  }, [updateAuthoringInput]);

  React.useEffect(() => {
    const previousWidgetModelId = previousWidgetModelIdRef.current;
    previousWidgetModelIdRef.current = widgetModelId;
    if (!open || previousWidgetModelId === widgetModelId) {
      return;
    }
    updateAuthoringInput((current) => current.workup || current.selections.length > 0
      ? { ...current }
      : current);
  }, [open, updateAuthoringInput, widgetModelId]);

  const generateWorkup = React.useCallback(() => {
    cancelActiveGeneration();
    setDraft((current) => ({ ...current, workup: null, selections: [] }));
    activeTokenRef.current = generate(draft);
    setGeneration({ kind: 'generating', detail: 'Requesting variations' });
  }, [cancelActiveGeneration, draft, generate]);

  const cancelGenerate = React.useCallback(() => {
    cancelActiveGeneration();
  }, [cancelActiveGeneration]);

  const toggleCardSelection = React.useCallback((position: number) => {
    setDraft((current) => {
      const card = current.workup?.cards.find((candidate) => candidate.position === position);
      if (!card || card.invariantFlags.some((flag) => flag.kind === 'hard-conflict')) {
        return current;
      }
      const selected = current.selections.some((selection) => selection.position === position);
      return {
        ...current,
        selections: selected
          ? current.selections.filter((selection) => selection.position !== position)
          : [
              ...current.selections,
              { position, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }
            ].sort((left, right) => left.position - right.position)
      };
    });
  }, []);

  const changeCarryMode = React.useCallback((
    position: number,
    carryMode: WorkshopCreativeVariationsCarryMode
  ) => {
    setDraft((current) => ({
      ...current,
      selections: current.selections.map((selection) => selection.position === position
        ? { ...selection, carryMode }
        : selection)
    }));
  }, []);

  const toggleAdvisoryRisk = React.useCallback((position: number, riskId: string) => {
    setDraft((current) => {
      const card = current.workup?.cards.find((candidate) => candidate.position === position);
      const validRisk = card?.invariantFlags.some(
        (flag) => flag.id === riskId && flag.kind === 'advisory-risk'
      );
      if (!validRisk) {
        return current;
      }
      return {
        ...current,
        selections: current.selections.map((selection) => {
          if (selection.position !== position) {
            return selection;
          }
          const accepted = selection.acceptedAdvisoryRiskIds.includes(riskId);
          return {
            ...selection,
            acceptedAdvisoryRiskIds: accepted
              ? selection.acceptedAdvisoryRiskIds.filter((candidate) => candidate !== riskId)
              : [...selection.acceptedAdvisoryRiskIds, riskId]
          };
        })
      };
    });
  }, []);

  const changeNote = React.useCallback((note: string) => {
    setDraft((current) => ({ ...current, note }));
  }, []);

  const availableSources = React.useMemo<CreativeVariationsAvailableSource[]>(() => [
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

  const commitBlockers = React.useMemo<CreativeVariationsCommitBlocker[]>(() => {
    const blockers: CreativeVariationsCommitBlocker[] = [];
    if (generation.kind === 'generating') {
      blockers.push('generation-in-flight');
    }
    if (!draft.workup) {
      blockers.push('no-workup');
      return blockers;
    }
    if (draft.selections.length === 0) {
      blockers.push('no-selection');
      return blockers;
    }
    const hasUnacceptedRisk = draft.selections.some((selection) => {
      const card = draft.workup?.cards.find(
        (candidate) => candidate.position === selection.position
      );
      return card?.invariantFlags.some(
        (flag) => flag.kind === 'advisory-risk'
          && !selection.acceptedAdvisoryRiskIds.includes(flag.id)
      );
    });
    if (hasUnacceptedRisk) {
      blockers.push('unaccepted-advisory-risk');
    }
    return blockers;
  }, [draft.selections, draft.workup, generation.kind]);

  return {
    draft,
    generation,
    commitBlockers,
    availableSources,
    requestSubjectSelection,
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
    toggleAdvisoryRisk,
    changeNote,
    persistedState: {}
  };
}
