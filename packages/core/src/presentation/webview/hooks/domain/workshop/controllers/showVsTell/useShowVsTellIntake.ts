/**
 * Intake for the Show vs. Tell authoring controller: the beat, the
 * surrounding passage, and the context sources.
 *
 * Split from the controller so each stays one honest owner: the controller
 * owns the draft and the invalidation rule, and this hook owns how text gets
 * onto the sheet (typed, pasted, from the editor selection, or, for the
 * passage, from the excerpt) and how context sources are toggled (Slice 7,
 * D2). Every change here flows through the controller's generation-input
 * gate, so it invalidates the workup exactly as any other generation input
 * does, and is refused while a commit is pending.
 *
 * Transport-free by contract: the selection requests are injected callbacks.
 */

import * as React from 'react';
import type {
  SelectionDataMessage,
  WorkshopExcerptSnapshot,
  WorkshopShowVsTellDraft,
  WorkshopWidgetSourceReference
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  beatFromSelection,
  beatWithEditedText,
  collapseShowVsTellLineBreaks,
  sameBeat,
  type ShowVsTellInputLabel
} from './showVsTellAuthoringRules';
import {
  showVsTellPassageFromText,
  withShowVsTellPassageText,
  withShowVsTellSourceReferenceToggled
} from './showVsTellSourceRules';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

export interface UseShowVsTellIntakeOptions {
  open: boolean;
  activeExcerpt: WorkshopExcerptSnapshot | null;
  requestBeatSelection: () => void;
  requestPassageSelection: () => void;
  /** True while an attempt is in flight or a commit is pending: intake replies are dropped. */
  isIntakeLocked: () => boolean;
  /** The controller's one gate for generation inputs. */
  updateGenerationInput: (
    label: ShowVsTellInputLabel,
    update: (current: WorkshopShowVsTellDraft) => WorkshopShowVsTellDraft
  ) => void;
}

export interface ShowVsTellIntakeState {
  /** Visible explanation when intake had to shorten a selection into a beat. */
  intakeNotice: string | null;
  /** Visible explanation when intake had to shorten text to the passage allowance. */
  passageNotice: string | null;
  /** Whether Use excerpt has anything to copy. */
  canUsePassageFromExcerpt: boolean;
}

export interface ShowVsTellIntakeActions {
  requestBeatSelection: () => void;
  handleBeatSelection: (message: SelectionDataMessage) => void;
  changeBeatText: (text: string) => void;
  changePassageText: (text: string) => void;
  usePassageFromExcerpt: () => void;
  requestPassageSelection: () => void;
  handlePassageSelection: (message: SelectionDataMessage) => void;
  toggleSourceReference: (reference: WorkshopWidgetSourceReference) => void;
  /** Clears both notices; the controller calls it when the sheet opens. */
  resetNotices: () => void;
}

/** Explicitly empty: the host owns durable truth. */
export interface ShowVsTellIntakePersistence {
  // Nothing here is persisted.
}

export type UseShowVsTellIntakeReturn = ShowVsTellIntakeState &
  ShowVsTellIntakeActions & {
    persistedState: ShowVsTellIntakePersistence;
  };

export function useShowVsTellIntake({
  open,
  activeExcerpt,
  requestBeatSelection,
  requestPassageSelection,
  isIntakeLocked,
  updateGenerationInput
}: UseShowVsTellIntakeOptions): UseShowVsTellIntakeReturn {
  const [intakeNotice, setIntakeNotice] = React.useState<string | null>(null);
  const [passageNotice, setPassageNotice] = React.useState<string | null>(null);

  const handleBeatSelection = React.useCallback((message: SelectionDataMessage) => {
    /* Normal delivery is target-routed; retain the check for direct hook consumers. */
    if (!open || isIntakeLocked() || message.payload.target !== 'workshop_show_vs_tell_beat') {
      return;
    }
    const { beat, notice } = beatFromSelection(message.payload);
    setIntakeNotice(notice);
    updateGenerationInput('beat', (current) => sameBeat(beat, current.beat)
      ? current
      : { ...current, beat });
  }, [isIntakeLocked, open, updateGenerationInput]);

  const changeBeatText = React.useCallback((raw: string) => {
    const text = collapseShowVsTellLineBreaks(raw).slice(0, BUDGET.showVsTellBeatCharacters);
    setIntakeNotice(null);
    updateGenerationInput('beat', (current) => text === current.beat.text
      ? current
      : { ...current, beat: beatWithEditedText(current.beat, text) });
  }, [updateGenerationInput]);

  const applyPassage = React.useCallback((raw: string) => {
    const { text, notice } = showVsTellPassageFromText(raw);
    setPassageNotice(notice);
    updateGenerationInput('surrounding passage', (current) =>
      withShowVsTellPassageText(current, text));
  }, [updateGenerationInput]);

  const usePassageFromExcerpt = React.useCallback(() => {
    if (!activeExcerpt || isIntakeLocked()) {
      return;
    }
    applyPassage(activeExcerpt.text);
  }, [activeExcerpt, applyPassage, isIntakeLocked]);

  const requestSelection = React.useCallback(() => {
    if (!isIntakeLocked()) {
      requestPassageSelection();
    }
  }, [isIntakeLocked, requestPassageSelection]);

  const handlePassageSelection = React.useCallback((message: SelectionDataMessage) => {
    // A late reply during an attempt or a pending commit is dropped, never
    // queued (Slice 4, F-01): the writer can ask again once the host answers.
    if (!open || isIntakeLocked() || message.payload.target !== 'workshop_show_vs_tell_passage') {
      return;
    }
    applyPassage(message.payload.content);
  }, [applyPassage, isIntakeLocked, open]);

  const toggleSourceReference = React.useCallback((reference: WorkshopWidgetSourceReference) => {
    updateGenerationInput('context sources', (current) =>
      withShowVsTellSourceReferenceToggled(current, reference));
  }, [updateGenerationInput]);

  const resetNotices = React.useCallback(() => {
    setIntakeNotice(null);
    setPassageNotice(null);
  }, []);

  return {
    intakeNotice,
    passageNotice,
    canUsePassageFromExcerpt: activeExcerpt !== null,
    requestBeatSelection,
    handleBeatSelection,
    changeBeatText,
    changePassageText: applyPassage,
    usePassageFromExcerpt,
    requestPassageSelection: requestSelection,
    handlePassageSelection,
    toggleSourceReference,
    resetNotices,
    persistedState: {}
  };
}
