/** Generic webview owner for standing-directive lifecycle actions. */

import * as React from 'react';
import { WorkshopToastState } from '@components/workshop/WorkshopToast';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import {
  createWorkshopWidgetActionRequestToken
} from '@hooks/domain/workshop/createWorkshopWidgetActionRequestToken';
import {
  MessageType,
  WorkshopStandingDirectiveFamily,
  WorkshopWidgetActionResultMessage
} from '@messages';
import { workshopWidgetLabel } from '@shared/constants/workshopWidgets';

export type StandingDirectiveIdentity = {
  [Family in WorkshopStandingDirectiveFamily]: {
    family: Family;
    widgetId: Family;
  }
}[WorkshopStandingDirectiveFamily];

export interface WorkshopStandingDirectiveActions {
  remove: (directive: StandingDirectiveIdentity) => void;
  handleActionResult: (message: WorkshopWidgetActionResultMessage) => void;
}

export interface WorkshopStandingDirectivePersistence {
  // Host/session storage owns every durable value in this domain.
}

export type UseWorkshopStandingDirectivesReturn = WorkshopStandingDirectiveActions & {
  persistedState: WorkshopStandingDirectivePersistence;
};

export function useWorkshopStandingDirectives(
  showToast: (toast: WorkshopToastState) => void
): UseWorkshopStandingDirectivesReturn {
  const vscode = useVSCodeApi();
  const pendingRemovalRef = React.useRef<{
    requestToken: string;
    widgetId: StandingDirectiveIdentity['widgetId'];
  }>();

  const remove = React.useCallback((directive: StandingDirectiveIdentity) => {
    const requestToken = createWorkshopWidgetActionRequestToken('remove-standing');
    pendingRemovalRef.current = { requestToken, widgetId: directive.widgetId };
    vscode.postMessage({
      type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      source: 'webview.workshop.standing-directives',
      payload: { requestToken, family: directive.family },
      timestamp: Date.now()
    });
  }, [vscode]);

  const handleActionResult = React.useCallback((message: WorkshopWidgetActionResultMessage) => {
    const pending = pendingRemovalRef.current;
    if (
      message.payload.action !== 'remove-standing'
      || message.payload.requestToken !== pending?.requestToken
      || message.payload.widgetId !== pending.widgetId
    ) {
      return;
    }

    pendingRemovalRef.current = undefined;
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
  }, [showToast]);

  return { remove, handleActionResult, persistedState: {} };
}
