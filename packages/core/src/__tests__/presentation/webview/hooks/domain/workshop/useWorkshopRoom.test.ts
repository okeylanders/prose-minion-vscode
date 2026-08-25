/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { useWorkshopRoom } from '@hooks/domain/workshop/useWorkshopRoom';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  DEFAULT_WORKSHOP_WRITER_PROFILE,
  ErrorMessage,
  MessageType,
  WorkshopSessionStateMessage,
  WorkshopTurn
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const stateWithTurns = (turns: WorkshopTurn[], totalTurns = turns.length): WorkshopSessionStateMessage => ({
  type: MessageType.WORKSHOP_SESSION_STATE,
  source: 'extension.workshop',
  timestamp: 1,
  payload: {
    session: {
      scope: 'open',
      participantSubjectReady: true,
      excerptVersion: 0,
      replacementCount: 0,
      contextAttachments: [],
      pendingMessageAttachments: [],
      widgetConfigs: [],
      standingDirectives: [],
      todos: [],
      turns,
      totalTurns,
      truncatedTurns: Math.max(0, totalTurns - turns.length),
      roomHasMemory: turns.length > 0,
      participants: {
        host: { personaId: 'jill', hasConversation: turns.length > 0 },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      },
      conversationBehavior: { ...DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR }
    },
    writerProfile: { ...DEFAULT_WORKSHOP_WRITER_PROFILE },
    webResearch: { enabled: false },
    persistence: { available: true, degradedConversationKeys: [] }
  }
});

describe('useWorkshopRoom', () => {
  beforeEach(() => {
    (useVSCodeApi as jest.Mock).mockReturnValue(createMockVSCode());
  });

  afterEach(() => jest.clearAllMocks());

  it('requests host room truth on mount', () => {
    renderHook(() => useWorkshopRoom());
    const vscode = useVSCodeApi() as ReturnType<typeof createMockVSCode>;

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_REQUEST_SESSION,
      source: 'webview.workshop'
    }));
  });

  it('acknowledges a dismissed error to the host cache', () => {
    const { result } = renderHook(() => useWorkshopRoom());
    const vscode = useVSCodeApi() as ReturnType<typeof createMockVSCode>;
    vscode.postMessage.mockClear();

    act(() => result.current.clearError());

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_DISMISS_ERROR,
      source: 'webview.workshop',
      payload: {}
    }));
  });

  it('turns each restored transient send into a fresh composer seed', () => {
    const { result } = renderHook(() => useWorkshopRoom());
    const restored = (text: string) => ({
      type: MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED,
      source: 'extension.workshop',
      payload: { text },
      timestamp: 1
    } as const);

    act(() => result.current.handleComposerDraftRestored(restored('Try me again.')));
    const firstToken = result.current.composerDraftSeed?.token;
    expect(result.current.composerDraftSeed).toEqual({
      text: 'Try me again.',
      token: firstToken
    });

    act(() => result.current.handleComposerDraftRestored(restored('Try me again.')));
    expect(result.current.composerDraftSeed).toEqual({
      text: 'Try me again.',
      token: (firstToken ?? 0) + 1
    });
  });

  it('exposes the narrow optimistic-replacement port without owning session actions', () => {
    const priorTurns = [{
      id: 'turn-1',
      role: 'user',
      kind: 'message',
      participant: 'writer',
        artifact: 'tool_request',
        toolId: 'prose',
        toolLabel: 'Prose',
      content: 'Keep this visible if replacement fails.',
      timestamp: 1,
      excerptVersion: 0
    } as WorkshopTurn];
    const { result } = renderHook(() => useWorkshopRoom());
    act(() => result.current.handleSessionState(stateWithTurns(priorTurns, 5)));
    const priorError: ErrorMessage = {
      type: MessageType.ERROR,
      source: 'extension.workshop',
      payload: {
        source: 'workshop.session' as never,
        message: 'Keep this room error visible.'
      },
      timestamp: 1
    };
    act(() => result.current.handleErrorMessage(priorError));

    let snapshot: ReturnType<typeof result.current.replacementPort.beginReplacement>;
    act(() => { snapshot = result.current.replacementPort.beginReplacement(); });
    expect(result.current.turns).toEqual([]);
    expect(result.current.hiddenTurns).toBe(0);
    expect(result.current.errorMessage).toBe('');

    act(() => result.current.replacementPort.restoreReplacement(snapshot));
    expect(result.current.turns).toEqual(priorTurns);
    expect(result.current.hiddenTurns).toBe(4);
    expect(result.current.errorMessage).toBe('Keep this room error visible.');
  });
});
