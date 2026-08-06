/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useGesturePlayground } from '@hooks/domain/workshop/widgets/useGesturePlayground';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useGesturePlayground', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('owns Gesture commit acknowledgements until the modal consumes them', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useGesturePlayground());
    act(() => result.current.commitWidget({
      widgetId: 'gesture-playground',
      draft: {} as never
    }));
    const requestToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    const response: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      payload: {
        action: 'commit',
        requestToken,
        widgetId: 'gesture-playground',
        ok: false,
        message: 'The session is still saving.'
      },
      timestamp: 0
    };

    act(() => result.current.handleWidgetActionResult(response));
    expect(result.current.widgetActionResult).toEqual(response.payload);

    act(() => result.current.consumeWidgetActionResult());
    expect(result.current.widgetActionResult).toBeNull();
  });

  it('ignores a stale commit acknowledgement with the right action and widget', () => {
    const vscode = createMockVSCode();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useGesturePlayground());

    act(() => result.current.commitWidget({
      widgetId: 'gesture-playground',
      draft: {} as never
    }));
    const requestToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;

    act(() => result.current.handleWidgetActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      payload: {
        action: 'commit',
        requestToken: `${requestToken}-stale`,
        widgetId: 'gesture-playground',
        ok: true
      },
      timestamp: 0
    }));

    expect(result.current.widgetActionResult).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no current commit request owns this token'),
      expect.objectContaining({ requestToken: `${requestToken}-stale` })
    );
  });

  it('tracks token-keyed progress and clears it when that result settles', () => {
    const { result } = renderHook(() => useGesturePlayground());

    act(() => result.current.handleWidgetGenerationProgress({
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS,
      source: 'extension.workshop',
      payload: {
        widgetId: 'gesture-playground',
        token: 'gesture-1',
        phase: 'streaming',
        stage: 'dictionary',
        outputCharacters: 4_000,
        estimatedOutputTokens: 1_000,
        outputTokenLimit: 50_000
      },
      timestamp: 1
    }));

    expect(result.current.widgetGenerationProgress).toMatchObject({
      token: 'gesture-1',
      stage: 'dictionary',
      estimatedOutputTokens: 1_000
    });

    act(() => result.current.handleWidgetMenuResult({
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT,
      source: 'extension.workshop',
      payload: {
        widgetId: 'gesture-playground',
        token: 'gesture-1',
        mode: 'full',
        ok: false,
        error: 'Stopped.'
      },
      timestamp: 2
    }));

    expect(result.current.widgetGenerationProgress).toBeNull();
  });

  it('does not let a stale menu result clear newer progress', () => {
    const { result } = renderHook(() => useGesturePlayground());

    act(() => result.current.handleWidgetGenerationProgress({
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_GENERATION_PROGRESS,
      source: 'extension.workshop',
      payload: {
        widgetId: 'gesture-playground',
        token: 'gesture-new',
        phase: 'streaming',
        stage: 'menu',
        outputCharacters: 8_000,
        estimatedOutputTokens: 2_000,
        outputTokenLimit: 50_000
      },
      timestamp: 1
    }));
    act(() => result.current.handleWidgetMenuResult({
      type: MessageType.WORKSHOP_GESTURE_PLAYGROUND_MENU_RESULT,
      source: 'extension.workshop',
      payload: {
        widgetId: 'gesture-playground',
        token: 'gesture-old',
        mode: 'full',
        ok: false,
        error: 'Stale.'
      },
      timestamp: 2
    }));

    expect(result.current.widgetGenerationProgress?.token).toBe('gesture-new');
  });
});
