/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopHighlightPrompt, type WorkshopSessionStateMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { useWorkshopHighlightPrompt } from '@hooks/domain/workshop/useWorkshopHighlightPrompt';

jest.mock('@hooks/useVSCodeApi');

const proposal: WorkshopHighlightPrompt = {
  roomRevision: 1, promptId: 'p1', displayPath: 'one.md', count: 2, kind: 'proposal', persona: 'Jill', title: 'Echoes'
};
const restore: WorkshopHighlightPrompt = {
  roomRevision: 2, promptId: 'r2', displayPath: 'two.md', count: 1, kind: 'restore', setCount: 1
};
const snapshot = (roomRevision: number, highlightPrompt?: WorkshopHighlightPrompt) =>
  ({ payload: { session: { roomRevision }, highlightPrompt } }) as WorkshopSessionStateMessage;

it('answers once, ignores stale clicks and replays, and accepts the next room’s question', () => {
  const vscode = createMockVSCode();
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  const { result } = renderHook(useWorkshopHighlightPrompt);
  act(() => result.current.handleSessionState(snapshot(1, proposal)));
  act(() => {
    result.current.answer(proposal, 'skip');
    result.current.answer(proposal, 'apply');
    result.current.handleSessionState(snapshot(1, proposal));
  });
  expect(result.current.prompt).toBeUndefined();
  act(() => result.current.handleSessionState(snapshot(2, proposal)));
  expect(result.current.prompt).toBeUndefined();
  act(() => {
    result.current.handleSessionState(snapshot(2, restore));
    result.current.handleSessionState(snapshot(1, proposal));
    result.current.answer(proposal, 'apply');
  });
  expect(result.current.prompt).toEqual(restore);
  act(() => result.current.answer(restore, 'restore'));
  expect(vscode.postMessage.mock.calls.map(([message]) => [message.type, message.payload])).toEqual([
    [MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT, { promptId: 'p1', roomRevision: 1, choice: 'skip' }],
    [MessageType.WORKSHOP_ANSWER_HIGHLIGHT_PROMPT, { promptId: 'r2', roomRevision: 2, choice: 'restore' }]
  ]);
});
