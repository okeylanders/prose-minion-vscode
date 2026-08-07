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
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('owns removal requests and accepts only the matching result identity', () => {
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));

    act(() => result.current.remove({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity'
    }));

    const request = vscode.postMessage.mock.calls[0][0];
    expect(result.current.removingWidgetIds).toEqual(['lexical-gravity']);
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
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining('no pending request owns this token'),
      expect.objectContaining({ widgetId: 'lexical-gravity' })
    );

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
    expect(warn).toHaveBeenLastCalledWith(
      expect.stringContaining('expected widget lexical-gravity'),
      expect.objectContaining({ widgetId: 'prose-controller' })
    );

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
    expect(result.current.removingWidgetIds).toEqual([]);
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

  it('tracks concurrent removals independently and settles each acknowledgement', () => {
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));

    act(() => result.current.remove({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity'
    }));
    act(() => result.current.remove({
      family: 'prose-controller',
      widgetId: 'prose-controller'
    }));
    const [lexicalRequest, proseRequest] = vscode.postMessage.mock.calls
      .map(([message]) => message);
    expect(result.current.removingWidgetIds).toEqual([
      'lexical-gravity',
      'prose-controller'
    ]);

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 1,
      payload: {
        action: 'remove-standing',
        requestToken: lexicalRequest.payload.requestToken,
        widgetId: 'lexical-gravity',
        ok: true,
        removed: true
      }
    }));
    expect(result.current.removingWidgetIds).toEqual(['prose-controller']);

    act(() => result.current.handleActionResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.standing-directives',
      timestamp: 2,
      payload: {
        action: 'remove-standing',
        requestToken: proseRequest.payload.requestToken,
        widgetId: 'prose-controller',
        ok: true,
        removed: true
      }
    }));

    expect(result.current.removingWidgetIds).toEqual([]);
    expect(showToast).toHaveBeenNthCalledWith(1, {
      message: 'Lexical Gravity removed.',
      icon: 'check'
    });
    expect(showToast).toHaveBeenNthCalledWith(2, {
      message: 'Prose Controller removed.',
      icon: 'check'
    });
  });

  it('does not post a duplicate removal for one family while its request is pending', () => {
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));
    const directive = {
      family: 'lexical-gravity' as const,
      widgetId: 'lexical-gravity' as const
    };

    act(() => {
      result.current.remove(directive);
      result.current.remove(directive);
    });

    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity removal is already in progress.',
      icon: 'info'
    });
  });

  it('releases a pending removal with a visible failure when its ack times out', () => {
    jest.useFakeTimers();
    const vscode = createMockVSCode();
    const showToast = jest.fn();
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(showToast));

    act(() => result.current.remove({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity'
    }));
    act(() => jest.advanceTimersByTime(10_000));

    expect(result.current.removingWidgetIds).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      '[useWorkshopStandingDirectives] Remove acknowledgement timed out',
      expect.objectContaining({ widgetId: 'lexical-gravity' })
    );
    expect(showToast).toHaveBeenCalledWith({
      message: 'Lexical Gravity removal was not confirmed.',
      icon: 'x',
      tone: 'error'
    });
  });

  it('formats summaries without exposing application operations to the rail', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const { result } = renderHook(() => useWorkshopStandingDirectives(jest.fn()));

    expect(result.current.formatSummary({
      id: 'pd-1',
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      widgetConfigId: 'wc-1',
      revision: 1,
      updatedAt: 1,
      lensName: 'Photography',
      applicationMode: 'interpret',
      evidenceMode: 'blend',
      weight: 60,
      reach: 2,
      metaphorPull: true
    })).toBe('Photography · interpret · blend · 60% · 2° · metaphor');
  });
});
