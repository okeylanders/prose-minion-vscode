/**
 * Webview transport owner for Show vs. Tell generation and beat intake.
 *
 * Correlation rules (Slice 2 handoff): the webview mints a fresh token per
 * Generate and per Regenerate and keeps one in-flight token. The host mints
 * the workup id; the first correlated callback latches it. Messages for any
 * token (or workup id) this hook is not waiting on are ignored.
 *
 * A `cancelled` progress phase ends the attempt: the host posts no result for
 * a cancelled token. A `completed` phase is terminal for success *and*
 * failure, and the host posts the one result immediately after it, so the
 * attempt keeps its token only until that result arrives (or is ignored by
 * the next Generate). The outcome always comes from the result.
 *
 * Commit has its own token (`requestToken`), one in flight at a time. The
 * webview mints it and the host echoes it on the action result, so a late or
 * foreign acknowledgement can never settle another attempt.
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  createWorkshopWidgetActionRequestToken
} from '@hooks/domain/workshop/createWorkshopWidgetActionRequestToken';
import {
  reportWorkshopWidgetActionCorrelationIssue
} from '@hooks/domain/workshop/reportWorkshopWidgetActionCorrelationIssue';
import {
  MessageType,
  type WorkshopShowVsTellCommitPayload,
  type WorkshopShowVsTellGenerationProgressMessage,
  type WorkshopShowVsTellGenerationProgressPayload,
  type WorkshopShowVsTellResultMessage,
  type WorkshopShowVsTellResultPayload,
  type WorkshopWidgetActionResultMessage,
  type WorkshopWidgetActionResultPayload
} from '@messages';
import type {
  ShowVsTellGenerationInput
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';

interface ActiveShowVsTellAttempt {
  token: string;
  /** Minted by the host and latched from the first correlated callback. */
  workupId?: string;
}

let showVsTellTokenCounter = 0;

const createShowVsTellRequestToken = (): string =>
  `show-vs-tell-${Date.now()}-${++showVsTellTokenCounter}`;

let showVsTellPassageRequestCounter = 0;

/** One id per Use selection ask; the host echoes it so a late reply can be matched or dropped. */
const createShowVsTellPassageRequestId = (): string =>
  `show-vs-tell-passage-${Date.now()}-${++showVsTellPassageRequestCounter}`;

export type ShowVsTellCommitResult = Extract<
  WorkshopWidgetActionResultPayload,
  { action: 'commit'; widgetId: 'show-vs-tell' }
>;

export interface ShowVsTellState {
  generationProgress: WorkshopShowVsTellGenerationProgressPayload | null;
  generationResult: WorkshopShowVsTellResultPayload | null;
  commitPending: boolean;
  commitResult: ShowVsTellCommitResult | null;
}

export interface ShowVsTellActions {
  requestBeatSelection: () => void;
  /**
   * Fills the writer's surrounding-passage box from the editor selection (D2).
   * Returns the correlation id the host will echo on the reply.
   */
  requestPassageSelection: () => string;
  /** Returns the freshly minted correlation token. */
  generate: (input: ShowVsTellGenerationInput) => string;
  cancelGeneration: (token?: string) => void;
  /** Returns the minted request token, or undefined while another commit is in flight. */
  commit: (
    payload: Omit<WorkshopShowVsTellCommitPayload, 'requestToken'>
  ) => string | undefined;
  handleCommitResult: (message: WorkshopWidgetActionResultMessage) => void;
  clearCommitResult: () => void;
  /** Recover a newly opened sheet from an acknowledgement lost with an older surface. */
  resetCommitState: () => void;
  handleGenerationProgress: (message: WorkshopShowVsTellGenerationProgressMessage) => void;
  handleGenerationResult: (message: WorkshopShowVsTellResultMessage) => void;
}

export interface ShowVsTellPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseShowVsTellReturn = ShowVsTellState &
  ShowVsTellActions & {
    persistedState: ShowVsTellPersistence;
  };

