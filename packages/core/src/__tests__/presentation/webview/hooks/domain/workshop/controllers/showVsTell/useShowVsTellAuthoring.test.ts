/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useShowVsTellAuthoring,
  collapseShowVsTellLineBreaks,
  type UseShowVsTellAuthoringOptions
} from '@hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring';
import {
  MessageType,
  type SelectionDataMessage,
  type WorkshopShowVsTellGenerationProgressPayload,
  type WorkshopShowVsTellResultPayload,
  type WorkshopShowVsTellWorkup
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  SHOW_VS_TELL_DEFAULTS
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellContinuum';
import {
  buildShowVsTellArtifact
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellArtifact';
import {
  fixtureVariantId,
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const workup = (): WorkshopShowVsTellWorkup => generatedShowVsTellDraft().workup!;

const progress = (
  token: string,
  phase: WorkshopShowVsTellGenerationProgressPayload['phase']
): WorkshopShowVsTellGenerationProgressPayload => ({
  widgetId: 'show-vs-tell',
  token,
  workupId: workup().workupId,
  phase,
  stage: 'workup',
  outputCharacters: 2_000,
  estimatedOutputTokens: 500,
  outputTokenLimit: 16_000
});

const okResult = (token: string): WorkshopShowVsTellResultPayload => ({
  widgetId: 'show-vs-tell',
  token,
  workupId: workup().workupId,
  ok: true,
  workup: workup()
});

const selection = (
  payload: Partial<SelectionDataMessage['payload']>
): SelectionDataMessage => ({
  type: MessageType.SELECTION_DATA,
  source: 'extension.ui',
  timestamp: 1,
  payload: { target: 'workshop_show_vs_tell_beat', content: 'A beat.', ...payload }
});

interface Harness {
  options: jest.Mocked<Pick<
    UseShowVsTellAuthoringOptions,
    'requestBeatSelection' | 'generate' | 'cancelGeneration' | 'commit'
    | 'clearCommitResult' | 'resetCommitState' | 'onCommitAccepted'
  >>;
  result: { current: ReturnType<typeof useShowVsTellAuthoring> };
  rerender: (props: Partial<UseShowVsTellAuthoringOptions>) => void;
}

function setup(initial: Partial<UseShowVsTellAuthoringOptions> = {}): Harness {
  let tokenIndex = 0;
  const options = {
    requestBeatSelection: jest.fn(),
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
  const { result, rerender } = renderHook(
    (props: UseShowVsTellAuthoringOptions) => useShowVsTellAuthoring(props),
    { initialProps: { ...base, ...initial } }
  );
  let current: UseShowVsTellAuthoringOptions = { ...base, ...initial };
  return {
    options: options as unknown as Harness['options'],
    result,
    rerender: (props) => {
      current = { ...current, ...props };
      rerender(current);
    }
  };
}

/** Fill the required fields, generate, and settle a workup. */
function settleWorkup(h: Harness): string {
  act(() => {
    h.result.current.changeBeatText('She hadn’t trusted him since the funeral.');
    h.result.current.changeMustSurvive('The distrust is old.');
  });
  act(() => h.result.current.generateWorkup());
  const token = h.options.generate.mock.results.at(-1)!.value as string;
  h.rerender({ generationResult: okResult(token) });
  return token;
}

describe('useShowVsTellAuthoring', () => {
  describe('defaults and the generation gate', () => {
    it('starts from the shipped defaults with an explicitly empty persistence contract', () => {
      const h = setup();
      const { draft } = h.result.current;

      expect(draft.position).toBe(SHOW_VS_TELL_DEFAULTS.position);
      expect(draft.position).toBe('hinge');
      expect(draft.channels).toEqual(['observable-action', 'sensory-evidence']);
      expect(draft.lengthBudget).toBe('same-length');
      expect(draft.pov).toEqual({ mode: 'unspecified', focalCharacter: '' });
      expect(draft.workup).toBeNull();
      expect(draft.kept).toEqual([]);
      expect(h.result.current.persistedState).toEqual({});
    });

    it('requires a non-blank beat and must survive before generation', () => {
      const h = setup();

      expect(h.result.current.generateBlockers).toEqual(['beat-required', 'must-survive-required']);
      act(() => h.result.current.generateWorkup());
      expect(h.options.generate).not.toHaveBeenCalled();

      act(() => h.result.current.changeBeatText('A beat.'));
      act(() => h.result.current.changeMustSurvive('   '));
      expect(h.result.current.generateBlockers).toEqual(['must-survive-required']);

      act(() => h.result.current.changeMustSurvive('The turn.'));
      expect(h.result.current.generateBlockers).toEqual([]);
      act(() => h.result.current.generateWorkup());
      expect(h.options.generate).toHaveBeenCalledTimes(1);
    });

    it('sends exactly the generation inputs and no workup, kept, or note', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
        h.result.current.changeNote('private note');
      });

      act(() => h.result.current.generateWorkup());

      expect(Object.keys(h.options.generate.mock.calls[0][0]).sort()).toEqual([
        'beat', 'channels', 'invariants', 'lengthBudget', 'position', 'pov', 'surroundingContext'
      ]);
    });

    it('flags a selected source that the room no longer offers', () => {
      const h = setup({ activeExcerpt: { text: 'x', version: 1, pinnedAt: 1, source: { kind: 'manual' } } as never });
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
        h.result.current.selectSourceReference({ kind: 'active-excerpt' });
      });
      expect(h.result.current.generateBlockers).toEqual([]);

      h.rerender({ activeExcerpt: null });

      expect(h.result.current.generateBlockers).toEqual(['source-unavailable']);
    });
  });

  describe('invalidation', () => {
    const everyInvalidatingInput: Array<[string, (h: Harness) => void]> = [
      ['beat text', (h) => h.result.current.changeBeatText('A different beat.')],
      ['beat selection', (h) => h.result.current.handleBeatSelection(selection({ content: 'Another beat.' }))],
      ['source reference', (h) => h.result.current.selectSourceReference({ kind: 'active-excerpt' })],
      ['POV mode', (h) => h.result.current.changePovMode('close-third')],
      ['must survive', (h) => h.result.current.changeMustSurvive('Something else survives.')],
      ['must not change', (h) => h.result.current.changeMustNotChange('No flashback.')],
      ['channels', (h) => h.result.current.toggleChannel('interiority')],
      ['length budget', (h) => h.result.current.changeLengthBudget('tighter')]
    ];

    it.each(everyInvalidatingInput)('%s clears the workup, kept variants, and carry', (_name, change) => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));
      act(() => h.result.current.changeCarryMode(fixtureVariantId(3), 'prose'));
      expect(h.result.current.draft.workup).not.toBeNull();
      expect(h.result.current.draft.kept).toHaveLength(1);

      act(() => change(h));

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.draft.kept).toEqual([]);
      expect(h.result.current.invalidationNotice).toMatch(/Generated workup cleared because/);
    });

    it('POV focal character invalidates too, once POV is declared', () => {
      const h = setup();
      act(() => h.result.current.changePovMode('close-third'));
      settleWorkup(h);

      act(() => h.result.current.changePovFocalCharacter('Daniel'));

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.draft.pov).toEqual({ mode: 'close-third', focalCharacter: 'Daniel' });
    });

    it('moving the position keeps the workup and the kept variants', () => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));
      act(() => h.result.current.changeCarryMode(fixtureVariantId(3), 'prose'));
      const keptBefore = h.result.current.draft.kept;

      act(() => h.result.current.changePosition('inhabit'));

      expect(h.result.current.draft.position).toBe('inhabit');
      expect(h.result.current.draft.workup).not.toBeNull();
      expect(h.result.current.draft.kept).toEqual(keptBefore);
      expect(h.result.current.invalidationNotice).toBeNull();
    });

    it('moving the position does not cancel an in-flight generation', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());

      act(() => h.result.current.changePosition('evidence'));

      expect(h.options.cancelGeneration).not.toHaveBeenCalled();
      expect(h.result.current.generation.kind).toBe('generating');
    });

    it('does not invalidate on edits to the note', () => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));

      act(() => h.result.current.changeNote('keep the tell'));

      expect(h.result.current.draft.workup).not.toBeNull();
      expect(h.result.current.draft.kept).toHaveLength(1);
    });

    it('a widget-model change clears settled work', () => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));

      h.rerender({ widgetModelId: 'model-b' });

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.draft.kept).toEqual([]);
      expect(h.result.current.invalidationNotice).toMatch(/widget model/);
    });

    it('a room change clears work grounded on a source reference but not an ungrounded one', () => {
      const grounded = setup({ activeExcerpt: { text: 'x', version: 1, pinnedAt: 1, source: { kind: 'manual' } } as never });
      act(() => grounded.result.current.selectSourceReference({ kind: 'active-excerpt' }));
      settleWorkup(grounded);
      grounded.rerender({ roomKey: 'room-2' });
      expect(grounded.result.current.draft.workup).toBeNull();

      const ungrounded = setup();
      settleWorkup(ungrounded);
      ungrounded.rerender({ roomKey: 'room-2' });
      expect(ungrounded.result.current.draft.workup).not.toBeNull();
    });
  });

  describe('regenerate and stale replies', () => {
    it('regenerating mints a fresh token and clears kept variants before the new cards settle', () => {
      const h = setup();
      const first = settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));
      act(() => h.result.current.changeCarryMode(fixtureVariantId(3), 'prose'));

      act(() => h.result.current.generateWorkup());

      const second = h.options.generate.mock.results.at(-1)!.value as string;
      expect(second).not.toBe(first);
      // Atomic: cards and keeps are gone while the new attempt is in flight.
      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.draft.kept).toEqual([]);
      expect(h.result.current.generation.kind).toBe('generating');

      h.rerender({ generationResult: okResult(second) });

      expect(h.result.current.draft.workup).not.toBeNull();
      expect(h.result.current.draft.kept).toEqual([]);
      expect(h.result.current.generation).toEqual({ kind: 'idle' });
    });

    it('ignores a reply for a token it is not waiting on', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());

      h.rerender({ generationResult: okResult('some-other-token') });

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.generation.kind).toBe('generating');
    });

    it('discards a reply that arrives after an input change cancelled the attempt', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;

      act(() => h.result.current.changeLengthBudget('tighter'));
      expect(h.options.cancelGeneration).toHaveBeenCalledWith(token);
      expect(h.result.current.invalidationNotice).toMatch(/Generation cancelled because the length budget changed/);

      h.rerender({ generationResult: okResult(token) });

      expect(h.result.current.draft.workup).toBeNull();
    });

    it('discards a reply that arrives after the sheet closed', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;

      h.rerender({ opening: null });
      h.rerender({ generationResult: okResult(token) });
      h.rerender({ opening: { kind: 'new' } });

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.generation).toEqual({ kind: 'idle' });
    });

    it('discards a reply that arrives after the room changed under a source reference', () => {
      const h = setup({ activeExcerpt: { text: 'x', version: 1, pinnedAt: 1, source: { kind: 'manual' } } as never });
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
        h.result.current.selectSourceReference({ kind: 'active-excerpt' });
      });
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;

      h.rerender({ roomKey: 'room-2' });
      h.rerender({ generationResult: okResult(token) });

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.options.cancelGeneration).toHaveBeenCalledWith(token);
    });

    it('returns to idle on a cancelled progress phase and shows a failed result', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;

      h.rerender({ generationProgress: progress(token, 'streaming') });
      expect(h.result.current.generation).toEqual({
        kind: 'generating',
        detail: 'Receiving the workup · 2,000 characters'
      });
      h.rerender({ generationProgress: progress(token, 'cancelled') });
      expect(h.result.current.generation).toEqual({ kind: 'idle' });

      act(() => h.result.current.generateWorkup());
      const second = h.options.generate.mock.results.at(-1)!.value as string;
      h.rerender({
        generationResult: {
          widgetId: 'show-vs-tell', token: second, workupId: 'svtw-x', ok: false, error: 'Unusable workup.'
        }
      });

      expect(h.result.current.generation).toEqual({ kind: 'failed', message: 'Unusable workup.' });
    });

    it('cancelGenerate cancels the active token and goes idle', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;

      act(() => h.result.current.cancelGenerate());

      expect(h.options.cancelGeneration).toHaveBeenCalledWith(token);
      expect(h.result.current.generation).toEqual({ kind: 'idle' });
    });
  });

  describe('channels', () => {
    it('keeps the last selected channel on', () => {
      const h = setup();
      act(() => h.result.current.toggleChannel('sensory-evidence'));
      expect(h.result.current.draft.channels).toEqual(['observable-action']);

      act(() => h.result.current.toggleChannel('observable-action'));

      expect(h.result.current.draft.channels).toEqual(['observable-action']);
    });

    it('stores channels in the fixed channel order whatever order they were clicked', () => {
      const h = setup();

      act(() => h.result.current.toggleChannel('summary-exposition'));
      act(() => h.result.current.toggleChannel('interiority'));
      act(() => h.result.current.toggleChannel('dialogue-subtext'));

      expect(h.result.current.draft.channels).toEqual([
        'observable-action',
        'sensory-evidence',
        'interiority',
        'dialogue-subtext',
        'summary-exposition'
      ]);
    });
  });

  describe('keep and carry', () => {
    it('defaults a newly kept variant to direction-only carry and stores keeps in workup order', () => {
      const h = setup();
      settleWorkup(h);

      act(() => h.result.current.toggleKeep(fixtureVariantId(7)));
      act(() => h.result.current.toggleKeep(fixtureVariantId(2)));
      act(() => h.result.current.toggleKeep(fixtureVariantId(5)));

      expect(h.result.current.draft.kept).toEqual([
        { variantId: fixtureVariantId(2), carryMode: 'direction' },
        { variantId: fixtureVariantId(5), carryMode: 'direction' },
        { variantId: fixtureVariantId(7), carryMode: 'direction' }
      ]);
    });

    it('toggles a keep off and switches carry per variant', () => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(2)));
      act(() => h.result.current.toggleKeep(fixtureVariantId(5)));

      act(() => h.result.current.changeCarryMode(fixtureVariantId(5), 'prose'));
      expect(h.result.current.draft.kept.map((entry) => entry.carryMode)).toEqual(['direction', 'prose']);

      act(() => h.result.current.toggleKeep(fixtureVariantId(2)));
      expect(h.result.current.draft.kept).toEqual([
        { variantId: fixtureVariantId(5), carryMode: 'prose' }
      ]);
    });

    it('ignores a keep for a variant that is not in the workup', () => {
      const h = setup();
      settleWorkup(h);

      act(() => h.result.current.toggleKeep('svtw-other:variant-1'));

      expect(h.result.current.draft.kept).toEqual([]);
    });
  });

  describe('payload meter and commit blockers', () => {
    it('has no usage until a variant is kept, and commits only once something is kept', () => {
      const h = setup();
      expect(h.result.current.artifactUsage).toBeNull();
      expect(h.result.current.commitBlockers).toEqual(['no-workup']);

      settleWorkup(h);
      expect(h.result.current.commitBlockers).toEqual(['no-keep']);

      act(() => h.result.current.toggleKeep(fixtureVariantId(2)));
      expect(h.result.current.commitBlockers).toEqual([]);
    });

    it('counts against the projection and its count equals the projection length', () => {
      const h = setup();
      settleWorkup(h);
      act(() => h.result.current.toggleKeep(fixtureVariantId(3)));
      act(() => h.result.current.changeNote('keep the tell'));

      const usage = h.result.current.artifactUsage!;

      expect(usage.text).toBe(buildShowVsTellArtifact(h.result.current.draft));
      expect(usage.characters).toBe(usage.text.length);
      expect(usage.budget).toBe(PROMPT_BUDGETS.workshopWidgets.showVsTellArtifactCharacters);
      expect(usage.budget).toBe(600);
    });

    it('blocks with the over-ceiling blocker past 600 and lifts it when carry switches to direction', () => {
      const h = setup();
      settleWorkup(h);
      for (const ordinal of [2, 4, 6, 7]) {
        act(() => h.result.current.toggleKeep(fixtureVariantId(ordinal)));
        act(() => h.result.current.changeCarryMode(fixtureVariantId(ordinal), 'prose'));
      }
      act(() => h.result.current.changeMustSurvive('The distrust is old and funeral-rooted — and she never says it out loud.'));
      // The invalidation above cleared the workup; regenerate to keep working.
      act(() => h.result.current.generateWorkup());
      const token = h.options.generate.mock.results.at(-1)!.value as string;
      h.rerender({ generationResult: okResult(token) });
      for (const ordinal of [2, 4, 6, 7]) {
        act(() => h.result.current.toggleKeep(fixtureVariantId(ordinal)));
        act(() => h.result.current.changeCarryMode(fixtureVariantId(ordinal), 'prose'));
      }

      expect(h.result.current.artifactUsage!.characters).toBeGreaterThan(600);
      expect(h.result.current.commitBlockers).toEqual(['over-artifact-budget']);

      for (const ordinal of [2, 4, 6, 7]) {
        act(() => h.result.current.changeCarryMode(fixtureVariantId(ordinal), 'direction'));
      }

      expect(h.result.current.artifactUsage!.characters).toBeLessThanOrEqual(600);
      expect(h.result.current.commitBlockers).toEqual([]);
    });

    it('reports generation-in-flight first', () => {
      const h = setup();
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());

      expect(h.result.current.commitBlockers[0]).toBe('generation-in-flight');
    });
  });

  describe('beat intake', () => {
    it('requests the editor selection on its own target', () => {
      const h = setup();

      act(() => h.result.current.requestBeatSelection());

      expect(h.options.requestBeatSelection).toHaveBeenCalledTimes(1);
    });

    it('keeps relativePath and the line range for an editor selection and drops sourceUri', () => {
      const h = setup();

      act(() => h.result.current.handleBeatSelection(selection({
        content: 'She hadn’t trusted him.',
        sourceUri: 'file:///Users/writer/novel/ch4.md',
        relativePath: 'chapters/four.md',
        startLine: 12,
        endLine: 12
      })));

      expect(h.result.current.draft.beat).toEqual({
        text: 'She hadn’t trusted him.',
        provenance: { kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 12, endLine: 12 }
      });
      expect(JSON.stringify(h.result.current.draft)).not.toContain('file://');
    });

    it('records clipboard intake as pasted', () => {
      const h = setup();

      act(() => h.result.current.handleBeatSelection(selection({ content: 'From the clipboard.' })));

      expect(h.result.current.draft.beat.provenance).toEqual({ kind: 'pasted' });
    });

    it('collapses line breaks on intake because a beat is a single line', () => {
      const h = setup();

      act(() => h.result.current.handleBeatSelection(selection({
        content: 'First line.\r\n  Second line.\n\nThird.'
      })));

      expect(h.result.current.draft.beat.text).toBe('First line. Second line. Third.');
      expect(collapseShowVsTellLineBreaks('a\nb')).toBe('a b');
    });

    it('shortens an over-long selection to the beat budget and says so', () => {
      const h = setup();
      const long = 'word '.repeat(80);

      act(() => h.result.current.handleBeatSelection(selection({ content: long })));

      expect(h.result.current.draft.beat.text.length)
        .toBeLessThanOrEqual(PROMPT_BUDGETS.workshopWidgets.showVsTellBeatCharacters);
      expect(h.result.current.intakeNotice).toMatch(/longer than 160 characters/);
    });

    it('ignores a selection for another target and any selection while generating', () => {
      const h = setup();
      act(() => h.result.current.handleBeatSelection(selection({
        target: 'workshop_creative_variations_subject', content: 'Not ours.'
      })));
      expect(h.result.current.draft.beat.text).toBe('');

      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());
      act(() => h.result.current.handleBeatSelection(selection({ content: 'Late.' })));

      expect(h.result.current.draft.beat.text).toBe('A beat.');
    });

    it('editing seeded text flips excerpt provenance to pasted', () => {
      const h = setup();
      act(() => h.result.current.handleBeatSelection(selection({
        content: 'Seeded.', sourceUri: 'file:///x.md', relativePath: 'x.md', startLine: 1, endLine: 1
      })));

      act(() => h.result.current.changeBeatText('Seeded, then edited.'));

      expect(h.result.current.draft.beat.provenance).toEqual({ kind: 'pasted' });
    });

    it('keeps single-line fields single-line and blanks the focal character under unspecified', () => {
      const h = setup();
      act(() => h.result.current.changePovMode('close-third'));
      act(() => h.result.current.changePovFocalCharacter('Dan\niel'));
      act(() => h.result.current.changeNote('one\ntwo'));
      expect(h.result.current.draft.pov.focalCharacter).toBe('Dan iel');
      expect(h.result.current.draft.note).toBe('one two');

      act(() => h.result.current.changePovMode('unspecified'));
      expect(h.result.current.draft.pov).toEqual({ mode: 'unspecified', focalCharacter: '' });
      act(() => h.result.current.changePovFocalCharacter('Ignored'));
      expect(h.result.current.draft.pov.focalCharacter).toBe('');
    });

    it('allows multi-line invariants', () => {
      const h = setup();

      act(() => h.result.current.changeMustSurvive('line one\nline two'));
      act(() => h.result.current.changeMustNotChange('no flashback\nno new scene'));

      expect(h.result.current.draft.invariants).toEqual({
        mustSurvive: 'line one\nline two',
        mustNotChange: 'no flashback\nno new scene'
      });
    });
  });

  it('re-seeds a fresh draft each time the sheet opens', () => {
    const h = setup();
    act(() => h.result.current.changeBeatText('First session.'));

    h.rerender({ opening: null });
    h.rerender({ opening: { kind: 'new' } });

    expect(h.result.current.draft.beat.text).toBe('');
  });
});
