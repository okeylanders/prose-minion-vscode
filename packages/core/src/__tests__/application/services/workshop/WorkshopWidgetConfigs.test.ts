/**
 * The session-owned widget-config spine (ADR 2026-07-22 decisions 5–6):
 * `wc-N` minting, clone lineage, commit linkage, the shared `ta-N` counter,
 * snapshot exposure, reset, and the frozen-V1 export → hydrate round-trip
 * (including the absent-hydrates-empty path for pre-widget checkpoints).
 */

import {
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopGestureDraft
} from '@messages';

const draft = (overrides: Partial<WorkshopGestureDraft> = {}): WorkshopGestureDraft => ({
  targetPhrase: 'she smiled',
  contextText: 'He set the mug down. She smiled.',
  characterNotes: 'Mara — guarded.',
  menu: [
    { heading: 'The eyes', options: ['Her gaze snagged a half-second too long'] },
    { heading: 'Hands & body', options: ['She turned her mug a quarter-turn, then back'] }
  ],
  selections: ['She turned her mug a quarter-turn, then back'],
  note: 'keep it small',
  ...overrides
});

describe('WorkshopSessionService — widget configs', () => {
  let clock: number;
  let session: WorkshopSessionService;

  beforeEach(() => {
    clock = 0;
    session = new WorkshopSessionService(() => ++clock);
  });

  it('mints monotonic wc-N ids, revision 1, and defensive clones', () => {
    const first = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const second = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    expect(first.id).toBe('wc-1');
    expect(second.id).toBe('wc-2');
    expect(first.revision).toBe(1);
    // Mutating the returned clone must not touch the stored config.
    first.draft.selections.push('sneaky');
    expect(session.getWidgetConfig('wc-1')!.draft.selections).toHaveLength(1);
  });

  it('records clone lineage without retiring the source config', () => {
    const original = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const clone = session.createWidgetConfig({
      widgetId: 'gesture-playground',
      draft: draft({ note: 'louder this time' }),
      clonedFromConfigId: original.id
    });
    expect(clone.clonedFromConfigId).toBe('wc-1');
    expect(session.getWidgetConfig('wc-1')).toBeDefined();
    expect(session.getWidgetConfig('wc-2')!.draft.note).toBe('louder this time');
  });

  it('shares the ta-N counter with message attachments — ids never collide', () => {
    session.addMessageAttachment({ label: 'notes.md', words: 5, content: 'notes' });
    const widgetArtifactId = session.mintWidgetArtifactId();
    expect(widgetArtifactId).toBe('ta-2');
  });

  it('stamps commit linkage and exposes configs in the snapshot', () => {
    session.setSessionScope('open');
    const config = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('req-1', 'For “she smiled”…', undefined, {
      widgetId: 'gesture-playground',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: 1
    });
    expect(turn.widgetCommit).toEqual(expect.objectContaining({
      widgetConfigId: 'wc-1',
      artifactId: 'ta-1',
      rail: 'thread-artifact'
    }));
    session.completeRun('req-1', 'Took the beat again.');
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });

    const snapshot = session.getSnapshot();
    expect(snapshot.widgetConfigs).toHaveLength(1);
    expect(snapshot.widgetConfigs[0]).toEqual(expect.objectContaining({
      id: 'wc-1',
      committedTurnId: turn.id,
      artifactId: 'ta-1'
    }));
    expect(snapshot.turns.at(-2)?.widgetCommit?.widgetConfigId).toBe('wc-1');
  });

  it('throws when stamping linkage on an unknown config', () => {
    expect(() => session.recordWidgetCommit('wc-9', { turnId: 't', artifactId: 'ta-1' }))
      .toThrow(/Unknown widget config/);
  });

  it('round-trips configs, counters, and turn decoration through V1 state', () => {
    session.setSessionScope('open');
    const config = session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('req-1', 'commit message', undefined, {
      widgetId: 'gesture-playground',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: 1
    });
    session.completeRun('req-1', 'reply');
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });

    const state = session.exportCommittedState();
    expect(state.counters.widgetConfig).toBe(1);
    expect(state.widgetConfigs).toHaveLength(1);

    const restored = new WorkshopSessionService(() => 10_000);
    restored.hydrateCommittedState(state, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(restored.getWidgetConfig('wc-1')!.draft).toEqual(draft());
    // The counter survives, so the next mint cannot collide with history.
    expect(restored.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() }).id)
      .toBe('wc-2');
    const restoredTurns = restored.getSnapshot().turns;
    expect(restoredTurns.find((candidate) => candidate.id === turn.id)?.widgetCommit?.artifactId)
      .toBe('ta-1');
  });

  it('hydrates pre-widget checkpoints (absent collection) to empty', () => {
    session.setSessionScope('open');
    const state = session.exportCommittedState();
    delete (state as { widgetConfigs?: unknown }).widgetConfigs;
    delete (state.counters as { widgetConfig?: unknown }).widgetConfig;

    const restored = new WorkshopSessionService(() => 10_000);
    restored.hydrateCommittedState(state, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    expect(restored.getSnapshot().widgetConfigs).toEqual([]);
    expect(restored.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() }).id)
      .toBe('wc-1');
  });

  it('rejects a persisted counter that trails an existing wc id', () => {
    session.setSessionScope('open');
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    state.counters.widgetConfig = 0;

    const restored = new WorkshopSessionService(() => 10_000);
    expect(() =>
      restored.hydrateCommittedState(state, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR)
    ).toThrow(/widget-config counter trails/);
  });

  it('rejects a persisted config referencing an unknown turn', () => {
    session.setSessionScope('open');
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    state.widgetConfigs![0].committedTurnId = 'turn-99-user-1';

    const restored = new WorkshopSessionService(() => 10_000);
    expect(() =>
      restored.hydrateCommittedState(state, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR)
    ).toThrow(/references an unknown turn/);
  });

  it('clears configs and the counter at the new-session boundary', () => {
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    session.reset();
    expect(session.getSnapshot().widgetConfigs).toEqual([]);
    expect(session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() }).id)
      .toBe('wc-1');
  });
});
