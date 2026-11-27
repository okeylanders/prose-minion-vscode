import * as React from 'react';
import { MessageType, type WorkshopMessageTextAction, type WorkshopMessageTextResultMessage, type WorkshopStageMessageTextPayload, type WorkshopSessionStateMessage } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

type Result = WorkshopMessageTextResultMessage['payload'];
type Command<T = WorkshopStageMessageTextPayload> = T extends unknown ? Omit<T, 'requestId' | 'roomRevision'> : never;
type Pending = {
  action: WorkshopMessageTextAction;
  attachmentId?: string;
  finish?: (result: Result) => void;
};
type Sheet = { key: string; attachmentId: string; text?: string; error?: string };

/** Only the host keeps staged bodies. The editable copy lives as long as its open sheet. */
export function useWorkshopPastedText() {
  const vscode = useVSCodeApi();
  const revision = React.useRef<number>();
  const pending = React.useRef(new Map<string, Pending>());
  const sequence = React.useRef(0);
  const prefix = React.useRef(`paste-${Math.random().toString(36).slice(2)}`);
  const [, refresh] = React.useReducer((count: number) => count + 1, 0);
  const [error, setError] = React.useState('');
  const [sheet, setSheet] = React.useState<Sheet | null>(null);
  const sheetKey = React.useRef<string>();
  const closeSheet = React.useCallback(() => {
    sheetKey.current = undefined;
    for (const [id, entry] of pending.current) {
      if (entry.action === 'read') {
        pending.current.delete(id);
      }
    }
    setSheet(null);
  }, []);

  const handleSessionState = React.useCallback(({ payload: { session } }: WorkshopSessionStateMessage) => {
    if (revision.current !== session.roomRevision) {
      pending.current.clear();
      revision.current = session.roomRevision;
      closeSheet();
      setError('');
      refresh();
    } else {
      setSheet((open) => open && !session.pendingMessageAttachments?.some((item) => item.id === open.attachmentId && item.pastedText)
        ? null : open);
    }
  }, [closeSheet]);

  React.useEffect(() => () => {
    revision.current = undefined;
    pending.current.clear();
    sheetKey.current = undefined;
  }, []);

  const handleResult = React.useCallback(({ payload }: WorkshopMessageTextResultMessage) => {
    const entry = pending.current.get(payload.requestId);
    if (!entry || payload.roomRevision !== revision.current || payload.action !== entry.action
      || (payload.ok && entry.attachmentId !== undefined && payload.attachmentId !== entry.attachmentId)) {
      return;
    }
    pending.current.delete(payload.requestId);
    refresh();
    if (!payload.ok && entry.action !== 'read' && entry.action !== 'update') {
      setError(payload.reason);
    }
    entry.finish?.(payload);
  }, []);

  const request = (command: Command, finish?: Pending['finish']) => {
    const roomRevision = revision.current;
    if (roomRevision === undefined) {
      return;
    }
    const requestId = `${prefix.current}-${++sequence.current}`;
    pending.current.set(requestId, { action: command.action, attachmentId: 'attachmentId' in command ? command.attachmentId : undefined, finish });
    setError('');
    refresh();
    vscode.postMessage({
      type: MessageType.WORKSHOP_STAGE_MESSAGE_TEXT, source: 'webview.workshop', timestamp: Date.now(),
      payload: { ...command, requestId, roomRevision } satisfies WorkshopStageMessageTextPayload
    });
  };

  const inspect = (attachmentId: string) => {
    closeSheet();
    const key = `sheet-${++sequence.current}`;
    sheetKey.current = key;
    setSheet({ key, attachmentId });
    request({ action: 'read', attachmentId }, (result) => {
      if (sheetKey.current === key) {
        setSheet((open) => open?.key === key
          ? { ...open, text: result.ok ? result.text : undefined, error: result.ok ? undefined : result.reason } : open);
      }
    });
  };
  const save = (text: string) => {
    if (!sheet || sheet.text === undefined || isBusy(sheet.attachmentId)) {
      return;
    }
    const { key, attachmentId } = sheet;
    request({ action: 'update', attachmentId, text }, (result) => {
      if (sheetKey.current !== key) {
        return;
      }
      if (result.ok) {
        closeSheet();
      } else {
        setSheet((open) => open?.key === key ? { ...open, error: result.reason } : open);
      }
    });
  };
  const isBusy = (id: string) => [...pending.current.values()].some((item) => item.attachmentId === id);
  const mutating = () => [...pending.current.values()].some((item) => item.action !== 'read');
  const inserting = () => [...pending.current.values()].some((item) => item.action === 'take');
  return {
    handleSessionState, handleResult, sheet, closeSheet, save,
    composer: {
      error, pendingStages: [...pending.current.entries()].filter(([, entry]) => entry.action === 'stage').map(([id]) => id),
      isBusy, mutating, inserting, stage: (text: string) => request({ action: 'stage', text }), inspect,
      remove: (attachmentId: string) => {
        if (!isBusy(attachmentId)) {
          request({ action: 'remove', attachmentId });
        }
      },
      take: (attachmentId: string, insert: (text: string) => void) => {
        if (!isBusy(attachmentId) && !inserting()) {
          request({ action: 'take', attachmentId }, (result) => {
            if (result.ok && result.text !== undefined) {
              insert(result.text);
            }
          });
        }
      }
    }
  };
}

export type WorkshopComposerPastedText = ReturnType<typeof useWorkshopPastedText>['composer'];
