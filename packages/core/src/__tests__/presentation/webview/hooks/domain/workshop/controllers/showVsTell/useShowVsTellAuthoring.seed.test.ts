/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useShowVsTellAuthoring,
  type UseShowVsTellAuthoringOptions
} from '@hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring';
import type { WorkshopShowVsTellRecommendationSeed } from '@messages';
import type {
  WorkshopShowVsTellOpening
} from '@hooks/domain/workshop/controllers/useWorkshopWidgetOpening';
import { SHOW_VS_TELL_DEFAULTS } from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';

const minimalSeed = (): WorkshopShowVsTellRecommendationSeed => ({
  beatText: 'She hadn’t trusted him since the funeral.',
  sourceReferences: [],
  mustSurvive: 'The distrust is old and funeral-rooted.'
});

const completeSeed = (): WorkshopShowVsTellRecommendationSeed => ({
  beatText: 'She hadn’t trusted him since the funeral.',
  subject: 'the funeral line',
  contextText: 'He set the mug down.\nShe did not look up.',
  sourceReferences: [{ kind: 'active-excerpt' }],
  mustSurvive: 'The distrust is old.\nIt predates tonight.',
  mustNotChange: 'No flashback.',
  pov: { mode: 'close-third', focalCharacter: 'Mara' },
  position: 'evidence',
  channels: ['interiority', 'dialogue-subtext'],
  lengthBudget: 'plus-one-sentence'
});

const seedOpening = (
  seed: WorkshopShowVsTellRecommendationSeed
): WorkshopShowVsTellOpening => ({
  kind: 'seed',
  seed,
  personaId: 'jill',
  personaLabel: 'Jill'
});

function mount(initial: Partial<UseShowVsTellAuthoringOptions> = {}) {
  const options: UseShowVsTellAuthoringOptions = {
    opening: null,
    activeExcerpt: null,
    contextAttachments: [],
    roomKey: 'room-1',
    widgetModelId: 'model-a',
    generationProgress: null,
    generationResult: null,
    requestBeatSelection: jest.fn(),
    requestPassageSelection: jest.fn(),
    generate: jest.fn(() => 'token-1'),
    cancelGeneration: jest.fn(),
    roomRunActive: false,
    toolTargetActive: false,
    commitPending: false,
    commitOutcome: null,
    commit: jest.fn(),
    clearCommitResult: jest.fn(),
    resetCommitState: jest.fn(),
    onCommitAccepted: jest.fn(),
    ...initial
  };
  const hook = renderHook(
    (props: UseShowVsTellAuthoringOptions) => useShowVsTellAuthoring(props),
    { initialProps: options }
  );
  return {
    options,
    result: hook.result,
    rerender: (props: Partial<UseShowVsTellAuthoringOptions>) =>
      hook.rerender({ ...options, ...props })
  };
}

const EXCERPT = { text: 'x', version: 1, pinnedAt: 1, source: { kind: 'manual' } } as never;

