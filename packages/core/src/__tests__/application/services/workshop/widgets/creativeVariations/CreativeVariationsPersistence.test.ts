import {
  DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR,
  WorkshopCreativeVariationsDraft,
  WorkshopCreativeVariationsWidgetConfigSnapshot,
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
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';

const creativeDraft = (): WorkshopCreativeVariationsDraft => ({
  subject: {
    text: 'Mara folded the letter before she answered.',
    provenance: { kind: 'pasted' }
  },
  surroundingContext: {
    writerText: '',
    sourceReferences: []
  },
  invariants: {
    mustSurvive: 'Mara delays her answer.',
    mustNotChange: ''
  },
  intent: {
    kind: 'custom-aim',
    aim: 'Make the restraint deliberate without making Mara cold.',
    distance: 'tail'
  },
  requestedCount: 3,
  workup: null,
  selections: [],
  note: ''
});

const creativeConfig = (
  config: WorkshopWidgetConfigSnapshot | undefined
): WorkshopCreativeVariationsWidgetConfigSnapshot => {
  if (config?.widgetId !== 'creative-variations') {
    throw new Error('Expected Creative Variations config');
  }
  return config;
};

describe('Creative Variations persistence integration', () => {
  it('joins create, clone, summarize, export, parse, and hydration as one exact arm', () => {
    const ledger = new WorkshopWidgetConfigLedger(() => 42, WORKSHOP_WIDGET_CONFIG_OPERATIONS);
    const input = creativeDraft();
    const created = ledger.create({ widgetId: 'creative-variations', draft: input });

    input.subject.text = 'mutation outside the ledger';
    creativeConfig(created).draft.subject.text = 'mutation of the returned clone';

    expect(creativeConfig(ledger.get('wc-1')).draft.subject.text).toBe(
      'Mara folded the letter before she answered.'
    );
    expect(ledger.summariesFor(new Set(['wc-1']))).toEqual([
      expect.objectContaining({
        widgetId: 'creative-variations',
        subjectPreview: 'Mara folded the letter before she answered.',
        selectionCount: 0
      })
    ]);

    const session = new WorkshopSessionService(() => 100);
    session.createWidgetConfig({ widgetId: 'creative-variations', draft: creativeDraft() });
    const parsed = parseWorkshopSessionStateV1(session.exportCommittedState());
    const restored = new WorkshopSessionService(() => 200);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);

    expect(creativeConfig(restored.getWidgetConfig('wc-1')).draft).toEqual(creativeDraft());
  });

  it('rejects a turn whose exact widget id does not match its config arm', () => {
    const session = committedCreativeSession();
    const state = session.exportCommittedState();
    const turn = state.turns.find((candidate) => candidate.widgetCommit)!;
    (turn.widgetCommit as { widgetId: string }).widgetId = 'gesture-playground';

    expect(() => parseWorkshopSessionStateV1(state)).toThrow(
      /links to a different widget/
    );
  });

  it('exports and hydrates a committed ready draft with exact blank aim and linkage', () => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    session.setSessionScope('open');
    const exactDraft: WorkshopCreativeVariationsDraft = {
      ...JSON.parse(JSON.stringify(generatedDraft)) as WorkshopCreativeVariationsDraft,
      intent: { ...generatedDraft.intent, aim: '' },
      selections: [{ position: 1, carryMode: 'direction' }],
      note: 'Preserve this authored note.'
    };
    const config = session.createWidgetConfig({
      widgetId: 'creative-variations',
      draft: exactDraft
    });
    const artifactId = session.mintWidgetArtifactId();
    const turn = session.beginPersonaMessage('req-creative', 'Commit one take.', undefined, {
      widgetId: 'creative-variations',
      widgetConfigId: config.id,
      rail: 'thread-artifact',
      artifactId,
      selectionCount: 1
    });
    session.recordRoomThreadArtifacts(turn.id, [{
      id: artifactId,
      kind: workshopWidgetArtifactKind('creative-variations'),
      name: 'Creative Variations Explorer',
      content: 'Creative Variations — selected takes\nTake 1 — direction:\nA quieter move.'
    }]);
    session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
    session.completeRun('req-creative', 'Accepted.');

    const exported = session.exportCommittedState();
    const parsed = parseWorkshopSessionStateV1(exported);
    const restored = new WorkshopSessionService(() => 100);
    restored.hydrateCommittedState(parsed, {}, DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR);
    const restoredConfig = creativeConfig(restored.getWidgetConfig('wc-1'));

    expect(restoredConfig.draft).toEqual(exactDraft);
    expect(restoredConfig.draft.intent.aim).toBe('');
    expect(restoredConfig).toMatchObject({
      committedTurnId: turn.id,
      artifactId: 'ta-1'
    });
    expect(restored.exportCommittedState().threadArtifacts).toEqual([
      expect.objectContaining({
        id: 'ta-1',
        turnId: turn.id,
        kind: 'widget:creative-variations'
      })
    ]);
    const summaries = restored.getSnapshot().widgetConfigs;
    expect(summaries).toEqual([
      expect.objectContaining({
        widgetId: 'creative-variations',
        selectionCount: 1
      })
    ]);
    expect(JSON.stringify(summaries)).not.toContain('Baseline — the competent fix');
    expect(JSON.stringify(summaries).length).toBeLessThan(1_000);
  });

  it('rejects a config whose artifact linkage diverges from its committed turn', () => {
    const session = committedCreativeSession();
    const state = session.exportCommittedState();
    creativeConfig(state.widgetConfigs![0]).artifactId = 'ta-2';
    state.counters.threadArtifact = 2;

    expect(() => parseWorkshopSessionStateV1(state)).toThrow(
      /invalid artifact linkage/
    );
  });

  it('rejects clone lineage that is missing or crosses widget arms', () => {
    const session = new WorkshopSessionService(() => 100);
    session.createWidgetConfig({ widgetId: 'creative-variations', draft: creativeDraft() });
    const missing = session.exportCommittedState();
    creativeConfig(missing.widgetConfigs![0]).clonedFromConfigId = 'wc-99';
    expect(() => parseWorkshopSessionStateV1(missing)).toThrow(/clones an unknown config/);

    session.createWidgetConfig({
      widgetId: 'gesture-playground',
      draft: {
        targetPhrase: 'she smiled',
        writerInstructions: '',
        contextText: '',
        characterNotes: '',
        sourceReferences: [],
        dictionaryMarkdown: '# Dictionary',
        menu: [
          { heading: 'Eyes', options: ['Look away', 'Look down', 'Look through'] },
          { heading: 'Hands', options: ['Fold the page', 'Set it down', 'Turn it over'] },
          { heading: 'Posture', options: ['Lean back', 'Turn aside', 'Hold still'] },
          { heading: 'Breath', options: ['Hold a breath', 'Let it go', 'Speak softly'] }
        ],
        selections: ['Look away'],
        note: '',
        includeDictionaryInCommit: false
      }
    });
    const crossed = session.exportCommittedState();
    creativeConfig(crossed.widgetConfigs![0]).clonedFromConfigId = 'wc-2';

    expect(() => parseWorkshopSessionStateV1(crossed)).toThrow(
      /clones a different widget/
    );

    const forward = new WorkshopSessionService(() => 100);
    forward.createWidgetConfig({ widgetId: 'creative-variations', draft: creativeDraft() });
    forward.createWidgetConfig({ widgetId: 'creative-variations', draft: creativeDraft() });
    const forwardState = forward.exportCommittedState();
    creativeConfig(forwardState.widgetConfigs![0]).clonedFromConfigId = 'wc-2';

    expect(() => parseWorkshopSessionStateV1(forwardState)).toThrow(
      /does not clone an earlier config/
    );
  });
});

function committedCreativeSession(): WorkshopSessionService {
  let now = 0;
  const session = new WorkshopSessionService(() => ++now);
  session.setSessionScope('open');
  const config = session.createWidgetConfig({
    widgetId: 'creative-variations',
    draft: creativeDraft()
  });
  const artifactId = session.mintWidgetArtifactId();
  const turn = session.beginPersonaMessage('req-1', 'Commit this comparison.', undefined, {
    widgetId: 'creative-variations',
    widgetConfigId: config.id,
    rail: 'thread-artifact',
    artifactId,
    selectionCount: 0
  });
  session.completeRun('req-1', 'The comparison is in the room.');
  session.recordWidgetCommit(config.id, { turnId: turn.id, artifactId });
  return session;
}
