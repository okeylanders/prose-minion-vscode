/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { useShowVsTell } from '@hooks/domain/workshop/widgets/showVsTell/useShowVsTell';
import {
  MessageType,
  type WorkshopWidgetActionResultMessage,
  type WorkshopShowVsTellGenerationProgressMessage,
  type WorkshopShowVsTellResultMessage
} from '@messages';
import {
  showVsTellGenerationDraft
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellDerivations';
import { createMockVSCode } from '@/__tests__/mocks/vscode';
import {
  generatedShowVsTellDraft,
  ungeneratedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const input = showVsTellGenerationDraft(ungeneratedShowVsTellDraft());

const progress = (
  token: string,
  workupId: string,
  phase: WorkshopShowVsTellGenerationProgressMessage['payload']['phase']
): WorkshopShowVsTellGenerationProgressMessage => ({
  type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATION_PROGRESS,
  source: 'extension.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'show-vs-tell',
    token,
    workupId,
    phase,
    stage: 'requesting',
    outputCharacters: 0,
    estimatedOutputTokens: 0,
    outputTokenLimit: 16_000
  }
});

const okResult = (token: string, workupId: string): WorkshopShowVsTellResultMessage => ({
  type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
  source: 'extension.workshop',
  timestamp: 2,
  payload: {
    widgetId: 'show-vs-tell',
    token,
    workupId,
    ok: true,
    workup: { ...generatedShowVsTellDraft().workup!, workupId }
  }
});

const failedResult = (token: string, workupId: string): WorkshopShowVsTellResultMessage => ({
  type: MessageType.WORKSHOP_SHOW_VS_TELL_RESULT,
  source: 'extension.workshop',
  timestamp: 2,
  payload: { widgetId: 'show-vs-tell', token, workupId, ok: false, error: 'No workup.' }
});

describe('useShowVsTell', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('requests beat intake on its own target', () => {
    const { result } = renderHook(() => useShowVsTell());

    act(() => result.current.requestBeatSelection());

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.REQUEST_SELECTION,
      payload: { target: 'workshop_show_vs_tell_beat' }
    }));
  });

  it('mints a fresh token per Generate and sends only the generation inputs', () => {
    const { result } = renderHook(() => useShowVsTell());
    let first = '';
    let second = '';

    act(() => {
      first = result.current.generate(input);
      second = result.current.generate(input);
    });

    expect(first).not.toBe(second);
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE,
      payload: {
        widgetId: 'show-vs-tell',
        token: second,
        beat: input.beat,
        surroundingContext: input.surroundingContext,
        pov: input.pov,
        invariants: input.invariants,
        channels: input.channels,
        lengthBudget: input.lengthBudget,
        position: input.position
      }
    }));
  });

  it('never sends workup, kept, note, or passage text even if the caller passes them', () => {
    const { result } = renderHook(() => useShowVsTell());

    act(() => {
      result.current.generate({
        ...input,
        note: 'private',
        kept: [],
        workup: null,
        writerText: 'passage'
      } as typeof input);
    });

    const payload = vscode.postMessage.mock.calls[0][0].payload;
    expect(Object.keys(payload).sort()).toEqual([
      'beat', 'channels', 'invariants', 'lengthBudget', 'position', 'pov',
      'surroundingContext', 'token', 'widgetId'
    ]);
  });

  it('accepts the correlated progress and result, then ignores a duplicate result', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });

    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-1', 'started')));
    expect(result.current.generationProgress?.workupId).toBe('svtw-1');

    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-1', 'completed')));
    act(() => result.current.handleGenerationResult(okResult(token, 'svtw-1')));

    expect(result.current.generationProgress).toBeNull();
    expect(result.current.generationResult).toMatchObject({ ok: true, workupId: 'svtw-1' });

    act(() => result.current.handleGenerationResult(failedResult(token, 'svtw-1')));
    expect(result.current.generationResult).toMatchObject({ ok: true });
  });

  it('delivers a failed attempt as terminal progress followed by the ok:false result', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });

    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-9', 'completed')));
    act(() => result.current.handleGenerationResult(failedResult(token, 'svtw-9')));

    expect(result.current.generationResult).toEqual({
      widgetId: 'show-vs-tell', token, workupId: 'svtw-9', ok: false, error: 'No workup.'
    });
  });

  it('ignores progress and results for tokens it is not waiting on', () => {
    const { result } = renderHook(() => useShowVsTell());
    let first = '';
    let second = '';
    act(() => { first = result.current.generate(input); });
    act(() => { second = result.current.generate(input); });

    act(() => result.current.handleGenerationProgress(progress(first, 'svtw-old', 'streaming')));
    act(() => result.current.handleGenerationResult(okResult(first, 'svtw-old')));
    expect(result.current.generationProgress).toBeNull();
    expect(result.current.generationResult).toBeNull();

    act(() => result.current.handleGenerationProgress(progress(second, 'svtw-new', 'started')));
    expect(result.current.generationProgress?.token).toBe(second);
  });

  it('ignores a later message whose workup id differs from the latched one', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });
    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-a', 'started')));

    act(() => result.current.handleGenerationResult(okResult(token, 'svtw-b')));

    expect(result.current.generationResult).toBeNull();
  });

  it('rejects a result whose workup carries a different id than the envelope', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });
    const message = okResult(token, 'svtw-a');
    if (message.payload.ok) {
      message.payload.workup = { ...message.payload.workup, workupId: 'svtw-other' };
    }

    act(() => result.current.handleGenerationResult(message));

    expect(result.current.generationResult).toBeNull();
  });

  it('ends the attempt on a cancelled phase: a later result for that token is ignored', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });

    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-1', 'cancelled')));
    act(() => result.current.handleGenerationResult(okResult(token, 'svtw-1')));

    expect(result.current.generationProgress).toMatchObject({ phase: 'cancelled' });
    expect(result.current.generationResult).toBeNull();
  });

  it('cancels the active attempt through the cancel route and clears transient state', () => {
    const { result } = renderHook(() => useShowVsTell());
    let token = '';
    act(() => { token = result.current.generate(input); });
    act(() => result.current.handleGenerationProgress(progress(token, 'svtw-1', 'streaming')));

    act(() => result.current.cancelGeneration(token));

    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST,
      payload: expect.objectContaining({ domain: 'workshop-show-vs-tell', requestId: token })
    }));
    expect(result.current.generationProgress).toBeNull();

    act(() => result.current.handleGenerationResult(okResult(token, 'svtw-1')));
    expect(result.current.generationResult).toBeNull();
  });

  it('does not cancel when asked about a token it is not waiting on', () => {
    const { result } = renderHook(() => useShowVsTell());
    act(() => { result.current.generate(input); });
    vscode.postMessage.mockClear();

    act(() => result.current.cancelGeneration('some-other-token'));

    expect(vscode.postMessage).not.toHaveBeenCalled();
  });

  describe('commit', () => {
    const commitResult = (
      requestToken: string,
      overrides: Partial<Extract<WorkshopWidgetActionResultMessage['payload'], { action: 'commit' }>> = {}
    ): WorkshopWidgetActionResultMessage => ({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 1,
      payload: {
        action: 'commit',
        requestToken,
        widgetId: 'show-vs-tell',
        ok: true,
        widgetConfigId: 'wc-2',
        turnId: 'turn-2',
        ...overrides
      } as never
    });

    it('posts the draft unchanged under a fresh token and refuses a duplicate while pending', () => {
      const draft = generatedShowVsTellDraft();
      const { result } = renderHook(() => useShowVsTell());
      let first: string | undefined;
      let duplicate: string | undefined;
      act(() => {
        first = result.current.commit({ widgetId: 'show-vs-tell', draft });
        duplicate = result.current.commit({ widgetId: 'show-vs-tell', draft });
      });

      expect(first).toEqual(expect.any(String));
      expect(duplicate).toBeUndefined();
      expect(result.current.commitPending).toBe(true);
      expect(vscode.postMessage).toHaveBeenCalledTimes(1);
      expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: MessageType.WORKSHOP_COMMIT_WIDGET,
        source: 'webview.workshop.show-vs-tell',
        payload: { widgetId: 'show-vs-tell', requestToken: first, draft }
      }));
    });

    it('carries the clone lineage and mints a new token per attempt', () => {
      const draft = generatedShowVsTellDraft();
      const { result } = renderHook(() => useShowVsTell());
      let first = '';
      act(() => { first = result.current.commit({ widgetId: 'show-vs-tell', draft })!; });
      act(() => result.current.handleCommitResult(commitResult(first, { ok: false, message: 'Try again.' } as never)));
      let second: string | undefined;
      act(() => {
        second = result.current.commit({
          widgetId: 'show-vs-tell',
          draft,
          clonedFromConfigId: 'wc-1'
        });
      });

      expect(second).toEqual(expect.any(String));
      expect(second).not.toBe(first);
      expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
        payload: expect.objectContaining({ clonedFromConfigId: 'wc-1', requestToken: second })
      }));
    });

    it('ignores stale-token and wrong-widget results, then accepts the exact one', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { result } = renderHook(() => useShowVsTell());
      let token = '';
      act(() => { token = result.current.commit({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() })!; });

      act(() => result.current.handleCommitResult(commitResult(`${token}-stale`)));
      act(() => result.current.handleCommitResult(commitResult(token, { widgetId: 'creative-variations' })));
      expect(result.current.commitPending).toBe(true);
      expect(result.current.commitResult).toBeNull();

      act(() => result.current.handleCommitResult(commitResult(token)));
      expect(result.current.commitPending).toBe(false);
      expect(result.current.commitResult).toEqual(expect.objectContaining({
        ok: true,
        widgetConfigId: 'wc-2',
        turnId: 'turn-2'
      }));
      act(() => result.current.clearCommitResult());
      expect(result.current.commitResult).toBeNull();
      warn.mockRestore();
    });

    it('resets a lost acknowledgement before a new sheet starts', () => {
      const { result } = renderHook(() => useShowVsTell());
      act(() => { result.current.commit({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() }); });
      expect(result.current.commitPending).toBe(true);

      act(() => result.current.resetCommitState());

      expect(result.current.commitPending).toBe(false);
      let retry: string | undefined;
      act(() => { retry = result.current.commit({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() }); });
      expect(retry).toEqual(expect.any(String));
    });
  });

  it('posts no editor mutation on any path: intake, generate, cancel, and commit', () => {
    const { result } = renderHook(() => useShowVsTell());
    act(() => {
      result.current.requestBeatSelection();
      result.current.generate(input);
    });
    act(() => result.current.cancelGeneration());
    act(() => { result.current.commit({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() }); });

    const posted = vscode.postMessage.mock.calls.map(([message]: [{ type: string }]) => message.type);
    expect(posted.sort()).toEqual([
      MessageType.CANCEL_SHOW_VS_TELL_GENERATE_REQUEST,
      MessageType.REQUEST_SELECTION,
      MessageType.WORKSHOP_COMMIT_WIDGET,
      MessageType.WORKSHOP_SHOW_VS_TELL_GENERATE
    ].sort());
    expect(posted.join(' ')).not.toMatch(/edit|insert|apply|replace|write/i);
  });
});