describe('useShowVsTellAuthoring recommendation seed', () => {
  it('opens the seed context text as the writer passage and the references as the context (D2)', () => {
    const seed = completeSeed();
    seed.sourceReferences = [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-2' }];
    const h = mount({ opening: seedOpening(seed) });
    expect(h.result.current.draft.surroundingContext).toEqual({
      writerText: 'He set the mug down.\nShe did not look up.',
      sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-2' }]
    });
  });

  it('opens a seed without must survive on a blank, optional field (D3)', () => {
    const seed = minimalSeed();
    delete seed.mustSurvive;
    const h = mount({ opening: seedOpening(seed) });
    expect(h.result.current.draft.invariants).toEqual({ mustSurvive: '', mustNotChange: '' });
    expect(h.result.current.draft.surroundingContext.writerText).toBe('');
    expect(h.result.current.generateBlockers).toEqual([]);
  });

  it('seeds exactly the persona-supplied inputs and fills the rest from the defaults', () => {
    const h = mount({ opening: seedOpening(minimalSeed()) });

    expect(h.result.current.draft).toEqual({
      beat: {
        text: 'She hadn’t trusted him since the funeral.',
        provenance: { kind: 'persona-prefill', personaId: 'jill', editedByWriter: false }
      },
      surroundingContext: { writerText: '', sourceReferences: [] },
      pov: { ...SHOW_VS_TELL_DEFAULTS.pov },
      invariants: { mustSurvive: 'The distrust is old and funeral-rooted.', mustNotChange: '' },
      channels: [...SHOW_VS_TELL_DEFAULTS.channels],
      lengthBudget: SHOW_VS_TELL_DEFAULTS.lengthBudget,
      position: SHOW_VS_TELL_DEFAULTS.position,
      workup: null,
      kept: [],
      note: ''
    });
  });

  it('applies every suggestion, opening at the position the persona suggested', () => {
    const h = mount({ activeExcerpt: EXCERPT, opening: seedOpening(completeSeed()) });
    const { draft } = h.result.current;

    expect(draft.surroundingContext.sourceReferences).toEqual([{ kind: 'active-excerpt' }]);
    expect(draft.invariants).toEqual({
      mustSurvive: 'The distrust is old.\nIt predates tonight.',
      mustNotChange: 'No flashback.'
    });
    expect(draft.pov).toEqual({ mode: 'close-third', focalCharacter: 'Mara' });
    expect(draft.position).toBe('evidence');
    expect(draft.channels).toEqual(['interiority', 'dialogue-subtext']);
    expect(draft.lengthBudget).toBe('plus-one-sentence');
    expect(draft.workup).toBeNull();
    expect(draft.kept).toEqual([]);
    expect(draft.note).toBe('');
  });

  it('keeps the chip label out of the draft entirely', () => {
    const h = mount({ opening: seedOpening(completeSeed()) });
    expect(JSON.stringify(h.result.current.draft)).not.toContain('the funeral line');
    expect(h.result.current.draft).not.toHaveProperty('subject');
  });

  it('never generates, cancels, selects, or commits on opening', () => {
    const h = mount({ opening: seedOpening(completeSeed()), activeExcerpt: EXCERPT });

    expect(h.options.generate).not.toHaveBeenCalled();
    expect(h.options.cancelGeneration).not.toHaveBeenCalled();
    expect(h.options.requestBeatSelection).not.toHaveBeenCalled();
    expect(h.options.commit).not.toHaveBeenCalled();
    expect(h.result.current.generation).toEqual({ kind: 'idle' });
    expect(h.result.current.generateBlockers).toEqual([]);
  });

  it('generates only when the writer presses Generate, and sends the seeded inputs without the subject', () => {
    const h = mount({ opening: seedOpening(completeSeed()), activeExcerpt: EXCERPT });

    act(() => h.result.current.generateWorkup());

    expect(h.options.generate).toHaveBeenCalledTimes(1);
    const sent = (h.options.generate as jest.Mock).mock.calls[0][0];
    expect(sent).toMatchObject({
      beat: { text: 'She hadn’t trusted him since the funeral.' },
      pov: { mode: 'close-third', focalCharacter: 'Mara' },
      position: 'evidence'
    });
    expect(JSON.stringify(sent)).not.toContain('the funeral line');
  });

  it('flips the beat provenance once the writer edits the persona-prepared beat', () => {
    const h = mount({ opening: seedOpening(minimalSeed()) });

    act(() => h.result.current.changeBeatText('She had not trusted him since the funeral.'));

    expect(h.result.current.draft.beat).toEqual({
      text: 'She had not trusted him since the funeral.',
      provenance: { kind: 'persona-prefill', personaId: 'jill', editedByWriter: true }
    });
  });

  it('gives POV no persona custody: editing it is plain input and leaves the beat untouched', () => {
    const h = mount({ opening: seedOpening(completeSeed()), activeExcerpt: EXCERPT });

    act(() => h.result.current.changePovMode('first'));
    act(() => h.result.current.changePovFocalCharacter('Daniel'));

    expect(h.result.current.draft.pov).toEqual({ mode: 'first', focalCharacter: 'Daniel' });
    expect(Object.keys(h.result.current.draft.pov).sort()).toEqual(['focalCharacter', 'mode']);
    expect(h.result.current.draft.beat.provenance).toEqual({
      kind: 'persona-prefill', personaId: 'jill', editedByWriter: false
    });
  });

  it('keeps an unavailable seeded source as-is and blocks Generate', () => {
    // The room offers no excerpt, so the seeded active-excerpt reference cannot resolve.
    const h = mount({ opening: seedOpening(completeSeed()), activeExcerpt: null });

    expect(h.result.current.draft.surroundingContext.sourceReferences).toEqual([
      { kind: 'active-excerpt' }
    ]);
    expect(h.result.current.availableSources).toEqual([]);
    expect(h.result.current.generateBlockers).toEqual(['source-unavailable']);

    act(() => h.result.current.generateWorkup());
    expect(h.options.generate).not.toHaveBeenCalled();
  });

  it('copies the seed so editing the draft never mutates the persisted recommendation', () => {
    const seed = completeSeed();
    const h = mount({ opening: seedOpening(seed), activeExcerpt: EXCERPT });

    act(() => h.result.current.toggleChannel('observable-action'));
    act(() => h.result.current.changeMustSurvive('Rewritten.'));

    expect(seed).toEqual(completeSeed());
  });

  it('cannot commit a seeded sheet until it has a workup and a keep', () => {
    const h = mount({ opening: seedOpening(minimalSeed()) });
    expect(h.result.current.commitBlockers).toContain('no-workup');
    expect(h.options.commit).not.toHaveBeenCalled();
  });

  it('re-seeds from a later recommendation each time the sheet opens', () => {
    const h = mount({ opening: null });
    h.rerender({ opening: seedOpening(minimalSeed()) });
    act(() => h.result.current.changeMustSurvive('Edited by the writer.'));

    h.rerender({ opening: null });
    h.rerender({ opening: seedOpening({ ...minimalSeed(), mustSurvive: 'A second seed.' }) });

    expect(h.result.current.draft.invariants.mustSurvive).toBe('A second seed.');
    expect(h.result.current.draft.beat.provenance).toEqual({
      kind: 'persona-prefill', personaId: 'jill', editedByWriter: false
    });
  });
});
