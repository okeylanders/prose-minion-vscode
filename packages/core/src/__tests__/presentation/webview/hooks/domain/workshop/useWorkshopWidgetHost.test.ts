/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopWidgetHost } from '@hooks/domain/workshop/useWorkshopWidgetHost';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useWorkshopWidgetHost', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('owns the family-generic config request and response state', () => {
    const { result } = renderHook(() => useWorkshopWidgetHost());

    act(() => result.current.requestWidgetConfig('wc-9'));
    expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      source: 'webview.workshop',
      payload: { configId: 'wc-9' }
    }));

    act(() => result.current.handleWidgetConfigData({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      source: 'extension.workshop.widget',
      timestamp: 1,
      payload: {
        configId: 'wc-9',
        error: 'That widget configuration is no longer available.'
      }
    }));

    expect(result.current.widgetConfigResponseId).toBe('wc-9');
    expect(result.current.widgetConfigData).toBeNull();
    expect(result.current.widgetConfigError)
      .toBe('That widget configuration is no longer available.');

    act(() => result.current.clearWidgetConfigData());
    expect(result.current.widgetConfigResponseId).toBeNull();
    expect(result.current.widgetConfigError).toBeNull();
  });

  it('holds a released config the host asked to reopen until it is consumed', () => {
    const { result } = renderHook(() => useWorkshopWidgetHost());
    expect(result.current.restoredWidgetConfigId).toBeNull();

    act(() => result.current.handleWidgetConfigRestored({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_RESTORED,
      source: 'extension.workshop',
      timestamp: 1,
      payload: { widgetConfigId: 'wc-4' }
    }));
    expect(result.current.restoredWidgetConfigId).toBe('wc-4');
    // Restoring asks for nothing by itself; the opening controller does.
    expect(mockVSCode.postMessage).not.toHaveBeenCalled();

    act(() => result.current.consumeRestoredWidgetConfig());
    expect(result.current.restoredWidgetConfigId).toBeNull();
  });
});
