/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  createCreativeVariationsAuthoringDraft,
  useCreativeVariationsAuthoring,
  type UseCreativeVariationsAuthoringOptions
} from '@hooks/domain/workshop/controllers/creativeVariations/useCreativeVariationsAuthoring';
import {
  buildCreativeVariationsArtifact
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact';
import { MessageType, type SelectionDataMessage } from '@messages';
import {
  ADVISORY_RISK_ID,
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const options = (
  overrides: Partial<UseCreativeVariationsAuthoringOptions> = {}
): UseCreativeVariationsAuthoringOptions => ({
  opening: { kind: 'new' },
  activeExcerpt: null,
  contextAttachments: [],
  widgetModelId: 'anthropic/claude-sonnet-5',
  generationProgress: null,
  generationResult: null,
  requestSubjectSelection: jest.fn(),
  generate: jest.fn(() => 'cv-token-1'),
  cancelGeneration: jest.fn(),
  roomRunActive: false,
  toolTargetActive: false,
  commitPending: false,
  commitOutcome: null,
  commit: jest.fn(),
  clearCommitResult: jest.fn(),
  resetCommitState: jest.fn(),
  onCommitAccepted: jest.fn(),
  ...overrides
});

const cloneOpening = (
  draft = generatedDraft,
  id = 'wc-original'
): NonNullable<UseCreativeVariationsAuthoringOptions['opening']> => ({
  kind: 'clone',
  config: {
    id,
    widgetId: 'creative-variations',
    revision: 1,
    createdAt: 1,
    draft: clone(draft)
  }
});

const selectionData = (
  payload: Omit<SelectionDataMessage['payload'], 'target'>
): SelectionDataMessage => ({
  type: MessageType.SELECTION_DATA,
  source: 'extension.ui',
  timestamp: 1,
  payload: { target: 'workshop_creative_variations_subject', ...payload }
});

describe('useCreativeVariationsAuthoring', () => {
  afterEach(() => jest.clearAllMocks());

  it('seeds only editable authoring inputs from a persona recommendation', () => {
    const props = options({
      opening: {
        kind: 'seed',
        personaId: 'jill',
        personaLabel: 'Jill',
        seed: {
          subjectText: 'She turned the mug until the chip faced the wall.',
          contextText: 'Nate waited across the table.',
          sourceReferences: [{ kind: 'active-excerpt' }],
          mustSurvive: 'The refusal remains implicit.',
          mustNotChange: 'Keep close third person.',
          aim: '',
          distance: 'far-tail',
          requestedCount: 5
        }
      }
    });
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    expect(result.current.draft).toEqual({
      subject: {
        text: 'She turned the mug until the chip faced the wall.',
        provenance: {
          kind: 'persona-prefill',
          personaId: 'jill',
          editedByWriter: false
        }
      },
      surroundingContext: {
        writerText: 'Nate waited across the table.',
        sourceReferences: [{ kind: 'active-excerpt' }]
      },
      invariants: {
        mustSurvive: 'The refusal remains implicit.',
        mustNotChange: 'Keep close third person.'
      },
      intent: { kind: 'custom-aim', aim: '', distance: 'far-tail' },
      requestedCount: 5,
      workup: null,
      selections: [],
      note: ''
    });
    expect(props.generate).not.toHaveBeenCalled();
    expect(props.commit).not.toHaveBeenCalled();

    act(() => result.current.changeSubjectText('Writer-edited passage.'));
    expect(result.current.draft.subject.provenance).toEqual({
      kind: 'persona-prefill',
      personaId: 'jill',
      editedByWriter: true
    });
  });

  it('keeps editor provenance only for the exact source-derived text', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    act(() => result.current.handleSubjectSelection(selectionData({
      content: 'Selected passage.',
      sourceUri: 'file:///private/work/draft.md',
      relativePath: 'chapters/draft.md',
      startLine: 12,
      endLine: 14
    })));

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

    act(() => result.current.handleSubjectSelection(selectionData({
      content: 'Clipboard passage.'
    })));

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
    expect(result.current.commitBlockers).toEqual([
      'generation-in-flight',
      'no-workup'
    ]);
  });

  it('ignores an identical repeated subject selection after a workup settles', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    const selection = selectionData({
      content: 'Selected passage.',
      sourceUri: 'file:///private/work/draft.md',
      relativePath: 'chapters/draft.md',
      startLine: 12,
      endLine: 14
    });
    act(() => result.current.handleSubjectSelection(selection));
    act(() => result.current.generateWorkup());
    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();
    jest.clearAllMocks();

    act(() => result.current.handleSubjectSelection(selection));

    expect(result.current.draft.workup).toEqual(generatedDraft.workup);
    expect(props.cancelGeneration).not.toHaveBeenCalled();
    expect(result.current.invalidationNotice).toBeNull();
  });

  it('declines a late subject-selection response while generation is active', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => result.current.changeSubjectText('The generating passage.'));
    act(() => result.current.generateWorkup());
    jest.clearAllMocks();

    act(() => result.current.handleSubjectSelection(selectionData({
      content: 'A late host reply.'
    })));

    expect(result.current.draft.subject.text).toBe('The generating passage.');
    expect(result.current.generation.kind).toBe('generating');
    expect(props.cancelGeneration).not.toHaveBeenCalled();
  });

  it('does not cancel generation for a value-identical input update', () => {
    const props = options();
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => result.current.changeSubjectText('The generating passage.'));
    act(() => result.current.generateWorkup());
    jest.clearAllMocks();

    act(() => result.current.changeSubjectText('The generating passage.'));

    expect(result.current.generation.kind).toBe('generating');
    expect(props.cancelGeneration).not.toHaveBeenCalled();
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
    expect(result.current.invalidationNotice).toBe(
      'Generated workup cleared because the creative aim changed.'
    );
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
    expect(result.current.invalidationNotice).toBe(
      'Generated workup cleared because the widget model changed.'
    );
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

  it('resets every transient value when a fresh sheet reopens', () => {
    const props = options();
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));
    act(() => {
      result.current.changeSubjectText('A passage that belongs to the first sheet.');
      result.current.changeAim('An aim that must not reopen.');
      result.current.generateWorkup();
    });
    props.generationResult = {
      widgetId: 'creative-variations',
      token: 'cv-token-1',
      workupId: generatedDraft.workup!.workupId,
      ok: true,
      workup: generatedDraft.workup!
    };
    rerender();

    props.opening = null;
    rerender();
    props.opening = { kind: 'new' };
    rerender();

    expect(result.current.draft).toEqual(createCreativeVariationsAuthoringDraft());
    expect(result.current.generation).toEqual({ kind: 'idle' });
    expect(result.current.invalidationNotice).toBeNull();
  });

  it('reopens the exact authored clone with idle transient presentation state', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      intent: { ...generatedDraft.intent, aim: '' },
      selections: [{
        position: 2,
        carryMode: 'full-prose' as const,
        acceptedAdvisoryRiskIds: [ADVISORY_RISK_ID]
      }],
      note: 'Keep the silence.'
    };
    const props = options({
      opening: cloneOpening(reopenedDraft),
      generationProgress: {
        widgetId: 'creative-variations',
        token: 'stale-generate',
        workupId: generatedDraft.workup!.workupId,
        phase: 'streaming',
        stage: 'variations',
        outputCharacters: 10,
        estimatedOutputTokens: 3,
        outputTokenLimit: 45_000
      },
      commitOutcome: { ok: false, message: 'Stale commit failure.' }
    });
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    expect(result.current.draft).toEqual(reopenedDraft);
    expect(result.current.draft.intent.aim).toBe('');
    expect(result.current.generation).toEqual({ kind: 'idle' });
    expect(result.current.commitError).toBeNull();
    expect(result.current.invalidationNotice).toBeNull();
    expect(props.resetCommitState).toHaveBeenCalled();
  });

  it('commits an eligible clone under its source config without mutating the draft', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 1, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }]
    };
    const props = options({ opening: cloneOpening(reopenedDraft, 'wc-7') });
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    expect(result.current.commitBlockers).toEqual([]);
    act(() => result.current.commitDraft());

    expect(props.commit).toHaveBeenCalledWith(reopenedDraft, 'wc-7');
    expect(result.current.draft).toEqual(reopenedDraft);
  });

  it('binds clone lineage to the draft seed rather than a later opening response', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 1, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }]
    };
    const props = options({ opening: cloneOpening(reopenedDraft, 'wc-7') });
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));

    props.opening = cloneOpening(reopenedDraft, 'wc-99');
    rerender();
    act(() => result.current.commitDraft());

    expect(props.commit).toHaveBeenCalledWith(reopenedDraft, 'wc-7');
  });

  it('locks duplicate commit and destructive authoring changes while commit is pending', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 1, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }],
      note: 'Exact note.'
    };
    const props = options({
      opening: cloneOpening(reopenedDraft),
      commitPending: true
    });
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    act(() => {
      result.current.changeAim('Do not apply.');
      result.current.changeNote('Do not apply.');
      result.current.toggleCardSelection(1);
      result.current.generateWorkup();
      result.current.commitDraft();
    });

    expect(result.current.draft).toEqual(reopenedDraft);
    expect(result.current.commitBlockers).toContain('commit-in-flight');
    expect(props.generate).not.toHaveBeenCalled();
    expect(props.commit).not.toHaveBeenCalled();
  });

  it('preserves the exact authored clone on host refusal and closes only on acceptance', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 1, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }],
      note: 'Keep all of this.'
    };
    const props = options({ opening: cloneOpening(reopenedDraft) });
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));

    props.commitOutcome = { ok: false, message: 'The room refused this attempt.' };
    rerender();
    expect(result.current.draft).toEqual(reopenedDraft);
    expect(result.current.commitError).toBe('The room refused this attempt.');
    expect(props.onCommitAccepted).not.toHaveBeenCalled();

    props.commitOutcome = { ok: true };
    rerender();
    expect(props.onCommitAccepted).toHaveBeenCalledTimes(1);
    expect(props.clearCommitResult).toHaveBeenCalled();
  });

  it('defers model invalidation until a pending commit settles', () => {
    const reopenedDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 1, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }]
    };
    const props = options({
      opening: cloneOpening(reopenedDraft),
      commitPending: true
    });
    const { result, rerender } = renderHook(() => useCreativeVariationsAuthoring(props));

    props.widgetModelId = 'openai/gpt-5.4';
    rerender();
    expect(result.current.draft.workup).toEqual(reopenedDraft.workup);

    props.commitPending = false;
    rerender();
    expect(result.current.draft.workup).toBeNull();
    expect(result.current.draft.selections).toEqual([]);
    expect(result.current.invalidationNotice).toBe(
      'Generated workup cleared because the widget model changed.'
    );
  });

  it('uses exact advisory-set equality and blocks an unbuildable selected take', () => {
    const duplicateRiskDraft = {
      ...clone(generatedDraft),
      selections: [{
        position: 2,
        carryMode: 'direction' as const,
        acceptedAdvisoryRiskIds: [ADVISORY_RISK_ID, ADVISORY_RISK_ID]
      }]
    };
    const duplicate = options({ opening: cloneOpening(duplicateRiskDraft) });
    const duplicateHook = renderHook(() => useCreativeVariationsAuthoring(duplicate));
    expect(duplicateHook.result.current.commitBlockers).toContain('unaccepted-advisory-risk');

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const staleSelectionDraft = {
      ...clone(generatedDraft),
      selections: [{ position: 99, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }]
    };
    const stale = options({ opening: cloneOpening(staleSelectionDraft) });
    const staleHook = renderHook(() => useCreativeVariationsAuthoring(stale));
    expect(staleHook.result.current.artifactUsage).toBeNull();
    expect(staleHook.result.current.commitBlockers).toContain('artifact-compilation-failed');
    expect(warn).toHaveBeenCalledWith(
      '[CreativeVariations] Could not compile artifact usage',
      expect.any(Error)
    );
    warn.mockRestore();
  });

  it('reports real generation, room, hard-conflict, advisory-risk, and budget blockers', () => {
    const overBudgetDraft = {
      ...clone(generatedDraft),
      workup: {
        ...clone(generatedDraft.workup!),
        cards: generatedDraft.workup!.cards.map((card) => card.position === 1
          ? { ...clone(card), prose: 'x'.repeat(20_000) }
          : clone(card))
      },
      selections: [
        { position: 1, carryMode: 'full-prose' as const, acceptedAdvisoryRiskIds: [] },
        { position: 2, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] },
        { position: 3, carryMode: 'direction' as const, acceptedAdvisoryRiskIds: [] }
      ]
    };
    const props = options({
      opening: cloneOpening(overBudgetDraft),
      roomRunActive: true,
      toolTargetActive: true
    });
    const { result } = renderHook(() => useCreativeVariationsAuthoring(props));

    expect(result.current.commitBlockers).toEqual([
      'room-run-active',
      'tool-target',
      'hard-conflict-selection',
      'unaccepted-advisory-risk',
      'over-artifact-budget'
    ]);
    expect(result.current.artifactUsage).toEqual({
      characters: buildCreativeVariationsArtifact(overBudgetDraft).length,
      budget: 20_000
    });
  });
});
