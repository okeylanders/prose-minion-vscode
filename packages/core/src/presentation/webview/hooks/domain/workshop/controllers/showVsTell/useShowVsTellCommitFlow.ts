/**
 * Commit acknowledgement flow for the Show vs. Tell authoring controller.
 *
 * Split from the controller so each stays one honest owner: the controller
 * owns the draft and where it was seeded from, and this hook owns what the
 * host said about one commit. Transport-free by contract: the commit itself
 * and its outcome arrive as injected callbacks and values.
 *
 * A sheet that opens while an older acknowledgement is still held must not
 * act on it, so opening records the outcome it found and ignores exactly that
 * one. The opening effect is declared before the outcome effect on purpose:
 * on the render that opens the sheet it must run first.
 */

import * as React from 'react';
import type { WorkshopShowVsTellDraft } from '@messages';

export interface ShowVsTellCommitOutcome {
  ok: boolean;
  message?: string;
}

export interface UseShowVsTellCommitFlowOptions {
  open: boolean;
  commitOutcome: ShowVsTellCommitOutcome | null;
  commit: (draft: WorkshopShowVsTellDraft, clonedFromConfigId?: string) => void;
  clearCommitResult: () => void;
  resetCommitState: () => void;
  onCommitAccepted: () => void;
}

export interface ShowVsTellCommitFlowState {
  commitError: string | null;
}

export interface ShowVsTellCommitFlowActions {
  submitCommit: (draft: WorkshopShowVsTellDraft, clonedFromConfigId?: string) => void;
}

/** Explicitly empty: the host owns durable truth. */
export interface ShowVsTellCommitFlowPersistence {
  // Nothing here is persisted.
}

export type UseShowVsTellCommitFlowReturn = ShowVsTellCommitFlowState &
  ShowVsTellCommitFlowActions & {
    persistedState: ShowVsTellCommitFlowPersistence;
  };

export function useShowVsTellCommitFlow({
  open,
  commitOutcome,
  commit,
  clearCommitResult,
  resetCommitState,
  onCommitAccepted
}: UseShowVsTellCommitFlowOptions): UseShowVsTellCommitFlowReturn {
  const [commitError, setCommitError] = React.useState<string | null>(null);
  const ignoredOpeningOutcomeRef = React.useRef<ShowVsTellCommitOutcome | null>();
  const wasOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (open && !wasOpenRef.current) {
      ignoredOpeningOutcomeRef.current = commitOutcome;
      setCommitError(null);
      resetCommitState();
    }
    wasOpenRef.current = open;
  }, [commitOutcome, open, resetCommitState]);

  React.useEffect(() => {
    if (!open || !commitOutcome) {
      return;
    }
    if (ignoredOpeningOutcomeRef.current === commitOutcome) {
      ignoredOpeningOutcomeRef.current = null;
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
        ?? 'Show vs. Tell did not reach the room. Your exact draft is still open.'
    );
  }, [clearCommitResult, commitOutcome, onCommitAccepted, open]);

  const submitCommit = React.useCallback((
    draft: WorkshopShowVsTellDraft,
    clonedFromConfigId?: string
  ) => {
    setCommitError(null);
    clearCommitResult();
    commit(draft, clonedFromConfigId);
  }, [clearCommitResult, commit]);

  return { commitError, submitCommit, persistedState: {} };
}
