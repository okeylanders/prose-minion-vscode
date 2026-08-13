/** Webview transport owner for Creative Variations generation and intake. */

import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';
import {
  MessageType,
  type WorkshopCreativeVariationsDraft,
  type WorkshopCreativeVariationsGenerationProgressMessage,
  type WorkshopCreativeVariationsGenerationProgressPayload,
  type WorkshopCreativeVariationsResultMessage,
  type WorkshopCreativeVariationsResultPayload
} from '@messages';
import {
  creativeVariationsGenerationDraft
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';

interface ActiveCreativeVariationsAttempt {
  token: string;
  /** Minted by the host and latched from the first correlated callback. */
  workupId?: string;
}

let creativeVariationsTokenCounter = 0;

const createCreativeVariationsRequestToken = (): string =>
  `creative-variations-${Date.now()}-${++creativeVariationsTokenCounter}`;

export interface CreativeVariationsState {
  generationProgress: WorkshopCreativeVariationsGenerationProgressPayload | null;
  generationResult: WorkshopCreativeVariationsResultPayload | null;
}

export interface CreativeVariationsActions {
  requestSubjectSelection: () => void;
  generate: (draft: WorkshopCreativeVariationsDraft) => string;
  cancelGeneration: (token?: string) => void;
  handleGenerationProgress: (
    message: WorkshopCreativeVariationsGenerationProgressMessage
  ) => void;
  handleGenerationResult: (message: WorkshopCreativeVariationsResultMessage) => void;
}

export interface CreativeVariationsPersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseCreativeVariationsReturn = CreativeVariationsState &
  CreativeVariationsActions & {
    persistedState: CreativeVariationsPersistence;
  };

export function useCreativeVariations(): UseCreativeVariationsReturn {
  const vscode = useVSCodeApi();
  const activeAttemptRef = React.useRef<ActiveCreativeVariationsAttempt>();
  const [generationProgress, setGenerationProgress] =
    React.useState<WorkshopCreativeVariationsGenerationProgressPayload | null>(null);
  const [generationResult, setGenerationResult] =
    React.useState<WorkshopCreativeVariationsResultPayload | null>(null);

  const post = React.useCallback((type: MessageType, payload: object) => {
    vscode.postMessage({
      type,
      source: 'webview.workshop.creative-variations',
      payload,
      timestamp: Date.now()
    });
  }, [vscode]);

  const requestSubjectSelection = React.useCallback(() => {
    post(MessageType.REQUEST_SELECTION, {
      target: 'workshop_creative_variations_subject'
    });
  }, [post]);

  const generate = React.useCallback((draft: WorkshopCreativeVariationsDraft): string => {
    const token = createCreativeVariationsRequestToken();
    const requestDraft = creativeVariationsGenerationDraft(draft);
    activeAttemptRef.current = { token };
    setGenerationProgress(null);
    setGenerationResult(null);
    post(MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE, {
      widgetId: 'creative-variations',
      token,
      subject: requestDraft.subject,
      surroundingContext: requestDraft.surroundingContext,
      invariants: requestDraft.invariants,
      intent: requestDraft.intent,
      requestedCount: requestDraft.requestedCount
    });
    return token;
  }, [post]);

  const cancelGeneration = React.useCallback((token?: string) => {
    const active = activeAttemptRef.current;
    if (!active || (token !== undefined && token !== active.token)) {
      return;
    }
    vscode.postMessage(
      createCancelRequestMessage(
        'workshop-creative-variations',
        active.token,
        'webview.workshop.creative-variations'
      )
    );
    activeAttemptRef.current = undefined;
    setGenerationProgress(null);
    setGenerationResult(null);
  }, [vscode]);

  const handleGenerationProgress = React.useCallback(
    (message: WorkshopCreativeVariationsGenerationProgressMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'creative-variations'
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
    (message: WorkshopCreativeVariationsResultMessage) => {
      const active = activeAttemptRef.current;
      const payload = message.payload;
      if (
        !active
        || payload.widgetId !== 'creative-variations'
        || payload.token !== active.token
        || (active.workupId !== undefined && payload.workupId !== active.workupId)
        || (payload.ok && payload.workup.workupId !== payload.workupId)
      ) {
        return;
      }
      active.workupId = payload.workupId;
      activeAttemptRef.current = undefined;
      setGenerationProgress(null);
      setGenerationResult(payload);
    },
    []
  );

  return {
    generationProgress,
    generationResult,
    requestSubjectSelection,
    generate,
    cancelGeneration,
    handleGenerationProgress,
    handleGenerationResult,
    persistedState: {}
  };
}
