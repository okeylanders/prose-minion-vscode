/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useCreativeVariations
} from '@hooks/domain/workshop/widgets/creativeVariations/useCreativeVariations';
import {
  MessageType,
  type WorkshopCreativeVariationsDraft,
  type WorkshopCreativeVariationsWorkup
} from '@messages';
import { createMockVSCode } from '@/__tests__/mocks/vscode';

jest.mock('@hooks/useVSCodeApi');

import { useVSCodeApi } from '@hooks/useVSCodeApi';

const draft: WorkshopCreativeVariationsDraft = {
  subject: { text: 'The passage.', provenance: { kind: 'pasted' } },
  surroundingContext: { writerText: '', sourceReferences: [] },
  invariants: { mustSurvive: 'The refusal.', mustNotChange: '' },
  intent: { kind: 'custom-aim', aim: 'Try a quieter pressure.', distance: 'tail' },
  requestedCount: 3,
  workup: null,
  selections: [],
  note: 'This must not travel in the generation request.'
};

const workup = (workupId: string): WorkshopCreativeVariationsWorkup => ({
  workupId
} as WorkshopCreativeVariationsWorkup);

describe('useCreativeVariations', () => {
  let vscode: ReturnType<typeof createMockVSCode>;

  beforeEach(() => {
    vscode = createMockVSCode();
    (useVSCodeApi as jest.Mock).mockReturnValue(vscode);
  });

  afterEach(() => jest.clearAllMocks());

  it('mints a fresh token for every exact generation draft and requests subject intake', () => {
    const { result } = renderHook(() => useCreativeVariations());
    let first = '';
    let second = '';

    act(() => {
      result.current.requestSubjectSelection();
      first = result.current.generate(draft);
      second = result.current.generate(draft);
    });

    expect(first).not.toBe(second);
    expect(vscode.postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: MessageType.REQUEST_SELECTION,
      payload: { target: 'workshop_creative_variations_subject' }
    }));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE,
      payload: {
        widgetId: 'creative-variations',
        token: second,
        subject: draft.subject,
        surroundingContext: draft.surroundingContext,
        invariants: draft.invariants,
        intent: draft.intent,
        requestedCount: draft.requestedCount
      }
    }));
  });

  it('keeps authored blank optional inputs distinguishable on the wire', () => {
    const { result } = renderHook(() => useCreativeVariations());

    act(() => {
      result.current.generate({
        ...draft,
        invariants: { mustSurvive: '', mustNotChange: '' },
        intent: { ...draft.intent, aim: '   ' }
      });
    });

    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATE,
      payload: expect.objectContaining({
        invariants: { mustSurvive: '', mustNotChange: '' },
        intent: expect.objectContaining({ aim: '   ' })
      })
    }));
  });

  it('clears settled transient results even when no request remains to cancel', () => {
    const { result } = renderHook(() => useCreativeVariations());
    let token = '';
    act(() => {
      token = result.current.generate(draft);
    });
    act(() => result.current.handleGenerationResult({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
      source: 'extension.workshop',
      timestamp: 1,
      payload: {
        widgetId: 'creative-variations',
        token,
        workupId: 'cvw-settled',
        ok: true,
        workup: workup('cvw-settled')
      }
    }));
    expect(result.current.generationResult).not.toBeNull();
    jest.clearAllMocks();

    act(() => result.current.cancelGeneration());

    expect(result.current.generationResult).toBeNull();
    expect(result.current.generationProgress).toBeNull();
    expect(vscode.postMessage).not.toHaveBeenCalled();
  });

  it('latches the host workup id and ignores stale progress and results', () => {
    const { result } = renderHook(() => useCreativeVariations());
    let token = '';
    act(() => {
      token = result.current.generate(draft);
    });

    act(() => result.current.handleGenerationProgress({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS,
      source: 'extension.workshop',
      timestamp: 1,
      payload: {
        widgetId: 'creative-variations',
        token,
        workupId: 'cvw-current',
        phase: 'streaming',
        stage: 'variations',
        outputCharacters: 1_000,
        estimatedOutputTokens: 250,
        outputTokenLimit: 45_000
      }
    }));
    expect(result.current.generationProgress?.workupId).toBe('cvw-current');

    act(() => result.current.handleGenerationProgress({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_GENERATION_PROGRESS,
      source: 'extension.workshop',
      timestamp: 2,
      payload: {
        widgetId: 'creative-variations',
        token,
        workupId: 'cvw-stale',
        phase: 'streaming',
        stage: 'variations',
        outputCharacters: 9_000,
        estimatedOutputTokens: 2_250,
        outputTokenLimit: 45_000
      }
    }));
    expect(result.current.generationProgress?.outputCharacters).toBe(1_000);

    act(() => result.current.handleGenerationResult({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
      source: 'extension.workshop',
      timestamp: 3,
      payload: {
        widgetId: 'creative-variations',
        token: `${token}-old`,
        workupId: 'cvw-current',
        ok: true,
        workup: workup('cvw-current')
      }
    }));
    expect(result.current.generationResult).toBeNull();

    act(() => result.current.handleGenerationResult({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
      source: 'extension.workshop',
      timestamp: 4,
      payload: {
        widgetId: 'creative-variations',
        token,
        workupId: 'cvw-current',
        ok: true,
        workup: workup('cvw-current')
      }
    }));
    expect(result.current.generationResult).toMatchObject({
      ok: true,
      token,
      workupId: 'cvw-current'
    });
    expect(result.current.generationProgress).toBeNull();
  });

  it('cancels only the active matching token and rejects every late callback', () => {
    const { result } = renderHook(() => useCreativeVariations());
    let token = '';
    act(() => {
      token = result.current.generate(draft);
      result.current.cancelGeneration('not-the-current-token');
    });
    expect(vscode.postMessage).toHaveBeenCalledTimes(1);

    act(() => result.current.cancelGeneration(token));
    expect(vscode.postMessage).toHaveBeenLastCalledWith(expect.objectContaining({
      type: MessageType.CANCEL_CREATIVE_VARIATIONS_GENERATE_REQUEST,
      payload: {
        domain: 'workshop-creative-variations',
        requestId: token
      }
    }));

    act(() => result.current.handleGenerationResult({
      type: MessageType.WORKSHOP_CREATIVE_VARIATIONS_RESULT,
      source: 'extension.workshop',
      timestamp: 1,
      payload: {
        widgetId: 'creative-variations',
        token,
        workupId: 'cvw-late',
        ok: true,
        workup: workup('cvw-late')
      }
    }));
    expect(result.current.generationResult).toBeNull();
  });

  it('mints a fresh commit token per settled attempt and prevents duplicate submission', () => {
    const { result } = renderHook(() => useCreativeVariations());
    let first: string | undefined;
    let duplicate: string | undefined;
    act(() => {
      first = result.current.commit({ widgetId: 'creative-variations', draft });
      duplicate = result.current.commit({ widgetId: 'creative-variations', draft });
    });

    expect(first).toEqual(expect.any(String));
    expect(duplicate).toBeUndefined();
    expect(result.current.commitPending).toBe(true);
    expect(vscode.postMessage).toHaveBeenCalledTimes(1);
    expect(vscode.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_COMMIT_WIDGET,
      payload: {
        widgetId: 'creative-variations',
        requestToken: first,
        draft
      }
    }));

    act(() => result.current.handleCommitResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 1,
      payload: {
        action: 'commit',
        requestToken: first!,
        widgetId: 'creative-variations',
        ok: false,
        message: 'Try again.'
      }
    }));
    let second: string | undefined;
    act(() => {
      second = result.current.commit({
        widgetId: 'creative-variations',
        draft,
        clonedFromConfigId: 'wc-1'
      });
    });

    expect(second).toEqual(expect.any(String));
    expect(second).not.toBe(first);
    expect(vscode.postMessage).toHaveBeenCalledTimes(2);
  });

  it('ignores stale-token and wrong-widget commit results, then accepts the exact result', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { result } = renderHook(() => useCreativeVariations());
    let token = '';
    act(() => {
      token = result.current.commit({ widgetId: 'creative-variations', draft })!;
    });

    act(() => result.current.handleCommitResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 1,
      payload: {
        action: 'commit',
        requestToken: `${token}-stale`,
        widgetId: 'creative-variations',
        ok: false,
        message: 'Stale.'
      }
    }));
    act(() => result.current.handleCommitResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 2,
      payload: {
        action: 'commit',
        requestToken: token,
        widgetId: 'gesture-playground',
        ok: true,
        widgetConfigId: 'wc-wrong',
        turnId: 'turn-wrong'
      }
    }));

    expect(result.current.commitPending).toBe(true);
    expect(result.current.commitResult).toBeNull();

    act(() => result.current.handleCommitResult({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      source: 'extension.workshop.widget',
      timestamp: 3,
      payload: {
        action: 'commit',
        requestToken: token,
        widgetId: 'creative-variations',
        ok: true,
        widgetConfigId: 'wc-2',
        turnId: 'turn-2'
      }
    }));

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
});
