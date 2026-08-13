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
import {
  CREATIVE_VARIATIONS_RANDOM_AIM
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDerivations';
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

  it('projects blank optional inputs to a random aim and no preservation constraint', () => {
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
        intent: expect.objectContaining({ aim: CREATIVE_VARIATIONS_RANDOM_AIM })
      })
    }));
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
});
