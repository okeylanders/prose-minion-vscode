import * as React from 'react';
import { MessageType, type WorkshopSentAttachmentContent, type WorkshopSentAttachmentRequest,
  type WorkshopMessageAttachmentContentMessage } from '@messages';
import { useVSCodeApi } from '@hooks/useVSCodeApi';

export function useWorkshopSentAttachments(roomRevision: number | undefined) {
  const vscode = useVSCodeApi();
  const ids = React.useRef({ prefix: Math.random().toString(36).slice(2), count: 0 });
  const pending = React.useRef<WorkshopSentAttachmentRequest>();
  const [answer, setAnswer] = React.useState<WorkshopSentAttachmentContent>();
  const clear = React.useCallback(() => { pending.current = undefined; setAnswer(undefined); }, []);
  React.useLayoutEffect(() => { clear(); }, [roomRevision, clear]);

  const request = React.useCallback((turnId: string, artifactId: string) => {
    if (roomRevision === undefined) { return undefined; }
    const identity = { requestId: `sent-${ids.current.prefix}-${++ids.current.count}`, roomRevision, turnId, artifactId };
    pending.current = identity;
    setAnswer(undefined);
    vscode.postMessage({ type: MessageType.WORKSHOP_REQUEST_MESSAGE_ATTACHMENT, payload: identity,
      source: 'webview.workshop', timestamp: Date.now() });
    return identity;
  }, [roomRevision, vscode]);

  const receive = React.useCallback((message: WorkshopMessageAttachmentContentMessage) => {
    const current = pending.current;
    const reply = message.payload;
    if (current && current.roomRevision === roomRevision && current.requestId === reply.requestId
      && current.roomRevision === reply.roomRevision && current.turnId === reply.turnId && current.artifactId === reply.artifactId) {
      pending.current = undefined;
      setAnswer(reply);
    }
  }, [roomRevision]);

  const openFile = React.useCallback((identity: WorkshopSentAttachmentRequest) => {
    if (identity.roomRevision === roomRevision && answer?.requestId === identity.requestId
      && 'canOpenInEditor' in answer && answer.canOpenInEditor) {
      vscode.postMessage({ type: MessageType.WORKSHOP_OPEN_MESSAGE_ATTACHMENT_FILE, payload: identity,
        source: 'webview.workshop', timestamp: Date.now() });
    }
  }, [answer, roomRevision, vscode]);

  return { answer: answer?.roomRevision === roomRevision ? answer : undefined, request, receive, clear, openFile };
}
