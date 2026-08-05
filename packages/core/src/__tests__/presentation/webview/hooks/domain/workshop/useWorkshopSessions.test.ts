/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopSessions } from '@hooks/domain/workshop/useWorkshopSessions';
import { WorkshopRoomReplacementPort } from '@hooks/domain/workshop/useWorkshopRoom';
import { MessageType, WorkshopSessionActionResultMessage } from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

describe('useWorkshopSessions', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => jest.clearAllMocks());

  it('owns named-session posts independently of room state', () => {
    const replacement: WorkshopRoomReplacementPort = {
      beginReplacement: jest.fn(() => ({ turns: [], totalTurns: 0, errorMessage: '' })),
      restoreReplacement: jest.fn()
    };
    const { result } = renderHook(() => useWorkshopSessions(replacement));
    const vscode = useVSCodeApi() as ReturnType<typeof createMockVSCode>;

    act(() => {
      result.current.saveSession('Room');
      result.current.openSession('saved-1');
      result.current.renameSession('saved-1', 'Renamed');
      result.current.deleteSession('saved-1');
    });

    expect(vscode.postMessage.mock.calls.map(([message]) => message.type)).toEqual([
      MessageType.WORKSHOP_SAVE_SESSION,
      MessageType.WORKSHOP_OPEN_SESSION,
      MessageType.WORKSHOP_RENAME_SESSION,
      MessageType.WORKSHOP_DELETE_SESSION
    ]);
  });

  it('restores the exact room snapshot when New Session is rejected', () => {
    const snapshot = {
      turns: [{ id: 'prior' } as never],
      totalTurns: 9,
      errorMessage: 'Keep the prior room error visible.'
    };
    const replacement: WorkshopRoomReplacementPort = {
      beginReplacement: jest.fn(() => snapshot),
      restoreReplacement: jest.fn()
    };
    const { result } = renderHook(() => useWorkshopSessions(replacement));

    act(() => result.current.resetSession());
    expect(replacement.beginReplacement).toHaveBeenCalledTimes(1);
    expect(result.current.sessionActionPending).toBe('new');

    const failure: WorkshopSessionActionResultMessage = {
      type: MessageType.WORKSHOP_SESSION_ACTION_RESULT,
      source: 'extension.workshop',
      timestamp: 1,
      payload: { action: 'new', ok: false, message: 'Could not replace the room.' }
    };
    act(() => result.current.handleSessionActionResult(failure));

    expect(replacement.restoreReplacement).toHaveBeenCalledWith(snapshot);
    expect(result.current.sessionActionPending).toBeUndefined();
  });
});
