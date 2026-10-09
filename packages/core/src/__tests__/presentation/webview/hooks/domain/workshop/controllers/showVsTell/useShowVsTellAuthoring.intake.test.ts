/** @jest-environment jsdom */

/**
 * Slice 7 design edits (D2, D4) at the controller: the surrounding passage is
 * writer text with three intakes (typed, Use excerpt, Use selection), the
 * context is a multi-select stored in canonical order, and channels go to zero.
 */

import { act, renderHook } from '@testing-library/react';
import {
  useShowVsTellAuthoring,
  type UseShowVsTellAuthoringOptions
} from '@hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring';
import {
  MessageType,
  type SelectionDataMessage,
  type WorkshopContextAttachmentSnapshot,
  type WorkshopExcerptSnapshot,
  type WorkshopShowVsTellResultPayload
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const BUDGET = PROMPT_BUDGETS.workshopWidgets;

const excerpt = (text = 'He set the mug down. She hadn’t trusted him since the funeral.'): WorkshopExcerptSnapshot =>
  ({ text, version: 3, pinnedAt: 1, source: { kind: 'manual' } } as unknown as WorkshopExcerptSnapshot);

const attachment = (id: string, label: string): WorkshopContextAttachmentSnapshot =>
  ({ id, kind: 'text', origin: 'writer', label, words: 3 } as unknown as WorkshopContextAttachmentSnapshot);

const passageSelection = (content: string): SelectionDataMessage => ({
  type: MessageType.SELECTION_DATA,
  source: 'extension.ui',
  timestamp: 1,
  payload: { target: 'workshop_show_vs_tell_passage', content }
});

function mount(initial: Partial<UseShowVsTellAuthoringOptions> = {}) {
  let tokenIndex = 0;
  const options = {
    requestBeatSelection: jest.fn(),
    requestPassageSelection: jest.fn(),
    generate: jest.fn((_input: unknown) => `token-${++tokenIndex}`),
    cancelGeneration: jest.fn(),
    commit: jest.fn(),
    clearCommitResult: jest.fn(),
    resetCommitState: jest.fn(),
    onCommitAccepted: jest.fn()
  };
  const base: UseShowVsTellAuthoringOptions = {
    opening: { kind: 'new' },
    activeExcerpt: null,
    contextAttachments: [],
    roomKey: 'room-1',
    widgetModelId: 'model-a',
    generationProgress: null,
    generationResult: null,
    roomRunActive: false,
    toolTargetActive: false,
    commitPending: false,
    commitOutcome: null,
    ...options
  };
  let current = { ...base, ...initial };
  const hook = renderHook(
    (props: UseShowVsTellAuthoringOptions) => useShowVsTellAuthoring(props),
    { initialProps: current }
  );
  return {
    options,
    result: hook.result,
    rerender: (props: Partial<UseShowVsTellAuthoringOptions>) => {
      current = { ...current, ...props };
      hook.rerender(current);
    }
  };
}

const settled = (token: string): WorkshopShowVsTellResultPayload => {
  const workup = generatedShowVsTellDraft().workup!;
  return { widgetId: 'show-vs-tell', token, workupId: workup.workupId, ok: true, workup };
};

describe('useShowVsTellAuthoring surrounding passage (D2)', () => {
  it('starts blank and accepts typed or pasted multi-line text up to the context allowance', () => {
    const h = mount();
    expect(h.result.current.draft.surroundingContext).toEqual({ writerText: '', sourceReferences: [] });

    act(() => h.result.current.changePassageText('He set the mug down.\nShe did not look up.'));

    expect(h.result.current.draft.surroundingContext.writerText).toBe('He set the mug down.\nShe did not look up.');
    expect(h.result.current.passageNotice).toBeNull();
  });

  it('shortens over-long text to the allowance and says so', () => {
    const h = mount();
    act(() => h.result.current.changePassageText('p'.repeat(BUDGET.showVsTellContextCharacters + 5)));

    expect(h.result.current.draft.surroundingContext.writerText).toHaveLength(BUDGET.showVsTellContextCharacters);
    expect(h.result.current.passageNotice).toMatch(/longer than 250,000 characters/);
  });

  it('Use excerpt copies the active excerpt text in, and is unavailable without one', () => {
    const h = mount();
    expect(h.result.current.canUsePassageFromExcerpt).toBe(false);
    act(() => h.result.current.usePassageFromExcerpt());
    expect(h.result.current.draft.surroundingContext.writerText).toBe('');

    h.rerender({ activeExcerpt: excerpt() });
    expect(h.result.current.canUsePassageFromExcerpt).toBe(true);
    act(() => h.result.current.usePassageFromExcerpt());

    expect(h.result.current.draft.surroundingContext.writerText)
      .toBe('He set the mug down. She hadn’t trusted him since the funeral.');
    // Copying text never selects the excerpt as a context source.
    expect(h.result.current.draft.surroundingContext.sourceReferences).toEqual([]);
  });

  it('Use selection requests the editor selection on its own target and fills the box from the reply', () => {
    const h = mount();

    act(() => h.result.current.requestPassageSelection());
    expect(h.options.requestPassageSelection).toHaveBeenCalledTimes(1);
    expect(h.options.requestBeatSelection).not.toHaveBeenCalled();

    act(() => h.result.current.handlePassageSelection(passageSelection('From the editor.\nSecond line.')));

    expect(h.result.current.draft.surroundingContext.writerText).toBe('From the editor.\nSecond line.');
    expect(h.result.current.draft.beat.text).toBe('');
  });

  it('ignores a passage reply for another target, and drops one that lands while generating', () => {
    const h = mount();
    act(() => h.result.current.handlePassageSelection({
      ...passageSelection('Not ours.'),
      payload: { target: 'workshop_show_vs_tell_beat', content: 'Not ours.' }
    }));
    expect(h.result.current.draft.surroundingContext.writerText).toBe('');

    act(() => h.result.current.changeBeatText('A beat.'));
    act(() => h.result.current.generateWorkup());
    act(() => h.result.current.handlePassageSelection(passageSelection('Late.')));

    expect(h.result.current.draft.surroundingContext.writerText).toBe('');
    expect(h.result.current.generation.kind).toBe('generating');
  });

  it('is a generation input: changing the text or the sources clears the workup, but the position does not', () => {
    const h = mount({ activeExcerpt: excerpt() });
    act(() => h.result.current.changeBeatText('A beat.'));
    act(() => h.result.current.generateWorkup());
    h.rerender({ generationResult: settled(h.options.generate.mock.results[0].value as string) });
    expect(h.result.current.draft.workup).not.toBeNull();

    act(() => h.result.current.changePosition('inhabit'));
    expect(h.result.current.draft.workup).not.toBeNull();

    act(() => h.result.current.changePassageText('New context.'));
    expect(h.result.current.draft.workup).toBeNull();
    expect(h.result.current.invalidationNotice).toBe('Generated workup cleared because the surrounding passage changed.');

    act(() => h.result.current.generateWorkup());
    h.rerender({ generationResult: settled(h.options.generate.mock.results[1].value as string) });
    act(() => h.result.current.toggleSourceReference({ kind: 'active-excerpt' }));
    expect(h.result.current.draft.workup).toBeNull();
    expect(h.result.current.invalidationNotice).toBe('Generated workup cleared because the context sources changed.');
  });

  it('sends the writer text and the references as the surrounding context, and nothing resolved', () => {
    const h = mount({ activeExcerpt: excerpt(), contextAttachments: [attachment('ctx-1', 'Notes')] });
    act(() => {
      h.result.current.changeBeatText('A beat.');
      h.result.current.changePassageText('Typed context.');
      h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: 'ctx-1' });
      h.result.current.toggleSourceReference({ kind: 'active-excerpt' });
    });
    act(() => h.result.current.generateWorkup());

    expect(h.options.generate).toHaveBeenCalledWith(expect.objectContaining({
      surroundingContext: {
        writerText: 'Typed context.',
        sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-1' }]
      }
    }));
    expect(JSON.stringify(h.options.generate.mock.calls[0][0])).not.toContain(excerpt().text);
  });
});

