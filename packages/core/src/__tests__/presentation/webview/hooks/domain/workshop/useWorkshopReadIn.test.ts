/** @jest-environment jsdom */

/**
 * useWorkshopReadIn (ADR 2026-11-03 D4; PR #186 F-01): the reader asks for a
 * file under a request id it mints, takes only the reply to the request it is
 * waiting on, and opens the file beside through its own message. The pair
 * names a file, not a request, so an earlier opening's late reply never
 * supplies a later one. Nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopReadIn } from '@hooks/domain/workshop/useWorkshopReadIn';
import { MessageType, WorkshopReadInResourceContentMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const rabbit = { group: 'characters' as const, path: 'characters/rabbit.md' };
const hatter = { group: 'characters' as const, path: 'characters/hatter.md' };

const reply = (
  payload: WorkshopReadInResourceContentMessage['payload']
): WorkshopReadInResourceContentMessage => ({
  type: MessageType.WORKSHOP_READ_IN_RESOURCE_CONTENT,
  source: 'extension.workshop',
  payload,
  timestamp: 2
});

describe('useWorkshopReadIn', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  /** The request ids posted so far, in order. */
  const requestIds = (): string[] => vscode.postMessage.mock.calls
    .map(([message]: [{ type: MessageType; payload: { requestId?: string } }]) => message)
    .filter((message) => message.type === MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE)
    .map((message) => message.payload.requestId!);

  const answer = (
    hook: { current: ReturnType<typeof useWorkshopReadIn> },
    requestId: string,
    ref: typeof rabbit,
    content: string
  ) => act(() => hook.current.handleReadInResourceContent(reply({
    requestId,
    ...ref,
    content,
    canOpenInEditor: true
  })));

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('posts the content request with the pair and a fresh request id, and waits for it', () => {
    const { result } = renderHook(() => useWorkshopReadIn());

    act(() => result.current.requestReadInResource(rabbit));
    act(() => result.current.requestReadInResource(rabbit));

    const [first, second] = requestIds();
    expect(first).toMatch(/^ws-readin-[a-z0-9]+-1$/);
    expect(second).not.toBe(first);
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE,
      payload: { requestId: first, ...rabbit }
    }));
    expect(result.current.readInContent).toEqual({ requestId: second, ...rabbit, canOpenInEditor: false });
  });

  it('takes the current request\'s reply', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));
    const [current] = requestIds();

    act(() => result.current.handleReadInResourceContent(reply({
      requestId: current,
      ...rabbit,
      content: 'Down the hole.',
      truncated: true,
      canOpenInEditor: true
    })));
    expect(result.current.readInContent).toEqual({
      requestId: current,
      ...rabbit,
      content: 'Down the hole.',
      truncated: true,
      error: undefined,
      canOpenInEditor: true
    });
  });

  it.each([
    ['the earlier reply lands first', 'earlier-first'],
    ['the current reply lands first', 'current-first']
  ])('Close, then reopen the same file: shows only the reopening\'s answer when %s', (_case, order) => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));
    act(() => result.current.clearReadInContent());
    act(() => result.current.requestReadInResource(rabbit));
    const [earlier, current] = requestIds();

    if (order === 'earlier-first') {
      answer(result, earlier, rabbit, 'The file before the writer saved.');
      expect(result.current.readInContent?.content).toBeUndefined();
      answer(result, current, rabbit, 'The file now.');
    } else {
      answer(result, current, rabbit, 'The file now.');
      answer(result, earlier, rabbit, 'The file before the writer saved.');
    }
    expect(result.current.readInContent).toMatchObject({ requestId: current, content: 'The file now.' });
  });

  it.each([
    ['in request order', [0, 1, 2]],
    ['in reverse', [2, 1, 0]],
    ['first A last', [1, 2, 0]]
  ])('A → B → A: shows only the last opening\'s answer when replies land %s', (_case, order) => {
    const { result } = renderHook(() => useWorkshopReadIn());
    for (const ref of [rabbit, hatter, rabbit]) {
      act(() => result.current.requestReadInResource(ref));
      act(() => result.current.clearReadInContent());
    }
    act(() => result.current.requestReadInResource(rabbit));
    const ids = requestIds();
    const refs = [rabbit, hatter, rabbit];
    for (const index of order) {
      answer(result, ids[index], refs[index], `Answer ${index}`);
    }
    expect(result.current.readInContent?.content).toBeUndefined();

    answer(result, ids[3], rabbit, 'The last opening.');
    expect(result.current.readInContent).toMatchObject({ requestId: ids[3], content: 'The last opening.' });
  });

  it('keeps the first answer to its request; a duplicate never replaces it', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));
    const [current] = requestIds();
    answer(result, current, rabbit, 'First.');
    answer(result, current, rabbit, 'Duplicate.');
    expect(result.current.readInContent?.content).toBe('First.');
  });

  it('ignores a reply once the reader is cleared', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));
    act(() => result.current.clearReadInContent());
    answer(result, requestIds()[0], rabbit, 'Late.');
    expect(result.current.readInContent).toBeNull();
  });

  it('posts Open beside with the pair alone', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.openReadInResource(rabbit));
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_OPEN_READ_IN_RESOURCE,
      payload: rabbit
    }));
  });

  it('persists nothing', () => {
    expect(renderHook(() => useWorkshopReadIn()).result.current.persistedState).toEqual({});
  });
  describe('the row a request names (Wayfinding Slice 3)', () => {
    it('sends the row\'s delivery time, and keeps it on the pending state', () => {
      const { result } = renderHook(() => useWorkshopReadIn());

      act(() => result.current.requestReadInResource({ ...rabbit, deliveredAt: 5_000 }));

      expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE,
        payload: { requestId: requestIds()[0], ...rabbit, deliveredAt: 5_000 }
      }));
      expect(result.current.readInContent).toMatchObject({ ...rabbit, deliveredAt: 5_000 });
    });

    it('sends no delivery time when the request names no row', () => {
      const { result } = renderHook(() => useWorkshopReadIn());

      act(() => result.current.requestReadInResource(rabbit));

      const [[posted]] = vscode.postMessage.mock.calls;
      expect(posted.payload).not.toHaveProperty('deliveredAt');
    });

    it('takes the line range and "changed since" from the pending request\'s reply', () => {
      const { result } = renderHook(() => useWorkshopReadIn());
      act(() => result.current.requestReadInResource({ ...rabbit, deliveredAt: 5_000 }));
      const [requestId] = requestIds();

      act(() => result.current.handleReadInResourceContent(reply({
        requestId,
        ...rabbit,
        content: 'Down the hole.',
        lineRange: { start: 1, end: 64 },
        changedSinceRead: true,
        canOpenInEditor: true
      })));

      expect(result.current.readInContent).toEqual({
        requestId,
        ...rabbit,
        deliveredAt: 5_000,
        content: 'Down the hole.',
        truncated: undefined,
        lineRange: { start: 1, end: 64 },
        changedSinceRead: true,
        error: undefined,
        canOpenInEditor: true
      });
    });
  });
});