export function useShowVsTell(): UseShowVsTellReturn {
  const vscode = useVSCodeApi();
  const activeAttemptRef = React.useRef<ActiveShowVsTellAttempt>();
  const activeCommitTokenRef = React.useRef<string>();
  const [generationProgress, setGenerationProgress] =
    React.useState<WorkshopShowVsTellGenerationProgressPayload | null>(null);
  const [generationResult, setGenerationResult] =
    React.useState<WorkshopShowVsTellResultPayload | null>(null);
  const [commitPending, setCommitPending] = React.useState(false);
  const [commitResult, setCommitResult] = React.useState<ShowVsTellCommitResult | null>(null);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({
      type,
      source: 'webview.workshop.show-vs-tell',
      payload,
      timestamp: Date.now()
    });
  }, [vscode]);

  const requestBeatSelection = React.useCallback(() => {
    post(MessageType.REQUEST_SELECTION, { target: 'workshop_show_vs_tell_beat' });
  }, [post]);

  const requestPassageSelection = React.useCallback((): string => {
    const requestId = createShowVsTellPassageRequestId();
    post(MessageType.REQUEST_SELECTION, { target: 'workshop_show_vs_tell_passage', requestId });
    return requestId;
  }, [post]);

  const generate = React.useCallback((input: ShowVsTellGenerationInput): string => {
    const token = createShowVsTellRequestToken();
    activeAttemptRef.current = { token };
    setGenerationProgress(null);
    setGenerationResult(null);
    // Named fields only: the writer's passage text and the source references
    // cross as the surrounding context; resolved source text never does.
    post(MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE, {
      widgetId: 'show-vs-tell',
      token,
      beat: input.beat,
      surroundingContext: input.surroundingContext,
      pov: input.pov,
      invariants: input.invariants,
      channels: input.channels,
      lengthBudget: input.lengthBudget,
      position: input.position
    });
    return token;
  }, [post]);

  const cancelGeneration = React.useCallback((token?: string) => {
    const active = activeAttemptRef.current;
    if (active && token !== undefined && token !== active.token) {
      return;
    }
    if (active) {
      vscode.postMessage(
        createCancelRequestMessage(
          'workshop-show-vs-tell',
          active.token,
          'webview.workshop.show-vs-tell'
        )
      );
    }
    activeAttemptRef.current = undefined;
    setGenerationProgress(null);
    setGenerationResult(null);
  }, [vscode]);

  const commit = React.useCallback((
    payload: Omit<WorkshopShowVsTellCommitPayload, 'requestToken'>
  ): string | undefined => {
    if (activeCommitTokenRef.current !== undefined) {
      return undefined;
    }
    const requestToken = createWorkshopWidgetActionRequestToken('commit');
    activeCommitTokenRef.current = requestToken;
    setCommitPending(true);
    setCommitResult(null);
    // The draft rides unchanged; the host compiles the artifact itself.
    post(MessageType.WORKSHOP_COMMIT_WIDGET, { ...payload, requestToken });
    return requestToken;
  }, [post]);

  const handleCommitResult = React.useCallback((
    message: WorkshopWidgetActionResultMessage
  ) => {
    if (message.payload.action !== 'commit') {
      return;
    }
    const expectedToken = activeCommitTokenRef.current;
    if (message.payload.widgetId !== 'show-vs-tell') {
      if (message.payload.requestToken === expectedToken) {
        reportWorkshopWidgetActionCorrelationIssue(
          'useShowVsTell',
          message,
          'expected widget show-vs-tell'
        );
      }
      return;
    }
    if (message.payload.requestToken !== expectedToken) {
      reportWorkshopWidgetActionCorrelationIssue(
        'useShowVsTell',
        message,
        'no current commit request owns this token'
      );
      return;
    }
    activeCommitTokenRef.current = undefined;
    setCommitPending(false);
    setCommitResult(message.payload);
  }, []);

  const clearCommitResult = React.useCallback(() => {
    setCommitResult(null);
  }, []);

  const resetCommitState = React.useCallback(() => {
    activeCommitTokenRef.current = undefined;
    setCommitPending(false);
    setCommitResult(null);
  }, []);

  const handleGenerationProgress = React.useCallback(
    (message: WorkshopShowVsTellGenerationProgressMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'show-vs-tell'
        || payload.token !== active.token
        || (active.workupId !== undefined && payload.workupId !== active.workupId)
      ) {
        return;
      }
      active.workupId = payload.workupId;
      setGenerationProgress(payload);
      if (payload.phase === 'cancelled') {
        activeAttemptRef.current = undefined;
      }
    },
    []
  );

  const handleGenerationResult = React.useCallback(
    (message: WorkshopShowVsTellResultMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'show-vs-tell'
        || payload.token !== active.token
        || (active.workupId !== undefined && payload.workupId !== active.workupId)
        || (payload.ok && payload.workup.workupId !== payload.workupId)
      ) {
        return;
      }
      activeAttemptRef.current = undefined;
      setGenerationProgress(null);
      setGenerationResult(payload);
    },
    []
  );

  return {
    generationProgress,
    generationResult,
    commitPending,
    commitResult,
    requestBeatSelection,
    requestPassageSelection,
    generate,
    cancelGeneration,
    commit,
    handleCommitResult,
    clearCommitResult,
    resetCommitState,
    handleGenerationProgress,
    handleGenerationResult,
    persistedState: {}
  };
}
