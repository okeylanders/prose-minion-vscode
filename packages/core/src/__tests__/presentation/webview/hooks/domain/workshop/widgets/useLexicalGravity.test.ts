/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useLexicalGravity } from '@hooks/domain/workshop/widgets/useLexicalGravity';
import {
  MessageType,
  WorkshopLexicalGravityLensesDataMessage,
  WorkshopWidgetActionResultMessage
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useLexicalGravity', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('surfaces catalog incompatibilities alongside usable lenses without discarding either', () => {
    const { result } = renderHook(() => useLexicalGravity());
    const incompatibility = {
      resourceName: 'kinetic-biomechanics.json',
      foundVersion: 1,
      rebuildQuery: 'kinetic biomechanics',
      message: 'Saved Lexical Gravity lens kinetic-biomechanics.json uses version 1.'
    };
    const lensesData: WorkshopLexicalGravityLensesDataMessage = {
      type: MessageType.WORKSHOP_LEXICAL_GRAVITY_LENSES_DATA,
      source: 'extension.workshop.lexical-gravity',
      timestamp: 1,
      payload: {
        lenses: [],
        incompatibleResources: [incompatibility],
        storagePath: 'prose-minion/lenses'
      }
    };

    act(() => result.current.handleLensesData(lensesData));

    expect(result.current.incompatibleResources).toEqual([incompatibility]);
    expect(result.current.storagePath).toBe('prose-minion/lenses');
    expect(result.current.catalogError).toBeUndefined();
  });

  it('carries the exact incompatible resource name through the build request', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useLexicalGravity());

    act(() => result.current.buildLens(
      'build-1',
      'kinetic biomechanics',
      'kinetic-biomechanics.json'
    ));

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_BUILD_LEXICAL_GRAVITY_LENS,
      payload: {
        token: 'build-1',
        query: 'kinetic biomechanics',
        rebuildResourceName: 'kinetic-biomechanics.json'
      }
    }));
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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
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
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('no current apply request owns this token'),
      expect.objectContaining({ requestToken: oldToken })
    );
  });
});
