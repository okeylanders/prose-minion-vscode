import {
  WorkshopOneShotWidgetCommitCoordinator,
  type WorkshopOneShotWidgetRoomSend
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitCoordinator';
import type {
  WorkshopOneShotWidgetCommitPlan
} from '@/application/services/workshop/widgets/WorkshopOneShotWidgetCommitOperations';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopGesturePlaygroundDraft } from '@messages';

const menu = Array.from({ length: 4 }, (_, index) => ({
  heading: `Route ${index + 1}`,
  options: [`Option ${index + 1}.1`, `Option ${index + 1}.2`, `Option ${index + 1}.3`]
}));

const draft: WorkshopGesturePlaygroundDraft = {
  targetPhrase: 'she smiled',
  writerInstructions: '',
  contextText: '',
  characterNotes: '',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary\n\nA quiet refusal.',
  menu,
  selections: ['Option 1.1'],
  note: '',
  includeDictionaryInCommit: false
};

const prepared = (
  overrides: Partial<WorkshopOneShotWidgetCommitPlan> = {}
): WorkshopOneShotWidgetCommitPlan => ({
  widgetId: 'gesture-playground',
  widgetConfigInput: { widgetId: 'gesture-playground', draft },
  roomText: 'Here are the directions I want.',
  displayText: 'Here are the directions I want.',
  toolTargetRefusalMessage: 'Choose a persona target.',
  artifact: {
    label: 'Gesture Playground',
    content: 'Gesture directions I want:\n· Option 1.1',
    selectionCount: 1
  },
  ...overrides
});

const build = (sendRoomMessage?: jest.MockedFunction<WorkshopOneShotWidgetRoomSend>) => {
  let clock = 0;
  const session = new WorkshopSessionService(() => ++clock);
  session.setSessionScope('open');
  const send = sendRoomMessage ?? jest.fn().mockImplementation(async (
    _text,
    _displayText,
    options
  ) => {
    const turn = session.beginPersonaMessage('req-live', 'visible');
    options.onRoomAccepted(turn.id);
    session.completeRun('req-live', 'reply');
    return { committed: true };
  });
  const markDirty = jest.fn();
  const postSessionState = jest.fn();
  const appendLine = jest.fn();
  const coordinator = new WorkshopOneShotWidgetCommitCoordinator(
    session,
    { appendLine } as never,
    { sendRoomMessage: send, markDirty, postSessionState }
  );
  return {
    coordinator,
    session,
    sendRoomMessage: send,
    markDirty,
    postSessionState,
    appendLine
  };
};

