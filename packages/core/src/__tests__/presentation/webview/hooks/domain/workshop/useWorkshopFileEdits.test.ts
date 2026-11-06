/** @jest-environment jsdom */

/**
 * useWorkshopFileEdits (ADR 2026-11-05 D8, D9; epic Slice 4b): each action
 * posts its route under a minted request id and the room it was shown in;
 * only an answer still waited for, for the room on screen, is taken (#221):
 * a late, duplicate or other room's answer changes nothing; a joined answer
 * is an answer; a new room drops everything; nothing persists, and no
 * request names a URI. *Alice*.
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, type WorkshopFileEditResultPayload } from '@messages';
import { useWorkshopFileEdits, type UseWorkshopFileEditsOptions } from '@hooks/domain/workshop/useWorkshopFileEdits';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const TURN = 'turn-4-assistant-1008';
const CARD = `${TURN}#0`;

const result = (payload: Partial<WorkshopFileEditResultPayload> & { requestId: string }) => ({
  type: MessageType.WORKSHOP_FILE_EDIT_RESULT,
  source: 'extension.workshop',
  payload: { roomRevision: 3, turnId: TURN, index: 0, answer: 'settled', message: '', ...payload },
  timestamp: 2
}) as never;

const previewResult = (payload: Record<string, unknown>) => ({
  type: MessageType.WORKSHOP_FILE_EDIT_PREVIEW_RESULT,
  source: 'extension.workshop',
  payload: { roomRevision: 3, turnId: TURN, index: 0, ...payload },
  timestamp: 2
}) as never;

describe('useWorkshopFileEdits', () => {
  let vscode: ReturnType<typeof createMockVSCode>;
  const posted = (type: MessageType) => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: Record<string, unknown> }]) => message)
    .filter((message) => message.type === type);
  const mount = (initial: UseWorkshopFileEditsOptions = { roomKey: 'room:3', roomRevision: 3 }) =>
    renderHook((props: UseWorkshopFileEditsOptions) => useWorkshopFileEdits(props), { initialProps: initial });

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('Apply posts its card, room and a minted id, and is busy until its answer', () => {
    const { result: hook } = mount();
    act(() => hook.current.apply(TURN, 0));
    const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    expect(sent.payload).toEqual({ requestId: expect.stringMatching(/^ws-file-edit-/), roomRevision: 3, turnId: TURN, index: 0, action: 'apply' });
    expect(hook.current.busyCards.has(CARD)).toBe(true);

    act(() => hook.current.handleResult(result({ requestId: sent.payload.requestId as string, state: 'applied', message: 'Applied.' })));
    expect(hook.current.busyCards.has(CARD)).toBe(false);
    // A settled card speaks through its state on the snapshot.
    expect(hook.current.cardFeedback.has(CARD)).toBe(false);
  });

  it('Review and Decline post their own actions', () => {
    const { result: hook } = mount();
    act(() => hook.current.review(TURN, 0));
    act(() => hook.current.decline(TURN, 1));
    expect(posted(MessageType.WORKSHOP_FILE_EDIT_ACTION).map((message) => [message.payload.index, message.payload.action]))
      .toEqual([[0, 'review'], [1, 'decline']]);
    expect([...hook.current.busyCards].sort()).toEqual([CARD, `${TURN}#1`]);
  });

  it('a second press while the card waits posts nothing', () => {
    const { result: hook } = mount();
    act(() => {
      hook.current.apply(TURN, 0);
      hook.current.apply(TURN, 0);
      hook.current.decline(TURN, 0);
    });
    expect(posted(MessageType.WORKSHOP_FILE_EDIT_ACTION)).toHaveLength(1);
  });

  it('a refusal that leaves the card pending says why beside it, until the next press', () => {
    const { result: hook } = mount();
    act(() => hook.current.apply(TURN, 0));
    const [first] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    act(() => hook.current.handleResult(result({
      requestId: first.payload.requestId as string, answer: 'refused', state: 'pending', reason: 'run-active',
      message: 'Apply after the current reply finishes.'
    })));
    expect(hook.current.cardFeedback.get(CARD)).toEqual({ answer: 'refused', message: 'Apply after the current reply finishes.' });

    act(() => hook.current.apply(TURN, 0));
    expect(hook.current.cardFeedback.has(CARD)).toBe(false);
  });

  it('a late answer, after the card was answered, changes nothing; so does a duplicate', () => {
    const { result: hook } = mount();
    act(() => hook.current.apply(TURN, 0));
    const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    const requestId = sent.payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId, answer: 'refused', state: 'pending', message: 'Try again.' })));
    act(() => hook.current.apply(TURN, 0));
    expect(hook.current.busyCards.has(CARD)).toBe(true);

    // The first request's answer, sent twice: neither ends the second request.
    act(() => hook.current.handleResult(result({ requestId, answer: 'refused', state: 'pending', message: 'Late.' })));
    act(() => hook.current.handleResult(result({ requestId, answer: 'refused', state: 'pending', message: 'Late.' })));
    expect(hook.current.busyCards.has(CARD)).toBe(true);
    expect(hook.current.cardFeedback.has(CARD)).toBe(false);
  });

  it('an answer no request here waits for is ignored', () => {
    const { result: hook } = mount();
    act(() => hook.current.handleResult(result({ requestId: 'another-webview-1', answer: 'refused', state: 'pending', message: 'No.' })));
    expect(hook.current.cardFeedback.size).toBe(0);
  });

  it('a joined answer is this request\'s answer', () => {
    const { result: hook } = mount();
    act(() => hook.current.review(TURN, 0));
    const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    act(() => hook.current.handleResult(result({ requestId: sent.payload.requestId as string, answer: 'joined', state: 'applied', message: 'Applied.' })));
    expect(hook.current.busyCards.has(CARD)).toBe(false);
    expect(hook.current.cardFeedback.has(CARD)).toBe(false);
  });

  it('a joined answer that left the card pending (a discarded review) says so', () => {
    const { result: hook } = mount();
    act(() => hook.current.review(TURN, 0));
    const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    act(() => hook.current.handleResult(result({
      requestId: sent.payload.requestId as string, answer: 'joined', state: 'pending', message: 'Nothing changes until you apply it.'
    })));
    expect(hook.current.cardFeedback.get(CARD)?.answer).toBe('joined');
  });

  it('an answer naming another room, or another card, is ignored', () => {
    const { result: hook } = mount();
    act(() => hook.current.apply(TURN, 0));
    const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    const requestId = sent.payload.requestId as string;
    act(() => hook.current.handleResult(result({ requestId, roomRevision: 2, answer: 'refused', state: 'pending', message: 'Old room.' })));
    expect(hook.current.cardFeedback.size).toBe(0);
  });

  it('a new room drops what the old one waited on, and ignores its answers', () => {
    const { result: hook, rerender } = mount();
    act(() => hook.current.apply(TURN, 0));
    act(() => hook.current.requestPreview(TURN, 1));
    const [action] = posted(MessageType.WORKSHOP_FILE_EDIT_ACTION);
    const [preview] = posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
    expect(hook.current.previews.get(`${TURN}#1`)).toEqual({ status: 'loading' });

    rerender({ roomKey: 'room:4', roomRevision: 4 });
    expect(hook.current.busyCards.size).toBe(0);
    expect(hook.current.previews.size).toBe(0);

    act(() => hook.current.handleResult(result({ requestId: action.payload.requestId as string, answer: 'refused', state: 'pending', message: 'Old.' })));
    act(() => hook.current.handlePreviewResult(previewResult({
      requestId: preview.payload.requestId, index: 1, preview: { kind: 'rewrite', before: 'Cast: Alice.', after: 'Cast.' }
    })));
    expect(hook.current.cardFeedback.size).toBe(0);
    expect(hook.current.previews.size).toBe(0);

    // The new room's same ids post again, under the new room.
    act(() => hook.current.apply(TURN, 0));
    expect(posted(MessageType.WORKSHOP_FILE_EDIT_ACTION)[1].payload.roomRevision).toBe(4);
  });

  it('before the first snapshot nothing posts', () => {
    const { result: hook } = mount({ roomKey: 'pending' });
    act(() => {
      hook.current.apply(TURN, 0);
      hook.current.requestPreview(TURN, 0);
    });
    expect(vscode.postMessage).not.toHaveBeenCalled();
  });

  describe('a rewrite\'s preview', () => {
    it('is asked once per card and room, and takes its before and after', () => {
      const { result: hook } = mount();
      act(() => hook.current.requestPreview(TURN, 0));
      act(() => hook.current.requestPreview(TURN, 0));
      const sent = posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
      expect(sent).toHaveLength(1);
      expect(sent[0].payload).toEqual({ requestId: expect.any(String), roomRevision: 3, turnId: TURN, index: 0 });

      act(() => hook.current.handlePreviewResult(previewResult({
        requestId: sent[0].payload.requestId, preview: { kind: 'rewrite', before: 'Cast: Alice.', after: 'Cast: Alice, the Rabbit.' }
      })));
      expect(hook.current.previews.get(CARD)).toEqual({ status: 'ready', before: 'Cast: Alice.', after: 'Cast: Alice, the Rabbit.' });
    });

    it('stale says so for good', () => {
      const { result: hook } = mount();
      act(() => hook.current.requestPreview(TURN, 0));
      const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
      act(() => hook.current.handlePreviewResult(previewResult({
        requestId: sent.payload.requestId,
        preview: { kind: 'stale', reason: 'baseline-changed', message: 'The file changed since this was suggested, so nothing was changed.' }
      })));
      expect(hook.current.previews.get(CARD)).toEqual({ status: 'stale', message: 'The file changed since this was suggested, so nothing was changed.' });
      act(() => hook.current.requestPreview(TURN, 0));
      expect(posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW)).toHaveLength(1);
    });

    it('refused may be asked again', () => {
      const { result: hook } = mount();
      act(() => hook.current.requestPreview(TURN, 0));
      const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
      act(() => hook.current.handlePreviewResult(previewResult({
        requestId: sent.payload.requestId, preview: { kind: 'refused', reason: 'unreadable', message: 'That file could not be opened or read as text.' }
      })));
      expect(hook.current.previews.get(CARD)?.status).toBe('refused');
      act(() => hook.current.requestPreview(TURN, 0));
      expect(posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW)).toHaveLength(2);
    });

    it('an action\'s answer is not a preview\'s, nor the other way round', () => {
      const { result: hook } = mount();
      act(() => hook.current.requestPreview(TURN, 0));
      const [sent] = posted(MessageType.WORKSHOP_FILE_EDIT_PREVIEW);
      act(() => hook.current.handleResult(result({ requestId: sent.payload.requestId as string, answer: 'refused', state: 'pending', message: 'No.' })));
      expect(hook.current.cardFeedback.size).toBe(0);
      expect(hook.current.previews.get(CARD)).toEqual({ status: 'loading' });
    });
  });

  it('persists nothing, and no request names a URI', () => {
    const { result: hook } = mount();
    act(() => {
      hook.current.apply(TURN, 0);
      hook.current.requestPreview(TURN, 1);
    });
    expect(hook.current.persistedState).toEqual({});
    expect(JSON.stringify(vscode.postMessage.mock.calls)).not.toMatch(/documentUri|file:/u);
  });
});
