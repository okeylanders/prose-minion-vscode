/** Generic webview owner for standing-directive lifecycle actions. */

import * as React from 'react';
import { WorkshopToastState } from '@components/workshop/WorkshopToast';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  createWorkshopWidgetActionRequestToken
} from '@hooks/domain/workshop/createWorkshopWidgetActionRequestToken';
import {
  reportWorkshopWidgetActionCorrelationIssue
} from '@hooks/domain/workshop/reportWorkshopWidgetActionCorrelationIssue';
import {
  formatLexicalGravitySummary
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityDirective';
import {
  MessageType,
  WorkshopStandingDirectiveFamily,
  WorkshopStandingDirectiveSummary,
  WorkshopWidgetActionResultMessage
} from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

const REMOVE_ACK_TIMEOUT_MS = 10_000;

export type StandingDirectiveIdentity = {
  [Family in WorkshopStandingDirectiveFamily]: {
    family: Family;
    widgetId: Family;
  }
}[WorkshopStandingDirectiveFamily];

export interface WorkshopStandingDirectiveState {
  removingWidgetIds: readonly StandingDirectiveIdentity['widgetId'][];
}

export interface WorkshopStandingDirectiveActions {
  remove: (directive: StandingDirectiveIdentity) => void;
  handleActionResult: (message: WorkshopWidgetActionResultMessage) => void;
  formatSummary: (summary: WorkshopStandingDirectiveSummary) => string;
}

export interface WorkshopStandingDirectivePersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopStandingDirectivesReturn = WorkshopStandingDirectiveState &
  WorkshopStandingDirectiveActions & {
    persistedState: WorkshopStandingDirectivePersistence;
  };

interface PendingRemoval {
  widgetId: StandingDirectiveIdentity['widgetId'];
  timeoutId: number;
}

const unsupportedSummaryFamily = (family: never): never => {
  throw new Error(`Unsupported standing directive summary family: ${String(family)}`);
};

const formatStandingDirectiveSummary = (
  summary: WorkshopStandingDirectiveSummary
): string => {
  switch (summary.family) {
    case 'lexical-gravity':
      return formatLexicalGravitySummary(summary);
    default:
      return unsupportedSummaryFamily(summary.family);
  }
};

export function useWorkshopStandingDirectives(
  showToast: (toast: WorkshopToastState) => void
): UseWorkshopStandingDirectivesReturn {
  const vscode = useVSCodeApi();
  const pendingRemovalsRef = React.useRef(new Map<string, PendingRemoval>());
  const [removingWidgetIds, setRemovingWidgetIds] =
    React.useState<readonly StandingDirectiveIdentity['widgetId'][]>([]);

  const syncRemovingWidgetIds = React.useCallback(() => {
    setRemovingWidgetIds(Array.from(
      new Set(Array.from(pendingRemovalsRef.current.values(), ({ widgetId }) => widgetId))
    ));
  }, []);

  React.useEffect(() => () => {
    pendingRemovalsRef.current.forEach(({ timeoutId }) => window.clearTimeout(timeoutId));
    pendingRemovalsRef.current.clear();
  }, []);

  const remove = React.useCallback((directive: StandingDirectiveIdentity) => {
    const label = workshopWidgetLabel(directive.widgetId);
    const alreadyPending = Array.from(pendingRemovalsRef.current.values())
      .some(({ widgetId }) => widgetId === directive.widgetId);
    if (alreadyPending) {
      showToast({ message: `${label} removal is already in progress.`, icon: 'info' });
      return;
    }

    const requestToken = createWorkshopWidgetActionRequestToken('remove-standing');
    const timeoutId = window.setTimeout(() => {
      const pending = pendingRemovalsRef.current.get(requestToken);
      if (!pending) {return;}
      pendingRemovalsRef.current.delete(requestToken);
      syncRemovingWidgetIds();
      console.warn(
        '[useWorkshopStandingDirectives] Remove acknowledgement timed out',
        { requestToken, widgetId: pending.widgetId }
      );
      showToast({
        message: `${workshopWidgetLabel(pending.widgetId)} removal was not confirmed.`,
        icon: 'x',
        tone: 'error'
      });
    }, REMOVE_ACK_TIMEOUT_MS);
    pendingRemovalsRef.current.set(requestToken, {
      widgetId: directive.widgetId,
      timeoutId
    });
    syncRemovingWidgetIds();
    vscode.postMessage({
      type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      source: 'webview.workshop.standing-directives',
      payload: { requestToken, family: directive.family },
      timestamp: Date.now()
    });
  }, [showToast, syncRemovingWidgetIds, vscode]);

  const handleActionResult = React.useCallback((message: WorkshopWidgetActionResultMessage) => {
    if (message.payload.action !== 'remove-standing') {
      return;
    }

    const pending = pendingRemovalsRef.current.get(message.payload.requestToken);
    if (!pending) {
      reportWorkshopWidgetActionCorrelationIssue(
        'useWorkshopStandingDirectives',
        message,
        'no pending request owns this token'
      );
      return;
    }
    if (message.payload.widgetId !== pending.widgetId) {
      reportWorkshopWidgetActionCorrelationIssue(
        'useWorkshopStandingDirectives',
        message,
        `expected widget ${pending.widgetId}`
      );
      return;
    }

    window.clearTimeout(pending.timeoutId);
    pendingRemovalsRef.current.delete(message.payload.requestToken);
    syncRemovingWidgetIds();
    const label = workshopWidgetLabel(message.payload.widgetId);
    showToast(message.payload.ok
      ? {
          message: message.payload.removed
            ? `${label} removed.`
            : `${label} was already removed.`,
          icon: message.payload.removed ? 'check' : 'info'
        }
      : {
          message: message.payload.message ?? `${label} could not be removed.`,
          icon: 'x',
          tone: 'error'
        });
  }, [showToast, syncRemovingWidgetIds]);

  return {
    removingWidgetIds,
    remove,
    handleActionResult,
    formatSummary: formatStandingDirectiveSummary,
    persistedState: {}
  };
}
