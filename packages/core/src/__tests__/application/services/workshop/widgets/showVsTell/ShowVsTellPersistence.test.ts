import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopShowVsTellWidgetConfigSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import {
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import {
  parseWorkshopSessionStateV1
} from '@/application/services/workshop/WorkshopSessionStateV1';
import {
  WorkshopWidgetConfigLedger
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import {
  WORKSHOP_WIDGET_CONFIG_OPERATIONS
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigOperations';
import { workshopWidgetArtifactKind } from '@shared/constants/workshopWidgets';
import {
  assertShowVsTellDraftCheckpointShape,
  assertShowVsTellDraftShape
} from '@/application/services/workshop/widgets/showVsTell/ShowVsTellConfigCodec';
import {
  fixtureVariantId,
  generatedShowVsTellDraft,
  ungeneratedShowVsTellDraft
} from '@/__tests__/application/services/workshop/widgets/showVsTell/showVsTellFixtures';

const showVsTellConfig = (
  config: WorkshopWidgetConfigSnapshot | undefined
): WorkshopShowVsTellWidgetConfigSnapshot => {
  if (config?.widgetId !== 'show-vs-tell') {
    throw new Error('Expected Show vs. Tell config');
  }
  return config;
};

describe('Show vs. Tell persistence integration', () => {
  it('joins create, clone, summarize, export, parse, and hydration as one exact arm', () => {
    const ledger = new WorkshopWidgetConfigLedger(() => 42, WORKSHOP_WIDGET_CONFIG_OPERATIONS);
    const input = generatedShowVsTellDraft();
    const created = ledger.create({ widgetId: 'show-vs-tell', draft: input });

    input.beat.text = 'mutation outside the ledger';
    showVsTellConfig(created).draft.kept[0].carryMode = 'prose';

    expect(showVsTellConfig(ledger.get('wc-1')).draft).toEqual(generatedShowVsTellDraft());
    expect(ledger.summariesFor(new Set(['wc-1']))).toEqual([
      {
        id: 'wc-1',
        widgetId: 'show-vs-tell',
        revision: 1,
        clonedFromConfigId: undefined,
        createdAt: 42,
        beatPreview: 'She hadn’t trusted him since the funeral.',
        keptCount: 2,
        directionCount: 1
      }
    ]);

    const session = new WorkshopSessionService(() => 100);
    session.createWidgetConfig({ widgetId: 'show-vs-tell', draft: ungeneratedShowVsTellDraft() });
    const parsed = parseWorkshopSessionStateV1(session.exportCommittedState());
    const restored = new WorkshopSessionService(() => 200);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

    expect(showVsTellConfig(restored.getWidgetConfig('wc-1')).draft)
      .toEqual(ungeneratedShowVsTellDraft());
  });

  it('exports and hydrates a committed draft with its workup, carry modes, note, and linkage', () => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    session.setSessionScope('open');
    const exactDraft = generatedShowVsTellDraft();
    const config = session.createWidgetConfig({ widgetId: 'show-vs-tell', draft: exactDraft });
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('req-svt', 'Carry the beat at the hinge.', undefined, {
      widgetId: 'show-vs-tell',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: 2
    });
    session.recordRoomThreadArtifacts(turn.id, [{
      id: artifactId,
      kind: workshopWidgetArtifactKind('show-vs-tell'),
      name: 'Show vs. Tell Playground',
      content: 'beat: "She hadn’t trusted him since the funeral."\nposition: hinge · tell the bridge, show the fulcrum'
    }]);
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
    session.completeRun('req-svt', 'Accepted.');

    const parsed = parseWorkshopSessionStateV1(session.exportCommittedState());
    const restored = new WorkshopSessionService(() => 100);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    const restoredConfig = showVsTellConfig(restored.getWidgetConfig('wc-1'));

    expect(restoredConfig.draft).toEqual(exactDraft);
    expect(restoredConfig).toMatchObject({ committedTurnId: turn.id, artifactId: 'ta-1' });
    const summaries = restored.getSnapshot().widgetConfigs;
    expect(summaries).toEqual([
      expect.objectContaining({ widgetId: 'show-vs-tell', keptCount: 2, directionCount: 1 })
    ]);
    expect(JSON.stringify(summaries)).not.toContain('doorframe');
  });

  it('fails a session closed when a persisted draft breaks its exact shape', () => {
    const session = new WorkshopSessionService(() => 100);
    session.createWidgetConfig({ widgetId: 'show-vs-tell', draft: ungeneratedShowVsTellDraft() });
    const state = session.exportCommittedState();
    (showVsTellConfig(state.widgetConfigs![0]).draft.channels as string[]) = ['scent'];

    expect(() => parseWorkshopSessionStateV1(state)).toThrow(/channels\[0\] must be observable-action/);
  });

  describe('a session saved before Slice 7 (design edits)', () => {
    /**
     * The pre-Slice-7 draft: no `surroundingContext.writerText`, at most one
     * source, a required must survive, at least one channel. D3 and D4 only
     * relax rules, so the one repair is the missing passage text (ADR 2026-07-30).
     */
    const oldShapeState = () => {
      const session = new WorkshopSessionService(() => 100);
      session.createWidgetConfig({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() });
      const state = session.exportCommittedState();
      const draft = showVsTellConfig(state.widgetConfigs![0]).draft as unknown as Record<string, unknown>;
      draft.surroundingContext = { sourceReferences: [{ kind: 'active-excerpt' }] };
      return state;
    };

    it('normalizes the missing passage text, logs it by name, and hydrates the rest exactly', () => {
      const parsed = parseWorkshopSessionStateV1(oldShapeState());
      const restored = new WorkshopSessionService(() => 200);

      const result = restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

      expect(result.normalizations).toContain('defaulted-widget-show-vs-tell-surrounding-passage-text');
      const restoredDraft = showVsTellConfig(restored.getWidgetConfig('wc-1')).draft;
      expect(restoredDraft).toEqual({
        ...generatedShowVsTellDraft(),
        surroundingContext: { writerText: '', sourceReferences: [{ kind: 'active-excerpt' }] }
      });
      // Written back in the current shape only: a second hydration repairs nothing.
      const rewritten = parseWorkshopSessionStateV1(restored.exportCommittedState());
      const again = new WorkshopSessionService(() => 300)
        .hydrateCommittedState(rewritten, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
      expect(again.normalizations).not.toContain('defaulted-widget-show-vs-tell-surrounding-passage-text');
    });

    it('refuses the old shape at the strict current-shape boundary', () => {
      const draft = showVsTellConfig(oldShapeState().widgetConfigs![0]).draft;
      expect(() => assertShowVsTellDraftShape(draft, 'draft')).toThrow(/writerText/);
      expect(() => assertShowVsTellDraftCheckpointShape(draft, 'draft')).not.toThrow();
    });
  });

  it('fails hydration closed when a persisted draft breaks semantic integrity', () => {
    const session = new WorkshopSessionService(() => 100);
    session.createWidgetConfig({ widgetId: 'show-vs-tell', draft: generatedShowVsTellDraft() });
    const state = session.exportCommittedState();
    showVsTellConfig(state.widgetConfigs![0]).draft.kept[1].variantId = fixtureVariantId(8);
    // The raw checkpoint boundary defers draft integrity until after normalization.
    const parsed = parseWorkshopSessionStateV1(state);
    const restored = new WorkshopSessionService(() => 200);

    expect(() => restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR))
      .toThrow(/a variant in the current workup/);
    expect(restored.getWidgetConfig('wc-1')).toBeUndefined();
  });
});
