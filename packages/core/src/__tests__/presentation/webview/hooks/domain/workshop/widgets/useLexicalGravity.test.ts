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
    const { result } = renderHook(() => useLexicalGravity());
    const applyResult: WorkshopWidgetActionResultMessage = {
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        action: 'apply-standing',
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
});
