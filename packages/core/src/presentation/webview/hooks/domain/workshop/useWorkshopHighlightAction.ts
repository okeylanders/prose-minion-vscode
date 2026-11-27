import * as React from 'react';
import { MessageType } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export type WorkshopHighlightAction = (action: 'show' | 'clear', turnId: string) => void;

export function useWorkshopHighlightAction(roomRevision: number | undefined): WorkshopHighlightAction {
  const vscode = useVSCodeApi();
  return React.useCallback((action, turnId) => {
    if (roomRevision === undefined) {
      return;
    }
    vscode.postMessage({
      type: action === 'show' ? MessageType.WORKSHOP_SHOW_HIGHLIGHTS : MessageType.WORKSHOP_CLEAR_HIGHLIGHTS,
      source: 'webview.workshop',
      payload: { roomRevision, turnId },
      timestamp: Date.now()
    });
  }, [roomRevision, vscode]);
}