describe('WorkshopOneShotWidgetCommitCoordinator', () => {
  it('persists config, ships outside the pending list, and stamps linkage on acceptance', async () => {
    const harness = build();
    harness.session.addMessageAttachment({ label: 'notes.md', words: 3, content: 'notes' });
    const onAccepted = jest.fn();

    const outcome = await harness.coordinator.commit(
      prepared(),
      { kind: 'host' },
      onAccepted
    );

    expect(harness.sendRoomMessage).toHaveBeenCalledWith(
      'Here are the directions I want.',
      'Here are the directions I want.',
      expect.objectContaining({
        includeMessageAttachments: false,
        widgetArtifact: expect.objectContaining({
          id: 'ta-2',
          widgetId: 'gesture-playground',
          widgetConfigId: 'wc-1'
        })
      })
    );
    expect(outcome).toEqual(expect.objectContaining({
      status: 'accepted',
      widgetConfigId: 'wc-1'
    }));
    expect(harness.session.getWidgetConfig('wc-1')).toMatchObject({
      committedTurnId: expect.any(String),
      artifactId: 'ta-2'
    });
    expect(harness.session.getSnapshot().pendingMessageAttachments).toHaveLength(1);
    expect(harness.markDirty.mock.calls).toEqual([
      ['widget config created'],
      ['widget commit accepted']
    ]);
    expect(harness.postSessionState).toHaveBeenCalledTimes(1);
    expect(onAccepted).toHaveBeenCalledWith(expect.objectContaining({
      widgetConfigId: 'wc-1',
      turnId: expect.any(String)
    }));
  });

  it('publishes linkage and acknowledgement only when the room accepts', async () => {
    let acceptRoom!: () => void;
    let settleSend!: () => void;
    const sendRoomMessage = jest.fn((
      _text,
      _displayText,
      options
    ) => new Promise<{ committed: boolean }>((resolve) => {
      acceptRoom = () => options.onRoomAccepted('turn-deferred');
      settleSend = () => resolve({ committed: true });
    })) as jest.MockedFunction<WorkshopOneShotWidgetRoomSend>;
    const harness = build(sendRoomMessage);
    const onAccepted = jest.fn();

    const pending = harness.coordinator.commit(prepared(), { kind: 'host' }, onAccepted);
    await Promise.resolve();

    expect(harness.session.getWidgetConfig('wc-1')).toBeDefined();
    expect(harness.session.getWidgetConfig('wc-1')?.committedTurnId).toBeUndefined();
    expect(harness.session.getWidgetConfig('wc-1')?.artifactId).toBeUndefined();
    expect(harness.markDirty).toHaveBeenCalledTimes(1);
    expect(harness.postSessionState).not.toHaveBeenCalled();
    expect(onAccepted).not.toHaveBeenCalled();
    expect(harness.session.collectWriterSources({ kind: 'host' })).toEqual([]);

    acceptRoom();
    expect(harness.session.getWidgetConfig('wc-1')).toMatchObject({
      committedTurnId: 'turn-deferred',
      artifactId: 'ta-1'
    });
    expect(harness.postSessionState).toHaveBeenCalledTimes(1);
    expect(onAccepted).toHaveBeenCalledWith({
      widgetConfigId: 'wc-1',
      turnId: 'turn-deferred'
    });
    expect(harness.session.collectWriterSources({ kind: 'host' })).toEqual([
      expect.objectContaining({
        kind: 'message-attachment',
        origin: 'writer',
        artifactId: 'ta-1',
        label: 'Gesture Playground'
      })
    ]);

    settleSend();
    await expect(pending).resolves.toEqual({
      status: 'accepted',
      widgetConfigId: 'wc-1',
      turnId: 'turn-deferred'
    });
  });

  it('keeps the durable config as a retry token when the room does not accept', async () => {
    const sendRoomMessage = jest.fn().mockResolvedValue({ committed: false });
    const harness = build(sendRoomMessage);

    const outcome = await harness.coordinator.commit(
      prepared(),
      { kind: 'host' },
      jest.fn()
    );

    expect(outcome).toEqual({ status: 'not-accepted', widgetConfigId: 'wc-1' });
    expect(harness.session.getWidgetConfig('wc-1')).toBeDefined();
    expect(harness.session.getWidgetConfig('wc-1')?.committedTurnId).toBeUndefined();
    expect(harness.session.getWidgetConfig('wc-1')?.artifactId).toBeUndefined();
  });

  it('keeps the durable config when the room send throws before acceptance', async () => {
    const harness = build(jest.fn().mockRejectedValue(new Error('network down')));

    const outcome = await harness.coordinator.commit(
      prepared(),
      { kind: 'host' },
      jest.fn()
    );

    expect(outcome).toEqual({ status: 'failed', widgetConfigId: 'wc-1' });
    expect(harness.session.getWidgetConfig('wc-1')).toBeDefined();
  });

  it('keeps an accepted commit when the participant response later fails', async () => {
    let harness!: ReturnType<typeof build>;
    const sendRoomMessage = jest.fn().mockImplementation(async (
      _text,
      _displayText,
      options
    ) => {
      options.onRoomAccepted('turn-accepted');
      return { committed: false };
    });
    harness = build(sendRoomMessage);

    const outcome = await harness.coordinator.commit(
      prepared(),
      { kind: 'host' },
      jest.fn()
    );

    expect(outcome).toEqual({
      status: 'accepted',
      widgetConfigId: 'wc-1',
      turnId: 'turn-accepted'
    });
    expect(harness.session.getWidgetConfig('wc-1')).toMatchObject({
      committedTurnId: 'turn-accepted',
      artifactId: 'ta-1'
    });
  });

  it('records artifact delivery for the exact persona guest target', async () => {
    const harness = build();

    await harness.coordinator.commit(
      prepared(),
      { kind: 'personaGuest', personaId: 'margot' },
      jest.fn()
    );

    expect(harness.session.collectWriterSources({ kind: 'host' })).toEqual([]);
    expect(harness.session.collectWriterSources({
      kind: 'personaGuest',
      personaId: 'margot'
    })).toEqual([
      expect.objectContaining({
        kind: 'message-attachment',
        origin: 'writer',
        artifactId: 'ta-1',
        label: 'Gesture Playground'
      })
    ]);
  });

  it('keeps authority over artifact identity keys supplied by a feature plan', async () => {
    const harness = build();
    const artifact = {
      ...prepared().artifact,
      id: 'ta-forged',
      widgetId: 'creative-variations',
      widgetConfigId: 'wc-forged'
    } as never;

    await harness.coordinator.commit(
      prepared({ artifact }),
      { kind: 'host' },
      jest.fn()
    );

    expect(harness.sendRoomMessage).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        widgetArtifact: expect.objectContaining({
          id: 'ta-1',
          widgetId: 'gesture-playground',
          widgetConfigId: 'wc-1'
        })
      })
    );
  });
});
