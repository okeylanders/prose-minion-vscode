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
 * A passage selection reply is bound to the request that asked for it
 * (PR #140 review, F-01): the transport mints a correlation id per ask, the
 * host echoes it, and only the one live id is accepted. The live id is
 * dropped when another ask supersedes it, when the writer edits the box or
 * uses the excerpt, when the sheet opens or closes, when the room changes,
 * and when a generation or a commit begins; a dropped id stays dropped after
 * the generation or commit settles, so a clipboard read that outlives any of
 * those can never overwrite newer work.
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
  /** Host revision of the room; a change invalidates any outstanding passage request. */
  roomKey: string;
  /** A generation or commit transition invalidates any outstanding passage request. */
  generationActive: boolean;
  commitPending: boolean;
  requestBeatSelection: () => void;
  /** Asks the host for the editor selection and returns the correlation id it will echo. */
  requestPassageSelection: () => string;
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
  /** Clears both notices and any outstanding passage request; the controller calls it when the sheet opens. */
  resetIntake: () => void;
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
  roomKey,
  generationActive,
  commitPending,
  requestBeatSelection,
  requestPassageSelection,
  isIntakeLocked,
  updateGenerationInput
}: UseShowVsTellIntakeOptions): UseShowVsTellIntakeReturn {
  const [intakeNotice, setIntakeNotice] = React.useState<string | null>(null);
  const [passageNotice, setPassageNotice] = React.useState<string | null>(null);
  /** The one passage request whose reply is still wanted; undefined when none is. */
  const livePassageRequestRef = React.useRef<string>();

  // Every lifecycle edge that makes an outstanding ask stale drops its id.
  // The drop is permanent: nothing restores an id once a transition began.
  React.useEffect(() => {
    livePassageRequestRef.current = undefined;
  }, [open, roomKey]);
  React.useEffect(() => {
    if (generationActive || commitPending) {
      livePassageRequestRef.current = undefined;
    }
  }, [commitPending, generationActive]);

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

  /** A writer edit of the box makes any outstanding ask stale. */
  const changePassageText = React.useCallback((raw: string) => {
    livePassageRequestRef.current = undefined;
    applyPassage(raw);
  }, [applyPassage]);

  const usePassageFromExcerpt = React.useCallback(() => {
    if (!activeExcerpt || isIntakeLocked()) {
      return;
    }
    livePassageRequestRef.current = undefined;
    applyPassage(activeExcerpt.text);
  }, [activeExcerpt, applyPassage, isIntakeLocked]);

  /** A new ask supersedes the previous one: only the newest id is ever live. */
  const requestSelection = React.useCallback(() => {
    if (!isIntakeLocked()) {
      livePassageRequestRef.current = requestPassageSelection();
    }
  }, [isIntakeLocked, requestPassageSelection]);

  const handlePassageSelection = React.useCallback((message: SelectionDataMessage) => {
    // Only the reply to the live ask, while the sheet is open and idle, fills
    // the box. Anything else is dropped, never queued (Slice 4, F-01; PR #140
    // F-01): the writer can ask again once the host answers.
    const { target, requestId } = message.payload;
    const live = livePassageRequestRef.current;
    if (
      !open
      || isIntakeLocked()
      || target !== 'workshop_show_vs_tell_passage'
      || live === undefined
      || requestId !== live
    ) {
      return;
    }
    livePassageRequestRef.current = undefined;
    applyPassage(message.payload.content);
  }, [applyPassage, isIntakeLocked, open]);

  const toggleSourceReference = React.useCallback((reference: WorkshopWidgetSourceReference) => {
    updateGenerationInput('context sources', (current) =>
      withShowVsTellSourceReferenceToggled(current, reference));
  }, [updateGenerationInput]);

  const resetIntake = React.useCallback(() => {
    livePassageRequestRef.current = undefined;
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
    changePassageText,
    usePassageFromExcerpt,
    requestPassageSelection: requestSelection,
    handlePassageSelection,
    toggleSourceReference,
    resetIntake,
    persistedState: {}
  };
}
