/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { useWorkshopSentAttachments } from '@hooks/domain/workshop/useWorkshopSentAttachments';
import { useVSCodeApi } from '@hooks/useVSCodeApi';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { MessageType, type WorkshopSentAttachmentRequest } from '@messages';

jest.mock('@hooks/useVSCodeApi');

it('takes only the matching pending answer once and invalidates it on close, reopen or room replacement', () => {
  const vscode = createMockVSCode();
  (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  const { result, rerender } = renderHook(({ revision }) => useWorkshopSentAttachments(revision), { initialProps: { revision: 1 } });
  const request = () => {
    let id!: WorkshopSentAttachmentRequest;
    act(() => { id = result.current.request('u1', 'ta-1')!; });
    return id;
  };
  const reply = (id: WorkshopSentAttachmentRequest, content: string) => act(() => {
    result.current.receive({ type: MessageType.WORKSHOP_MESSAGE_ATTACHMENT_CONTENT, source: 'extension.workshop', timestamp: 0,
      payload: { ...id, content, canOpenInEditor: true } });
  });
  const first = request();
  act(() => result.current.clear());
  const second = request();
  reply(first, 'old'); reply({ ...second, artifactId: 'ta-2' }, 'wrong');
  expect(result.current.answer).toBeUndefined();
  reply(second, 'current'); reply(second, 'duplicate');
  expect(result.current.answer).toMatchObject({ content: 'current' });
  act(() => result.current.openFile(second));
  expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ type: MessageType.WORKSHOP_OPEN_MESSAGE_ATTACHMENT_FILE, payload: second }));
  rerender({ revision: 2 });
  reply(second, 'old room');
  expect(result.current.answer).toBeUndefined();
});
