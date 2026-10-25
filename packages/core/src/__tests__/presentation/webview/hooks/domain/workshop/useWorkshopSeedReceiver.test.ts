/**
 * @jest-environment jsdom
 */

/**
 * The Workshop webview as a seed receiver (PR #150 F-08): each mount mints
 * one receiver id, announces it once, and keeps it across renders; a fresh
 * mount (a reloaded webview) announces a new one.
 */
import { renderHook } from '@testing-library/react';
import { MessageType } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import { useWorkshopSeedReceiver } from '@hooks/domain/workshop/useWorkshopSeedReceiver';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useWorkshopSeedReceiver', () => {
  const announcements = (vscode: ReturnType<typeof createMockVSCode>) => (vscode.postMessage as jest.Mock).mock.calls
    .map(([message]) => message as { type: string; payload: { receiver: string } })
    .filter((message) => message.type === MessageType.WORKSHOP_SEED_RECEIVER)
    .map((message) => message.payload.receiver);

  it('announces one receiver per mount, keeps it across renders, and a fresh mount announces another', () => {
    const vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
    const first = renderHook(() => useWorkshopSeedReceiver());
    first.rerender();
    first.rerender();
    expect(announcements(vscode)).toEqual([first.result.current.receiver]);
    expect(first.result.current.receiver.length).toBeLessThanOrEqual(80);
    first.unmount();

    const second = renderHook(() => useWorkshopSeedReceiver());
    expect(announcements(vscode)).toEqual([first.result.current.receiver, second.result.current.receiver]);
    expect(second.result.current.receiver).not.toBe(first.result.current.receiver);
  });
});
