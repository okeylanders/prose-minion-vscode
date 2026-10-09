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
 */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  MessageType,
  type WorkshopShowVsTellGenerationProgressMessage,
  type WorkshopShowVsTellGenerationProgressPayload,
  type WorkshopShowVsTellResultMessage,
  type WorkshopShowVsTellResultPayload
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

export interface ShowVsTellState {
  generationProgress: WorkshopShowVsTellGenerationProgressPayload | null;
  generationResult: WorkshopShowVsTellResultPayload | null;
}

export interface ShowVsTellActions {
  requestBeatSelection: () => void;
  /** Returns the freshly minted correlation token. */
  generate: (input: ShowVsTellGenerationInput) => string;
  cancelGeneration: (token?: string) => void;
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
  const [generationProgress, setGenerationProgress] =
    React.useState<WorkshopShowVsTellGenerationProgressPayload | null>(null);
  const [generationResult, setGenerationResult] =
    React.useState<WorkshopShowVsTellResultPayload | null>(null);

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

  const generate = React.useCallback((input: ShowVsTellGenerationInput): string => {
    const token = createShowVsTellRequestToken();
    activeAttemptRef.current = { token };
    setGenerationProgress(null);
    setGenerationResult(null);
    // Named fields only: passage text never crosses, only the source reference.
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
    requestBeatSelection,
    generate,
    cancelGeneration,
    handleGenerationProgress,
    handleGenerationResult,
    persistedState: {}
  };
}
