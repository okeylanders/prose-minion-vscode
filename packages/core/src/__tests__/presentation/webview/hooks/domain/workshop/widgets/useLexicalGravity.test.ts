/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useLexicalGravity } from '@hooks/domain/workshop/widgets/useLexicalGravity';
import { MessageType, WorkshopWidgetActionResultMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useLexicalGravity', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('owns apply acknowledgements and ignores sibling feature commits', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());
    act(() => result.current.apply({} as never));
    const requestToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    const applyResult: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        action: 'apply-standing',
        requestToken,
        widgetId: 'lexical-gravity',
        ok: true,
        widgetConfigId: 'wc-1'
      }
    };
    const gestureResult: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 2,
      payload: {
        action: 'commit',
        requestToken: 'commit-elsewhere',
        widgetId: 'gesture-playground',
        ok: true,
        widgetConfigId: 'wc-2'
      }
    };

    act(() => result.current.handleActionResult(applyResult));
    expect(result.current.actionResult).toEqual(applyResult.payload);

    act(() => result.current.handleActionResult(gestureResult));
    expect(result.current.actionResult).toEqual(applyResult.payload);

    act(() => result.current.consumeActionResult());
    expect(result.current.actionResult).toBeNull();
  });

  it('ignores an older apply result after a newer request owns the UI', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());

    act(() => result.current.apply({} as never));
    const oldToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    act(() => result.current.apply({} as never));

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 1,
      payload: {
        action: 'apply-standing',
        requestToken: oldToken,
        widgetId: 'lexical-gravity',
        ok: true
      }
    }));

    expect(result.current.actionResult).toBeNull();
  });
});