describe('useShowVsTellAuthoring context sources (D2)', () => {
  const room = () => mount({
    activeExcerpt: excerpt(),
    contextAttachments: [attachment('ctx-10', 'Ten'), attachment('ctx-2', 'Two'), attachment('ctx-1', 'One')]
  });

  it('lists the excerpt and every attachment, and toggles each on and off', () => {
    const h = room();
    expect(h.result.current.availableSources.map((source) => source.label))
      .toEqual(['Active excerpt', 'Ten', 'Two', 'One']);

    act(() => h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: 'ctx-2' }));
    act(() => h.result.current.toggleSourceReference({ kind: 'active-excerpt' }));
    expect(h.result.current.draft.surroundingContext.sourceReferences).toHaveLength(2);

    act(() => h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: 'ctx-2' }));
    expect(h.result.current.draft.surroundingContext.sourceReferences).toEqual([{ kind: 'active-excerpt' }]);
  });

  it('stores the selection unique and in canonical order whatever order it was clicked', () => {
    const h = room();
    for (const reference of [
      { kind: 'context-attachment' as const, attachmentId: 'ctx-10' },
      { kind: 'context-attachment' as const, attachmentId: 'ctx-1' },
      { kind: 'active-excerpt' as const },
      { kind: 'context-attachment' as const, attachmentId: 'ctx-2' }
    ]) {
      act(() => h.result.current.toggleSourceReference(reference));
    }

    expect(h.result.current.draft.surroundingContext.sourceReferences).toEqual([
      { kind: 'active-excerpt' },
      { kind: 'context-attachment', attachmentId: 'ctx-1' },
      { kind: 'context-attachment', attachmentId: 'ctx-2' },
      { kind: 'context-attachment', attachmentId: 'ctx-10' }
    ]);
  });

  it('refuses a ninth source and leaves the draft untouched', () => {
    const h = mount({
      contextAttachments: Array.from({ length: 9 }, (_, index) => attachment(`ctx-${index + 1}`, `Note ${index + 1}`))
    });
    for (let index = 1; index <= 9; index += 1) {
      act(() => h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: `ctx-${index}` }));
    }
    const references = h.result.current.draft.surroundingContext.sourceReferences;
    expect(references).toHaveLength(BUDGET.showVsTellSourceReferences);
    expect(references.at(-1)).toEqual({ kind: 'context-attachment', attachmentId: 'ctx-8' });
  });

  it('blocks Generate while any one of several selected sources is unavailable, and keeps the reference', () => {
    const h = room();
    act(() => {
      h.result.current.changeBeatText('A beat.');
      h.result.current.toggleSourceReference({ kind: 'active-excerpt' });
      h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: 'ctx-2' });
    });
    expect(h.result.current.generateBlockers).toEqual([]);

    h.rerender({ contextAttachments: [attachment('ctx-10', 'Ten'), attachment('ctx-1', 'One')] });

    expect(h.result.current.generateBlockers).toEqual(['source-unavailable']);
    expect(h.result.current.draft.surroundingContext.sourceReferences).toEqual([
      { kind: 'active-excerpt' },
      { kind: 'context-attachment', attachmentId: 'ctx-2' }
    ]);
    act(() => h.result.current.generateWorkup());
    expect(h.options.generate).not.toHaveBeenCalled();

    act(() => h.result.current.toggleSourceReference({ kind: 'context-attachment', attachmentId: 'ctx-2' }));
    expect(h.result.current.generateBlockers).toEqual([]);
  });
});

