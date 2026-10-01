/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useWorkshopSessionSurfaces,
  UseWorkshopSessionSurfacesOptions
} from '@hooks/domain/workshop/controllers/useWorkshopSessionSurfaces';
import { WorkshopSessionSummary } from '@messages';

const savedSession: WorkshopSessionSummary = {
  sessionId: 'saved-1',
  title: 'Chapter room',
  fileName: 'saved-1.json',
  kind: 'named',
  startedAt: 1,
  updatedAt: 2,
  savedAt: 2,
  timezone: 'America/Chicago',
  hostPersonaId: 'jill',
  participantPersonaIds: ['jill'],
  turnCount: 4,
  excerptWordCount: 300
};

const options = (
  overrides: Partial<UseWorkshopSessionSurfacesOptions> = {}
): UseWorkshopSessionSurfacesOptions => ({
  sessionReady: true,
  persistenceAvailable: true,
  sessionMutationsDisabled: false,
  hasReplaceableSessionState: false,
  hasWorkingSet: false,
  sessionSearchQuery: '',
  requestSessions: jest.fn(),
  setSessionSearchQuery: jest.fn(),
  resetSession: jest.fn(),
  openSession: jest.fn(),
  rewindTo: jest.fn(),
  consumeSessionActionResult: jest.fn(),
  onResult: jest.fn(),
  ...overrides
});

describe('useWorkshopSessionSurfaces', () => {
  beforeEach(() => jest.useFakeTimers());

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('initializes the list once and debounces browser searches', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useWorkshopSessionSurfaces(props));
    expect(props.requestSessions).toHaveBeenCalledWith('');

    act(() => result.current.openSessionBrowser());
    expect(props.setSessionSearchQuery).toHaveBeenCalledWith('');
    expect(result.current.sessionBrowserOpen).toBe(true);

    act(() => jest.advanceTimersByTime(219));
    expect(props.requestSessions).toHaveBeenCalledTimes(1);
    act(() => jest.advanceTimersByTime(1));
    expect(props.requestSessions).toHaveBeenCalledTimes(2);

    rerender();
    expect(props.requestSessions).toHaveBeenCalledTimes(2);
  });

  it('owns replacement confirmations and returns only the shelf resume command', () => {
    const props = options({ hasReplaceableSessionState: true, hasWorkingSet: true });
    const { result } = renderHook(() => useWorkshopSessionSurfaces(props));

    act(() => result.current.startNewSession());
    expect(result.current.sessionConfirm).toEqual({ kind: 'new' });
    act(() => result.current.acceptSessionConfirm());
    expect(props.resetSession).toHaveBeenCalledWith();

    act(() => result.current.openStoredSession(savedSession));
    expect(result.current.sessionConfirm).toMatchObject({ kind: 'open', sessionId: 'saved-1' });
    act(() => result.current.acceptSessionConfirm());
    expect(props.openSession).toHaveBeenCalledWith('saved-1');

    act(() => result.current.requestShelfReplacement('paste'));
    let resumption: { resume: 'paste' | 'choose' } | undefined;
    act(() => { resumption = result.current.acceptSessionConfirm(); });
    expect(resumption).toEqual({ resume: 'paste' });
    expect(result.current.sessionConfirm).toBeNull();
  });

  it('confirms a rewind before posting it, and forgets it on cancel', () => {
    const props = options({ hasReplaceableSessionState: true });
    const { result } = renderHook(() => useWorkshopSessionSurfaces(props));

    act(() => result.current.requestRewind('turn-3-assistant-3', 2, false));
    expect(result.current.sessionConfirm).toEqual({
      kind: 'rewind',
      turnId: 'turn-3-assistant-3',
      removedCount: 2,
      edit: false
    });
    expect(props.rewindTo).not.toHaveBeenCalled();
    act(() => result.current.cancelSessionConfirm());
    expect(result.current.sessionConfirm).toBeNull();

    act(() => result.current.requestRewind('turn-2-user-2', 3, true));
    let resumption: ReturnType<typeof result.current.acceptSessionConfirm>;
    act(() => { resumption = result.current.acceptSessionConfirm(); });
    expect(resumption!).toBeUndefined();
    expect(props.rewindTo).toHaveBeenCalledWith('turn-2-user-2');
    expect(result.current.sessionConfirm).toBeNull();
  });

  it('settles session results, closes matching surfaces, and refreshes authoritatively', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useWorkshopSessionSurfaces(props));
    act(() => result.current.openSaveSessionModal());
    expect(result.current.saveSessionModalOpen).toBe(true);

    props.sessionActionResult = {
      action: 'save',
      ok: true,
      message: 'Saved.'
    };
    rerender();

    expect(props.onResult).toHaveBeenCalledWith(props.sessionActionResult);
    expect(props.requestSessions).toHaveBeenLastCalledWith('');
    expect(props.consumeSessionActionResult).toHaveBeenCalledTimes(1);
    expect(result.current.saveSessionModalOpen).toBe(false);
  });

  it('keeps the save surface open and skips hidden-list refresh when save fails', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useWorkshopSessionSurfaces(props));
    act(() => result.current.openSaveSessionModal());
    (props.requestSessions as jest.Mock).mockClear();

    props.sessionActionResult = {
      action: 'save',
      ok: false,
      message: 'Could not save.'
    };
    rerender();

    expect(result.current.saveSessionModalOpen).toBe(true);
    expect(props.onResult).toHaveBeenCalledWith(props.sessionActionResult);
    expect(props.requestSessions).not.toHaveBeenCalled();
    expect(props.consumeSessionActionResult).toHaveBeenCalledTimes(1);
  });

  it.each(['open', 'new'] as const)(
    'keeps the browser open and preserves its filter when %s fails',
    (action) => {
      const props = options({ sessionSearchQuery: 'chapter' });
      const { result, rerender } = renderHook(() => useWorkshopSessionSurfaces(props));
      act(() => result.current.openSessionBrowser());
      (props.requestSessions as jest.Mock).mockClear();

      props.sessionActionResult = {
        action,
        ok: false,
        message: `Could not ${action}.`
      };
      rerender();

      expect(result.current.sessionBrowserOpen).toBe(true);
      expect(props.requestSessions).toHaveBeenCalledWith();
      expect(props.requestSessions).not.toHaveBeenCalledWith('');
    }
  );

  it('routes shortcuts only outside editable controls and behind mutation gates', () => {
    const props = options();
    const { result } = renderHook(() => useWorkshopSessionSurfaces(props));

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 's', metaKey: true, bubbles: true
    })));
    expect(result.current.saveSessionModalOpen).toBe(true);

    const input = document.createElement('input');
    document.body.appendChild(input);
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'n', metaKey: true, shiftKey: true, bubbles: true
    })));
    expect(props.resetSession).not.toHaveBeenCalled();
    input.remove();
  });
});
