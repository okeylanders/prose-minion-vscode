import {
  WorkshopGestureDraft,
  WorkshopGestureWidgetConfigSnapshot,
  WorkshopWidgetConfigSnapshot
} from '@messages';
import {
  WorkshopWidgetConfigLedger,
  WorkshopWidgetConfigOperations
} from '@/application/services/workshop/widgets/WorkshopWidgetConfigLedger';
import { WORKSHOP_WIDGET_CONFIG_OPERATIONS } from '@/application/services/workshop/widgets/WorkshopWidgetConfigOperations';

const draftOperations = WORKSHOP_WIDGET_CONFIG_OPERATIONS;

const gestureConfig = (
  config: WorkshopWidgetConfigSnapshot | undefined
): WorkshopGestureWidgetConfigSnapshot => {
  if (config?.widgetId !== 'gesture-playground') {
    throw new Error('Expected Gesture Playground config');
  }
  return config;
};

const draft = (targetPhrase = 'she smiled'): WorkshopGestureDraft => ({
  targetPhrase,
  writerInstructions: 'Keep the response guarded.',
  contextText: 'She folded the letter before answering.',
  characterNotes: 'Mara deflects when she feels cornered.',
  sourceReferences: [{ kind: 'active-excerpt' }],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA private deflection.',
  menu: [
    { heading: 'Eyes', options: ['Her gaze slid to the folded letter.'] },
    { heading: 'Hands', options: ['Her thumb worried the paper crease.'] },
    { heading: 'Posture', options: ['One shoulder lifted between them.'] },
    { heading: 'Breath', options: ['The answer left on a measured breath.'] }
  ],
  selections: ['Her gaze slid to the folded letter.'],
  note: 'Keep it small.',
  includeDictionaryInCommit: false
});

describe('WorkshopWidgetConfigLedger', () => {
  it('mints monotonic identities and owns defensive copies', () => {
    let now = 100;
    const ledger = new WorkshopWidgetConfigLedger(() => ++now, draftOperations);
    const input = draft();

    const first = ledger.create({ widgetId: 'gesture-playground', draft: input });
    const second = ledger.create({
      widgetId: 'gesture-playground',
      draft: draft('he looked away'),
      clonedFromConfigId: first.id
    });

    input.selections.push('A mutation that must not enter the ledger.');
    gestureConfig(first).draft.menu[0].options[0] = 'A returned-copy mutation.';

    expect(first.id).toBe('wc-1');
    expect(first.createdAt).toBe(101);
    expect(second).toEqual(expect.objectContaining({
      id: 'wc-2',
      clonedFromConfigId: 'wc-1',
      createdAt: 102
    }));
    expect(gestureConfig(ledger.get('wc-1')).draft.selections).toEqual([
      'Her gaze slid to the folded letter.'
    ]);
    expect(gestureConfig(ledger.get('wc-1')).draft.menu[0].options[0]).toBe(
      'Her gaze slid to the folded letter.'
    );
  });

  it('records landed commit linkage and refuses unknown configs', () => {
    const ledger = new WorkshopWidgetConfigLedger(() => 1, draftOperations);
    const config = ledger.create({ widgetId: 'gesture-playground', draft: draft() });

    ledger.recordCommit(config.id, { turnId: 'turn-1-user-1', artifactId: 'ta-1' });

    expect(ledger.get(config.id)).toEqual(expect.objectContaining({
      committedTurnId: 'turn-1-user-1',
      artifactId: 'ta-1'
    }));
    expect(() => ledger.recordCommit('wc-99', {
      turnId: 'turn-2-user-1',
      artifactId: 'ta-2'
    })).toThrow('Unknown widget config wc-99');
  });

  it('projects only requested display-safe summaries', () => {
    const ledger = new WorkshopWidgetConfigLedger(() => 1, draftOperations);
    ledger.create({ widgetId: 'gesture-playground', draft: draft() });
    ledger.create({ widgetId: 'gesture-playground', draft: draft('he looked away') });

    const summaries = ledger.summariesFor(new Set(['wc-2']));

    expect(summaries).toEqual([expect.objectContaining({
      id: 'wc-2',
      targetPhrase: 'he looked away',
      selectionCount: 1
    })]);
    expect(summaries[0]).not.toHaveProperty('draft');
  });

  it('prepares, installs, exports, and resets state without leaking mutable references', () => {
    const source = new WorkshopWidgetConfigLedger(() => 1, draftOperations);
    source.create({ widgetId: 'gesture-playground', draft: draft() });
    const exported = source.exportState();
    gestureConfig(exported.configs[0]).draft.selections.push('Export mutation.');
    expect(gestureConfig(source.get('wc-1')).draft.selections).toHaveLength(1);

    const hydrationInput = source.exportState();
    const restored = new WorkshopWidgetConfigLedger(() => 2, draftOperations);
    const prepared = restored.prepareState(hydrationInput);
    gestureConfig(hydrationInput.configs[0]).draft.selections.push('Hydration-input mutation.');
    restored.installPreparedState(prepared);

    expect(gestureConfig(restored.get('wc-1')).draft.selections).toHaveLength(1);
    expect(restored.create({ widgetId: 'gesture-playground', draft: draft() }).id).toBe('wc-2');

    restored.reset();

    expect(restored.get('wc-1')).toBeUndefined();
    expect(restored.exportState()).toEqual({ counter: 0, configs: [] });
    expect(restored.create({ widgetId: 'gesture-playground', draft: draft() }).id).toBe('wc-1');
  });

  it('leaves installed state untouched when preparation fails', () => {
    const operations: WorkshopWidgetConfigOperations = {
      ...draftOperations,
      cloneSnapshot: (config) => {
        if (
          config.widgetId === 'gesture-playground'
          && config.draft.targetPhrase === 'clone failure'
        ) {
          throw new Error('clone failed');
        }
        return draftOperations.cloneSnapshot(config);
      }
    };
    const ledger = new WorkshopWidgetConfigLedger(() => 1, operations);
    ledger.create({ widgetId: 'gesture-playground', draft: draft() });
    const before = ledger.exportState();

    expect(() => ledger.prepareState({
      counter: 2,
      configs: [{
        id: 'wc-2',
        widgetId: 'gesture-playground',
        revision: 1,
        draft: draft('clone failure'),
        createdAt: 2
      }]
    })).toThrow('clone failed');

    expect(ledger.exportState()).toEqual(before);
  });

});
