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
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopGestureDraft,
  WorkshopWidgetRecommendation
} from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const oversizedContextAttachmentId = `ctx-${'9'.repeat(500)}`;

const draft = (overrides: Partial<WorkshopGestureDraft> = {}): WorkshopGestureDraft => ({
  targetPhrase: 'she smiled',
  writerInstructions: 'Keep the reaction private.',
  contextText: 'He set the mug down. She smiled.',
  characterNotes: 'Mara — guarded.',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu: [
    {
      heading: 'Delay the answer',
      options: ['Her gaze snagged', 'The smile arrived late', 'The answer waited']
    },
    {
      heading: 'Move it into the hands',
      options: ['She turned her mug a quarter-turn, then back', 'Her thumb found the seam', 'The spoon went still']
    },
    {
      heading: 'Let the observer read it',
      options: ['He knew that quiet', 'He mistook it for ease', 'The delay told him enough']
    },
    {
      heading: 'Use the room',
      options: ['The kettle clicked', 'Silence took the chair', 'The doorway stayed open']
    }
  ],
  selections: ['She turned her mug a quarter-turn, then back'],
  note: 'keep it small',
  includeDictionaryInCommit: false,
  ...overrides
});

const richRecommendation = (): WorkshopWidgetRecommendation => ({
  widgetId: 'gesture-playground',
  seed: {
    targetPhrase: 'she smiled',
    writerInstructions:
      'Preserve the defensive deflection. Avoid stock smile language and explore the mug as displaced action.',
    contextText:
      'Mara turned the cooling mug between her palms. “That is one version of it.” She smiled without looking up.',
    characterNotes:
      'Mara is cornered but refuses to offer a clean reaction. Her restraint is deliberate, and the mug gives the pressure somewhere physical to go.',
    sourceReferences: [
      { kind: 'active-excerpt' },
      { kind: 'context-attachment', attachmentId: 'ctx-2' }
    ]
  }
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
    first.draft.sourceReferences.push({
      kind: 'context-attachment',
      attachmentId: 'ctx-99'
    });
    expect(session.getWidgetConfig('wc-1')!.draft.selections).toHaveLength(1);
    expect(session.getWidgetConfig('wc-1')!.draft.sourceReferences).toEqual([]);
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

  it('round-trips the complete persona recommendation seed through V1 state', () => {
    session.setSessionScope('open');
    session.beginPersonaMessage('req-1', 'Help me reconsider this reaction.');
    const turn = session.completeRun(
      'req-1',
      'The smile is doing defensive work.',
      undefined,
      false,
      'host-conv',
      [],
      undefined,
      richRecommendation()
    )!;

    const restored = new WorkshopSessionService(() => 10_000);
    restored.hydrateCommittedState(
      session.exportCommittedState(),
      {},
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );

    expect(
      restored.getSnapshot().turns.find((candidate) => candidate.id === turn.id)
        ?.widgetRecommendation
    ).toEqual(richRecommendation());
  });

  it.each([
    ['targetPhrase', 'gestureTargetPhraseCharacters'],
    ['writerInstructions', 'gestureWriterInstructionsCharacters'],
    ['contextText', 'gestureContextCharacters'],
    ['characterNotes', 'gestureCharacterNotesCharacters']
  ] as const)(
    'rejects an over-budget persisted recommendation %s',
    (field, budgetKey) => {
      session.setSessionScope('open');
      session.beginPersonaMessage('req-1', 'Help me reconsider this reaction.');
      session.completeRun(
        'req-1',
        'The smile is doing defensive work.',
        undefined,
        false,
        'host-conv',
        [],
        undefined,
        richRecommendation()
      );
      const state = session.exportCommittedState();
      const assistantTurn = state.turns.find((turn) => turn.widgetRecommendation);
      assistantTurn!.widgetRecommendation!.seed![field] = 'x'.repeat(
        PROMPT_BUDGETS.workshopWidgets[budgetKey] + 1
      );

      expect(() => parseWorkshopSessionStateV1(state))
        .toThrow(new RegExp(`seed\\.${field}.*at most`));
    }
  );

  it('rejects blank or non-live recommendation state at persistence ingress', () => {
    session.setSessionScope('open');
    session.beginPersonaMessage('req-1', 'Help me reconsider this reaction.');
    session.completeRun(
      'req-1',
      'The smile is doing defensive work.',
      undefined,
      false,
      'host-conv',
      [],
      undefined,
      richRecommendation()
    );
    const blankState = session.exportCommittedState();
    const blankRecommendation = blankState.turns.find((turn) => turn.widgetRecommendation)!
      .widgetRecommendation!;
    blankRecommendation.seed!.writerInstructions = '   ';
    expect(() => parseWorkshopSessionStateV1(blankState))
      .toThrow(/seed\.writerInstructions.*non-empty/);

    const unavailableState = session.exportCommittedState();
    const unavailableRecommendation = unavailableState.turns.find(
      (turn) => turn.widgetRecommendation
    )!.widgetRecommendation!;
    (unavailableRecommendation as { widgetId: string }).widgetId = 'lexical-gravity';
    expect(() => parseWorkshopSessionStateV1(unavailableState))
      .toThrow(/live Conversation Widget id/);
  });

  it.each([
    {
      label: 'an invented path-bearing source reference',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        (
          state.widgetConfigs![0].draft.sourceReferences as unknown as Array<
            Record<string, unknown>
          >
        ).push({
          kind: 'context-attachment',
          attachmentId: 'ctx-1',
          path: '/workspace/private.md'
        });
      },
      message: /contains unknown field path/
    },
    {
      label: 'a malformed context id',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.widgetConfigs![0].draft.sourceReferences = [{
          kind: 'context-attachment',
          attachmentId: 'ctx-0'
        }];
      },
      message: /a ctx-<n> attachment id/
    },
    {
      label: 'duplicate source references',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.widgetConfigs![0].draft.sourceReferences = [
          { kind: 'active-excerpt' },
          { kind: 'active-excerpt' }
        ];
      },
      message: /source references without duplicates/
    },
    {
      label: 'serialized source references over budget',
      mutate: (state: ReturnType<WorkshopSessionService['exportCommittedState']>) => {
        state.widgetConfigs![0].draft.sourceReferences = [{
          kind: 'context-attachment',
          attachmentId: oversizedContextAttachmentId
        }];
      },
      message: /source references within 500 characters/
    }
  ])('rejects $label at persistence ingress', ({ mutate, message }) => {
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    mutate(state);
    expect(() => parseWorkshopSessionStateV1(state)).toThrow(message);
  });

  it('rejects malformed recommendation source references at persistence ingress', () => {
    session.setSessionScope('open');
    session.beginPersonaMessage('req-1', 'Help me reconsider this reaction.');
    session.completeRun(
      'req-1',
      'The smile is doing defensive work.',
      undefined,
      false,
      'host-conv',
      [],
      undefined,
      richRecommendation()
    );
    const state = session.exportCommittedState();
    const recommendation = state.turns.find((turn) => turn.widgetRecommendation)!
      .widgetRecommendation!;
    recommendation.seed!.sourceReferences = [
      { kind: 'context-attachment', attachmentId: 'ctx-2' },
      { kind: 'context-attachment', attachmentId: 'ctx-2' }
    ];

    expect(() => parseWorkshopSessionStateV1(state))
      .toThrow(/seed\.sourceReferences.*without duplicates/);
  });

  it('rejects an over-budget serialized recommendation source at persistence ingress', () => {
    session.setSessionScope('open');
    session.beginPersonaMessage('req-1', 'Help me reconsider this reaction.');
    session.completeRun(
      'req-1',
      'The smile is doing defensive work.',
      undefined,
      false,
      'host-conv',
      [],
      undefined,
      richRecommendation()
    );
    const state = session.exportCommittedState();
    const recommendation = state.turns.find((turn) => turn.widgetRecommendation)!
      .widgetRecommendation!;
    recommendation.seed!.sourceReferences = [{
      kind: 'context-attachment',
      attachmentId: oversizedContextAttachmentId
    }];

    expect(() => parseWorkshopSessionStateV1(state))
      .toThrow(/seed\.sourceReferences.*within 500 characters/);
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

  it('defaults dictionary sharing off for widget drafts saved before the option existed', () => {
    session.setSessionScope('open');
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    delete (
      state.widgetConfigs![0].draft as unknown as {
        includeDictionaryInCommit?: boolean;
      }
    ).includeDictionaryInCommit;

    const restored = new WorkshopSessionService(() => 10_000);
    const result = restored.hydrateCommittedState(
      parseWorkshopSessionStateV1(state),
      {},
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );

    expect(result.normalizations).toContain('defaulted-widget-dictionary-sharing');
    expect(restored.getWidgetConfig('wc-1')!.draft.includeDictionaryInCommit)
      .toBe(false);
  });

  it('defaults source references to none for drafts saved before source selection existed', () => {
    session.setSessionScope('open');
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    delete (
      state.widgetConfigs![0].draft as unknown as { sourceReferences?: unknown }
    ).sourceReferences;

    const restored = new WorkshopSessionService(() => 10_000);
    const result = restored.hydrateCommittedState(
      parseWorkshopSessionStateV1(state),
      {},
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );

    expect(result.normalizations).toContain('defaulted-widget-source-references');
    expect(restored.getWidgetConfig('wc-1')!.draft.sourceReferences).toEqual([]);
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

  it('rejects a persisted Gesture Dictionary over the deterministic bound', () => {
    session.setSessionScope('open');
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    const state = session.exportCommittedState();
    state.widgetConfigs![0].draft.dictionaryMarkdown = 'x'.repeat(
      PROMPT_BUDGETS.workshopWidgets.gestureDictionaryCharacters + 1
    );

    expect(() => parseWorkshopSessionStateV1(state))
      .toThrow(/at most 32000 characters/);
  });

  it('clears configs and the counter at the new-session boundary', () => {
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() });
    session.reset();
    expect(session.getSnapshot().widgetConfigs).toEqual([]);
    expect(session.createWidgetConfig({ widgetId: 'gesture-playground', draft: draft() }).id)
      .toBe('wc-1');
  });
});
