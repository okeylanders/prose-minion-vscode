/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useCreativeVariationsAuthoring,
  type UseCreativeVariationsAuthoringOptions
} from '@hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring';
import {
  ADVISORY_RISK_ID,
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';

const options = (
  overrides: Partial<UseCreativeVariationsAuthoringOptions> = {}
): UseCreativeVariationsAuthoringOptions => ({
  open: true,
  activeExcerpt: null,
  contextAttachments: [],
  widgetModelId: 'anthropic/claude-sonnet-5',
  generationProgress: null,
  generationResult: null,
  requestSubjectSelection: jest.fn(),
  generate: jest.fn(() => 'cv-token-1'),
  cancelGeneration: jest.fn(),
  ...overrides
});

describe('useCreativeVariationsAuthoring', () => {
  afterEach(() => jest.clearAllMocks());

  it('keeps editor provenance only for the exact source-derived text', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    act(() => result.current.handleSubjectSelection({
      target: 'workshop_creative_variations_subject',
      content: 'Selected passage.',
      sourceUri: 'file:///private/work/draft.md',
      relativePath: 'chapters/draft.md',
      startLine: 12,
      endLine: 14
    }));

    expect(result.current.draft.subject).toEqual({
      text: 'Selected passage.',
      provenance: {
        kind: 'excerpt',
        relativePath: 'chapters/draft.md',
        startLine: 12,
        endLine: 14
      }
    });
    expect(JSON.stringify(result.current.draft.subject)).not.toContain('sourceUri');

    act(() => result.current.changeSubjectText('Selected passage, revised.'));
    expect(result.current.draft.subject).toEqual({
      text: 'Selected passage, revised.',
      provenance: { kind: 'pasted' }
    });
  });

  it('treats clipboard fallback intake as pasted without inventing provenance', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    act(() => result.current.handleSubjectSelection({
      target: 'workshop_creative_variations_subject',
      content: 'Clipboard passage.'
    }));

    expect(result.current.draft.subject).toEqual({
      text: 'Clipboard passage.',
      provenance: { kind: 'pasted' }
    });
  });

  it('starts generation with passage-only authoring input', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    act(() => result.current.changeSubjectText('Only this passage is required.'));
    act(() => result.current.generateWorkup());

    expect(props.generate).toHaveBeenCalledWith(expect.objectContaining({
      subject: {
        text: 'Only this passage is required.',
        provenance: { kind: 'pasted' }
      },
      invariants: { mustSurvive: '', mustNotChange: '' },
      intent: expect.objectContaining({ aim: '' })
    }));
    expect(result.current.generation).toEqual({
      kind: 'generating',
      detail: 'Requesting variations'
    });
  });

  it('projects progress and settles only the controller-owned attempt', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => {
      result.current.changeSubjectText('A passage.');
      result.current.changeMustSurvive('The refusal.');
      result.current.changeAim('Make the silence physical.');
    });
    act(() => result.current.generateWorkup());
    expect(result.current.generation).toEqual({
      kind: 'generating',
      detail: 'Requesting variations'
    });

    props.generationProgress = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: 'cvw-host',
      phase: 'streaming',
      stage: 'variations',
      outputCharacters: 1_250,
      estimatedOutputTokens: 313,
      outputTokenLimit: 45_000
    };
    rerender();
    expect(result.current.generation).toEqual({
      kind: 'generating',
      detail: 'Receiving variations · 1,250 characters'
    });

    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1-stale',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();
    expect(result.current.draft.workup).toBeNull();

    props.generationResult = {
      ...props.generationResult,
      token: 'cv-token-1'
    };
    rerender();
    expect(result.current.draft.workup).toEqual(generatedDraft.workup);
    expect(result.current.generation).toEqual({ kind: 'idle' });
  });

  it('invalidates the entire settled workup atomically on any authoring-input change', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => result.current.generateWorkup());
    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();

    act(() => {
      result.current.toggleCardSelection(2);
      result.current.changeCarryMode(2, 'full-prose');
      result.current.toggleAdvisoryRisk(2, ADVISORY_RISK_ID);
      result.current.changeNote('Keep this note.');
    });
    expect(result.current.draft.selections).toEqual([{
      position: 2,
      carryMode: 'full-prose',
      acceptedAdvisoryRiskIds: [ADVISORY_RISK_ID]
    }]);

    act(() => result.current.changeAim('A materially different aim.'));
    expect(result.current.draft.workup).toBeNull();
    expect(result.current.draft.selections).toEqual([]);
    expect(result.current.draft.note).toBe('Keep this note.');
  });

  it('invalidates settled work when a host-owned generation input changes', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => result.current.generateWorkup());
    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();
    act(() => result.current.toggleCardSelection(1));

    props.widgetModelId = 'openai/gpt-5.4';
    rerender();

    expect(result.current.draft.workup).toBeNull();
    expect(result.current.draft.selections).toEqual([]);
  });

  it('cancels the matching request and refuses a late result after close-style cancellation', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => result.current.generateWorkup());
    act(() => result.current.cancelGenerate());
    expect(props.cancelGeneration).toHaveBeenCalledWith('cv-token-1');
    expect(result.current.generation).toEqual({ kind: 'idle' });

    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();
    expect(result.current.draft.workup).toBeNull();
  });

  it('preserves every authoring input when generation fails', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => {
      result.current.changeSubjectText('Keep this passage.');
      result.current.changeMustSurvive('Keep this truth.');
      result.current.changeAim('Try another pressure.');
      result.current.generateWorkup();
    });
    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: 'cvw-failed',
      ok: false,
      error: 'Provider unavailable.'
    };
    rerender();

    expect(result.current.generation).toEqual({
      kind: 'failed',
      message: 'Provider unavailable.'
    });
    expect(result.current.draft).toMatchObject({
      subject: { text: 'Keep this passage.' },
      invariants: { mustSurvive: 'Keep this truth.' },
      intent: { aim: 'Try another pressure.' },
      workup: null,
      selections: []
    });
  });
});
