/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';
import { MessageType, StartupNoticeDataMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { useStartupNotice } from '@hooks/domain/useStartupNotice';

jest.mock('../../../../../presentation/webview/hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useStartupNotice', () => {
  let mockVSCode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    mockVSCode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(mockVSCode);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('asks the host for per-machine notice visibility', () => {
    const { result } = renderHook(() => useStartupNotice());

    act(() => result.current.requestStartupNotice());

    expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.REQUEST_STARTUP_NOTICE,
      source: 'webview.workshop',
      payload: {}
    }));
  });

  it('opens and closes from the host-owned visibility result', () => {
    const { result } = renderHook(() => useStartupNotice());
    const data = (shouldShow: boolean): StartupNoticeDataMessage => ({
      type: MessageType.STARTUP_NOTICE_DATA,
      source: 'extension.ui',
      payload: { shouldShow, noticeVersion: 'v1' },
      timestamp: 1
    });

    act(() => result.current.handleStartupNoticeData(data(true)));
    expect(result.current.noticeOpen).toBe(true);

    act(() => result.current.handleStartupNoticeData(data(false)));
    expect(result.current.noticeOpen).toBe(false);
  });

  it('plain close records nothing', () => {
    const { result } = renderHook(() => useStartupNotice());

    act(() => {
      result.current.handleStartupNoticeData({
        type: MessageType.STARTUP_NOTICE_DATA,
        source: 'extension.ui',
        payload: { shouldShow: true, noticeVersion: 'v1' },
        timestamp: 1
      });
      result.current.dismissStartupNotice(false);
    });

    expect(result.current.noticeOpen).toBe(false);
    expect(mockVSCode.postMessage).not.toHaveBeenCalled();
  });

  it('records the host-declared version only when the writer opts out', () => {
    const { result } = renderHook(() => useStartupNotice());

    act(() => result.current.handleStartupNoticeData({
      type: MessageType.STARTUP_NOTICE_DATA,
      source: 'extension.ui',
      payload: { shouldShow: true, noticeVersion: 'v1' },
      timestamp: 1
    }));
    act(() => result.current.dismissStartupNotice(true));

    expect(result.current.noticeOpen).toBe(false);
    expect(mockVSCode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.DISMISS_STARTUP_NOTICE,
      source: 'webview.workshop',
      payload: { noticeVersion: 'v1' }
    }));
  });

  it('does not fabricate a dismissal before the host supplies a version', () => {
    const { result } = renderHook(() => useStartupNotice());

    act(() => result.current.dismissStartupNotice(true));

    expect(mockVSCode.postMessage).not.toHaveBeenCalled();
  });
});
