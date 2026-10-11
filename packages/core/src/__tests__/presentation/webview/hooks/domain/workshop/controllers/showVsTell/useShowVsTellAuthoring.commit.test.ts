/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';
import {
  useShowVsTellAuthoring,
  type UseShowVsTellAuthoringOptions
} from '@hooks/domain/workshop/controllers/showVsTell/useShowVsTellAuthoring';
import type { WorkshopShowVsTellDraft, WorkshopShowVsTellWidgetConfigSnapshot } from '@messages';
import {
  fixtureVariantId,
  generatedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const noop = (): void => undefined;

const baseOptions = (): UseShowVsTellAuthoringOptions => ({
  opening: { kind: 'new' },
  activeExcerpt: null,
  contextAttachments: [],
  roomKey: 'room-1',
  widgetModelId: 'model-a',
  generationProgress: null,
  generationResult: null,
  requestBeatSelection: jest.fn(),
  requestPassageSelection: jest.fn(() => 'psel-1'),
  generate: jest.fn(() => 'token-1'),
  cancelGeneration: jest.fn(),
  roomRunActive: false,
  toolTargetActive: false,
  commitPending: false,
  commitOutcome: null,
  commit: jest.fn(),
  clearCommitResult: jest.fn(),
  resetCommitState: jest.fn(),
  onCommitAccepted: jest.fn()
});

const cloneConfig = (
  draft: WorkshopShowVsTellDraft,
  id = 'wc-4'
): WorkshopShowVsTellWidgetConfigSnapshot => ({
  id,
  revision: 1,
  createdAt: 1,
  widgetId: 'show-vs-tell',
  committedTurnId: 'turn-9',
  artifactId: 'ta-9',
  draft
} as WorkshopShowVsTellWidgetConfigSnapshot);

function mount(initial: Partial<UseShowVsTellAuthoringOptions> = {}) {
  const base = { ...baseOptions(), ...initial };
  const hook = renderHook(
    (props: UseShowVsTellAuthoringOptions) => useShowVsTellAuthoring(props),
    { initialProps: base }
  );
  let current = base;
  return {
    options: base,
    result: hook.result,
    rerender: (props: Partial<UseShowVsTellAuthoringOptions>) => {
      current = { ...current, ...props };
      hook.rerender(current);
    }
  };
}

/** A committed draft with every field set: provenance, source, POV, multi-line values, carry modes, note. */
const richDraft = (): WorkshopShowVsTellDraft => {
  const draft = generatedShowVsTellDraft();
  draft.beat.provenance = { kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 12, endLine: 12 };
  draft.surroundingContext = {
    writerText: 'He set the mug down.\nShe did not look up.',
    sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-3' }]
  };
  draft.pov = { mode: 'close-third', focalCharacter: 'Daniel' };
  draft.invariants = {
    mustSurvive: 'The distrust is old.\nShe never says it out loud.',
    mustNotChange: 'No flashback.\nStay in tonight.'
  };
  draft.channels = ['observable-action', 'interiority', 'summary-exposition'];
  draft.lengthBudget = 'plus-one-sentence';
  draft.position = 'evidence';
  draft.kept = [
    { variantId: fixtureVariantId(3), carryMode: 'direction' },
    { variantId: fixtureVariantId(6), carryMode: 'prose' },
    { variantId: fixtureVariantId(7), carryMode: 'direction' }
  ];
  draft.note = 'the tell can stay';
  return draft;
};

const keepOne = (h: ReturnType<typeof mount>): void => {
  // A clone opening carries a settled workup, so a keep is all a commit needs.
  act(() => h.result.current.toggleKeep(fixtureVariantId(2)));
};

describe('useShowVsTellAuthoring commit', () => {
  it('derives commit blockers in priority order: what is happening now, then the draft', () => {
    const h = mount({
      opening: { kind: 'clone', config: cloneConfig({ ...generatedShowVsTellDraft(), kept: [] }) },
      roomRunActive: true,
      toolTargetActive: true,
      commitPending: true
    });

    expect(h.result.current.commitBlockers).toEqual([
      'commit-in-flight',
      'room-run-active',
      'tool-target',
      'no-keep'
    ]);

    h.rerender({ commitPending: false, roomRunActive: false });
    expect(h.result.current.commitBlockers).toEqual(['tool-target', 'no-keep']);
    h.rerender({ toolTargetActive: false });
    expect(h.result.current.commitBlockers).toEqual(['no-keep']);
    keepOne(h);
    expect(h.result.current.commitBlockers).toEqual([]);
  });

  it('puts a running generation ahead of everything else', () => {
    const h = mount();
    act(() => {
      h.result.current.changeBeatText('A beat.');
      h.result.current.changeMustSurvive('The turn.');
    });
    act(() => h.result.current.generateWorkup());
    h.rerender({ commitPending: true, roomRunActive: true });

    expect(h.result.current.commitBlockers.slice(0, 3)).toEqual([
      'generation-in-flight',
      'commit-in-flight',
      'room-run-active'
    ]);
  });

  it('commits the exact draft and nothing while a blocker stands', () => {
    const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) }, roomRunActive: true });

    act(() => h.result.current.commitDraft());
    expect(h.options.commit).not.toHaveBeenCalled();

    h.rerender({ roomRunActive: false });
    act(() => h.result.current.commitDraft());
    expect(h.options.commit).toHaveBeenCalledTimes(1);
    expect(h.options.commit).toHaveBeenCalledWith(richDraft(), 'wc-4');
  });

  it('commits a fresh draft without clone lineage', () => {
    const h = mount({ opening: { kind: 'new' } });
    act(() => {
      h.result.current.changeBeatText('A beat.');
      h.result.current.changeMustSurvive('The turn.');
    });
    // A fresh draft has no workup to commit.
    act(() => h.result.current.commitDraft());

    expect(h.options.commit).not.toHaveBeenCalled();
    expect(h.result.current.commitBlockers).toEqual(['no-workup']);
  });

  describe('outcomes', () => {
    it('closes through onCommitAccepted on an accepted commit and clears the result once', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      h.rerender({ commitOutcome: { ok: true } });

      expect(h.options.clearCommitResult).toHaveBeenCalledTimes(1);
      expect(h.options.onCommitAccepted).toHaveBeenCalledTimes(1);
      expect(h.result.current.commitError).toBeNull();
    });

    it('shows the host message and keeps the exact draft on a rejection', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      h.rerender({
        commitOutcome: { ok: false, message: 'The commit payload is over its 600-character ceiling.' }
      });

      expect(h.options.onCommitAccepted).not.toHaveBeenCalled();
      expect(h.result.current.commitError).toBe('The commit payload is over its 600-character ceiling.');
      expect(h.result.current.draft).toEqual(richDraft());
    });

    it('falls back to a plain message when the host sent none, and clears it on the next attempt', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      h.rerender({ commitOutcome: { ok: false } });
      expect(h.result.current.commitError).toMatch(/did not reach the room/);

      act(() => h.result.current.commitDraft());
      expect(h.result.current.commitError).toBeNull();
    });

    it('ignores an acknowledgement that was already held when the sheet opened', () => {
      const stale = { ok: true };
      const h = mount({ opening: null, commitOutcome: stale });

      h.rerender({ opening: { kind: 'new' } });

      expect(h.options.onCommitAccepted).not.toHaveBeenCalled();
      expect(h.options.resetCommitState).toHaveBeenCalled();

      h.rerender({ commitOutcome: { ok: true } });
      expect(h.options.onCommitAccepted).toHaveBeenCalledTimes(1);
    });
  });

  describe('exact reopen and clone', () => {
    it('restores every committed field exactly, including multi-line values and carry modes', () => {
      const committed = richDraft();
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(committed) } });
      const { draft } = h.result.current;

      expect(draft).toEqual(committed);
      expect(draft.beat.provenance).toEqual({
        kind: 'excerpt', relativePath: 'chapters/four.md', startLine: 12, endLine: 12
      });
      expect(draft.surroundingContext).toEqual({
        writerText: 'He set the mug down.\nShe did not look up.',
        sourceReferences: [{ kind: 'active-excerpt' }, { kind: 'context-attachment', attachmentId: 'ctx-3' }]
      });
      expect(draft.pov).toEqual({ mode: 'close-third', focalCharacter: 'Daniel' });
      expect(draft.invariants.mustSurvive).toBe('The distrust is old.\nShe never says it out loud.');
      expect(draft.invariants.mustNotChange).toBe('No flashback.\nStay in tonight.');
      expect(draft.channels).toEqual(['observable-action', 'interiority', 'summary-exposition']);
      expect(draft.lengthBudget).toBe('plus-one-sentence');
      expect(draft.position).toBe('evidence');
      expect(draft.workup).toEqual(committed.workup);
      expect(draft.kept).toEqual(committed.kept);
      expect(draft.note).toBe('the tell can stay');
      expect(h.result.current.generation).toEqual({ kind: 'idle' });
    });

    it('seeds a draft only when the sheet opens, and a later room change never re-seeds it', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });
      act(() => h.result.current.changeNote('edited'));

      h.rerender({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      expect(h.result.current.draft.note).toBe('edited');
    });

    it('records the source config id as lineage for the recommit, and not for a new draft', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft(), 'wc-11') } });
      act(() => h.result.current.commitDraft());
      expect(h.options.commit).toHaveBeenLastCalledWith(expect.anything(), 'wc-11');

      h.rerender({ opening: null });
      h.rerender({ opening: { kind: 'new' } });
      expect(h.result.current.draft.workup).toBeNull();
    });

    it('forgets the lineage when the sheet closes and reopens as another clone', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft(), 'wc-11') } });
      h.rerender({ opening: null });
      h.rerender({ opening: { kind: 'clone', config: cloneConfig(richDraft(), 'wc-12') } });

      act(() => h.result.current.commitDraft());

      expect(h.options.commit).toHaveBeenCalledWith(expect.anything(), 'wc-12');
    });

    it('keeps an unavailable source reference exactly as committed, blocks Generate, and still commits', () => {
      // The active excerpt is gone from the room and attachment ctx-3 was removed.
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      expect(h.result.current.draft.surroundingContext).toEqual(richDraft().surroundingContext);
      expect(h.result.current.availableSources).toEqual([]);
      expect(h.result.current.generateBlockers).toContain('source-unavailable');
      expect(h.result.current.commitBlockers).toEqual([]);

      act(() => h.result.current.commitDraft());
      expect(h.options.commit).toHaveBeenCalledWith(
        expect.objectContaining({ surroundingContext: richDraft().surroundingContext }),
        'wc-4'
      );
    });

    it('keeps the reopened workup when the room or model changed before the sheet opened', () => {
      const h = mount({ opening: null, roomKey: 'room-1', widgetModelId: 'model-a' });

      h.rerender({
        roomKey: 'room-2',
        widgetModelId: 'model-b',
        opening: { kind: 'clone', config: cloneConfig(richDraft()) }
      });

      expect(h.result.current.draft).toEqual(richDraft());
      expect(h.result.current.invalidationNotice).toBeNull();
    });

    it('still invalidates grounded work when the room changes after the clone opened', () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });

      h.rerender({ roomKey: 'room-2' });

      expect(h.result.current.draft.workup).toBeNull();
      expect(h.result.current.draft.kept).toEqual([]);
      expect(h.result.current.invalidationNotice).toBe(
        'Generated workup cleared because the room changed.'
      );
      expect(h.result.current.commitBlockers).toEqual(['no-workup']);
    });
  });

  describe('while a commit is pending the draft is what was submitted', () => {
    const pending = () => {
      const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });
      h.rerender({ commitPending: true });
      return h;
    };

    it('refuses a position change in the controller, not only in the UI', () => {
      const h = pending();

      act(() => h.result.current.changePosition('state-it'));

      expect(h.result.current.draft).toEqual(richDraft());
    });

    it('drops a late selection reply and keeps the workup and keeps', () => {
      const h = pending();

      act(() => h.result.current.handleBeatSelection({
        type: 'select' as never,
        source: 'extension.ui',
        timestamp: 1,
        payload: { target: 'workshop_show_vs_tell_beat', content: 'A different beat.' }
      } as never));

      expect(h.result.current.draft).toEqual(richDraft());
      expect(h.result.current.invalidationNotice).toBeNull();
    });

    it('drops a late passage selection reply and refuses Use excerpt and a source toggle (D2)', () => {
      const h = mount({
        opening: { kind: 'clone', config: cloneConfig(richDraft()) },
        activeExcerpt: { text: 'Excerpt text.', version: 1, pinnedAt: 1, source: { kind: 'manual' } } as never
      });
      h.rerender({ commitPending: true });

      act(() => {
        h.result.current.handlePassageSelection({
          type: 'select' as never,
          source: 'extension.ui',
          timestamp: 1,
          payload: { target: 'workshop_show_vs_tell_passage', content: 'A late passage.' }
        } as never);
        h.result.current.usePassageFromExcerpt();
        h.result.current.requestPassageSelection();
        h.result.current.changePassageText('Typed while pending.');
        h.result.current.toggleSourceReference({ kind: 'active-excerpt' });
      });

      expect(h.result.current.draft).toEqual(richDraft());
      expect(h.options.requestPassageSelection).not.toHaveBeenCalled();
      expect(h.result.current.invalidationNotice).toBeNull();
    });

    it('refuses every other writer edit, and Generate', () => {
      const h = pending();

      act(() => {
        h.result.current.changeBeatText('Another beat.');
        h.result.current.changeMustSurvive('Another truth.');
        h.result.current.toggleKeep(fixtureVariantId(1));
        h.result.current.changeCarryMode(fixtureVariantId(3), 'prose');
        h.result.current.changeNote('another note');
        h.result.current.generateWorkup();
      });

      expect(h.result.current.draft).toEqual(richDraft());
      expect(h.options.generate).not.toHaveBeenCalled();
    });

    it('accepts edits again once the commit is no longer pending', () => {
      const h = pending();
      h.rerender({ commitPending: false });

      act(() => h.result.current.changePosition('state-it'));

      expect(h.result.current.draft.position).toBe('state-it');
      expect(h.result.current.draft.workup).not.toBeNull();
    });

    it('still lets the position move during generation, keeping the attempt', () => {
      const h = mount({ opening: { kind: 'new' } });
      act(() => {
        h.result.current.changeBeatText('A beat.');
        h.result.current.changeMustSurvive('The turn.');
      });
      act(() => h.result.current.generateWorkup());

      act(() => h.result.current.changePosition('inhabit'));

      expect(h.result.current.draft.position).toBe('inhabit');
      expect(h.result.current.generation.kind).toBe('generating');
    });
  });

  it('is transport-free: nothing here posts a message', () => {
    const h = mount({ opening: { kind: 'clone', config: cloneConfig(richDraft()) } });
    act(() => h.result.current.commitDraft());

    expect(h.options.commit).toHaveBeenCalledTimes(1);
    expect(noop()).toBeUndefined();
  });
});