describe('useShowVsTellAuthoring channels (D4)', () => {
  it('lets every channel go, generates with none, and restores them in the fixed order', () => {
    const h = mount();
    act(() => h.result.current.changeBeatText('A beat.'));
    act(() => h.result.current.toggleChannel('observable-action'));
    act(() => h.result.current.toggleChannel('sensory-evidence'));
    expect(h.result.current.draft.channels).toEqual([]);
    expect(h.result.current.generateBlockers).toEqual([]);

    act(() => h.result.current.generateWorkup());
    expect(h.options.generate).toHaveBeenCalledWith(expect.objectContaining({ channels: [] }));

    act(() => h.result.current.toggleChannel('summary-exposition'));
    act(() => h.result.current.toggleChannel('observable-action'));
    expect(h.result.current.draft.channels).toEqual(['observable-action', 'summary-exposition']);
  });

  it('a channel change to zero invalidates settled work like any other channel change', () => {
    const h = mount();
    act(() => h.result.current.changeBeatText('A beat.'));
    act(() => h.result.current.toggleChannel('sensory-evidence'));
    act(() => h.result.current.generateWorkup());
    h.rerender({ generationResult: settled(h.options.generate.mock.results[0].value as string) });
    expect(h.result.current.draft.workup).not.toBeNull();

    act(() => h.result.current.toggleChannel('observable-action'));

    expect(h.result.current.draft.channels).toEqual([]);
    expect(h.result.current.draft.workup).toBeNull();
    expect(h.result.current.invalidationNotice).toBe('Generated workup cleared because the channels changed.');
  });
});
