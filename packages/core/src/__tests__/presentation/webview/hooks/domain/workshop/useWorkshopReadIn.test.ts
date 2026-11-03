/** @jest-environment jsdom */

/**
 * useWorkshopReadIn (ADR 2026-11-03 D4): the reader asks for a file by
 * `{ group, path }`, takes only the reply for the file it is waiting on, and
 * opens the file beside through its own message. Nothing persists.
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopReadIn } from '@hooks/domain/workshop/useWorkshopReadIn';
import { MessageType, WorkshopReadInResourceContentMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const rabbit = { group: 'characters' as const, path: 'characters/rabbit.md' };

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

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('posts the content request with the pair and waits for it', () => {
    const { result } = renderHook(() => useWorkshopReadIn());

    act(() => result.current.requestReadInResource(rabbit));

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_READ_IN_RESOURCE,
      payload: rabbit
    }));
    expect(result.current.readInContent).toEqual({ ...rabbit, canOpenInEditor: false });
  });

  it('takes only the reply for the file it is waiting on', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));

    act(() => result.current.handleReadInResourceContent(reply({
      group: 'characters',
      path: 'characters/hatter.md',
      content: 'A late answer for another row.',
      canOpenInEditor: true
    })));
    expect(result.current.readInContent?.content).toBeUndefined();

    act(() => result.current.handleReadInResourceContent(reply({
      ...rabbit,
      content: 'Down the hole.',
      truncated: true,
      canOpenInEditor: true
    })));
    expect(result.current.readInContent).toEqual({
      ...rabbit,
      content: 'Down the hole.',
      truncated: true,
      error: undefined,
      canOpenInEditor: true
    });
  });

  it('ignores a reply once the reader is cleared', () => {
    const { result } = renderHook(() => useWorkshopReadIn());
    act(() => result.current.requestReadInResource(rabbit));
    act(() => result.current.clearReadInContent());
    act(() => result.current.handleReadInResourceContent(reply({ ...rabbit, content: 'Late.', canOpenInEditor: true })));
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
});
