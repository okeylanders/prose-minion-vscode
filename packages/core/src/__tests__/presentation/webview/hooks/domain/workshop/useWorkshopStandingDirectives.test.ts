/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopStandingDirectives
} from '@hooks/domain/workshop/useWorkshopStandingDirectives';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useWorkshopStandingDirectives', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('owns removal requests and accepts only the matching result identity', () => {
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));

    act(() => result.current.remove({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity'
    }));

    const request = vscode.postMessage.mock.calls[0][0];
    expect(request).toMatchObject({
      type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
      payload: {
        family: 'lexical-gravity',
        requestToken: expect.any(String)
      }
    });

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 1,
      payload: {
        action: 'remove-standing',
        requestToken: `${request.payload.requestToken}-stale`,
        widgetId: 'lexical-gravity',
        ok: true,
        removed: true
      }
    }));
    expect(showToast).not.toHaveBeenCalled();

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 2,
      payload: {
        action: 'remove-standing',
        requestToken: request.payload.requestToken,
        widgetId: 'prose-controller',
        ok: true,
        removed: true
      }
    }));
    expect(showToast).not.toHaveBeenCalled();

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 3,
      payload: {
        action: 'remove-standing',
        requestToken: request.payload.requestToken,
        widgetId: 'lexical-gravity',
        ok: true,
        removed: true
      }
    }));

    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity removed.',
      icon: 'check'
    });
  });

  it('uses generic catalog copy for a second standing family', () => {
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));

    act(() => result.current.remove({
      family: 'prose-controller',
      widgetId: 'prose-controller'
    }));
    const requestToken = vscode.postMessage.mock.calls[0][0].payload.requestToken;
    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 1,
      payload: {
        action: 'remove-standing',
        requestToken,
        widgetId: 'prose-controller',
        ok: true,
        removed: false
      }
    }));

    expect(showToast).toHaveBeenCalledWith({
      message: 'Prose Controller was already removed.',
      icon: 'info'
    });
  });
});
