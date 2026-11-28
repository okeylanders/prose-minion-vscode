import * as React from 'react';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { MessageType, type WorkshopHighlightPrompt, type WorkshopHighlightPromptAnswer, type WorkshopSessionStateMessage } from '@messages';

/** The host owns the pending question. The webview remembers answers until its room is replaced. */
export function useWorkshopHighlightPrompt() {
  const vscode = useVSCodeApi();
  const [prompt, setPrompt] = React.useState<WorkshopHighlightPrompt>();
  const live = React.useRef<WorkshopHighlightPrompt>();
  const room = React.useRef<number>();
  const answered = React.useRef(new Set<string>());

  const handleSessionState = React.useCallback(({ payload }: WorkshopSessionStateMessage) => {
    const revision = payload.session.roomRevision;
    if (room.current !== undefined && revision < room.current) {
      return;
    }
    if (revision !== room.current) {
      room.current = revision;
      answered.current.clear();
    }
    const next = payload.highlightPrompt;
    live.current = next && next.roomRevision === revision && !answered.current.has(next.promptId) ? next : undefined;
    setPrompt(live.current);
  }, []);

  const answer = React.useCallback((displayed: WorkshopHighlightPrompt, choice: WorkshopHighlightPromptAnswer['choice']) => {
    const { roomRevision, promptId } = displayed;
    if (live.current?.promptId !== promptId || live.current.roomRevision !== roomRevision) {
      return;
    }
    live.current = undefined;
    answered.current.add(promptId);
    setPrompt(undefined);
    vscode.postMessage({
      type: MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT,
      source: 'webview.workshop',
      payload: { roomRevision, promptId, choice },
      timestamp: Date.now()
    });
  }, [vscode]);

  return { prompt, answer, handleSessionState };
}
