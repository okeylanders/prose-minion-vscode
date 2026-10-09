/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import { useShowVsTell } from '@hooks/domain/workshop/widgets/showVsTell/useShowVsTell';
import {
  MessageType,
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
});
