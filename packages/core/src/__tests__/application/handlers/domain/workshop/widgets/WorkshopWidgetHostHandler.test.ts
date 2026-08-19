import {
  WorkshopWidgetHostHandler
} from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  fixedWorkshopWidgetAvailabilityPolicy
} from '@/application/services/workshop/widgets/WorkshopWidgetAvailabilityPolicy';
import {
  MessageType,
  WorkshopCommitWidgetMessage,
  WorkshopCreativeVariationsDraft,
  WorkshopGesturePlaygroundDraft,
  WorkshopWidgetId
} from '@messages';
import {
  generatedDraft
} from '@/__tests__/presentation/webview/components/workshop/widgets/creativeVariations/creativeVariationsFixtures';
import {
  buildCreativeVariationsArtifact
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsArtifact';
import {
  computeCreativeVariationsTextualOverlap
} from '@/application/services/workshop/widgets/creativeVariations/CreativeVariationsDistinctness';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const draft: WorkshopGesturePlaygroundDraft = {
  targetPhrase: 'she smiled',
  writerInstructions: '',
  contextText: '',
  characterNotes: '',
  sourceReferences: [],
  dictionaryMarkdown: '# Gesture Dictionary',
  menu: [
    { heading: 'One', options: ['one', 'two', 'three'] },
    { heading: 'Two', options: ['four', 'five', 'six'] },
    { heading: 'Three', options: ['seven', 'eight', 'nine'] },
    { heading: 'Four', options: ['ten', 'eleven', 'twelve'] }
  ],
  selections: ['one'],
  note: '',
  includeDictionaryInCommit: false
};

const commitMessage = (
  overrides: Partial<Extract<
    WorkshopCommitWidgetMessage['payload'],
    { widgetId: 'gesture-playground' }
  >> = {}
): WorkshopCommitWidgetMessage => ({
  type: MessageType.WORKSHOP_COMMIT_WIDGET,
  source: 'webview.workshop',
  timestamp: 1,
  payload: {
    widgetId: 'gesture-playground',
    requestToken: 'commit-1',
    draft,
    ...overrides
  }
});

const creativeDraft: WorkshopCreativeVariationsDraft = {
  ...JSON.parse(JSON.stringify(generatedDraft)) as WorkshopCreativeVariationsDraft,
  intent: { ...generatedDraft.intent, aim: '' },
  selections: [{ position: 1, carryMode: 'direction' }]
};

const creativeCommitMessage = (
  overrides: Partial<Extract<
    WorkshopCommitWidgetMessage['payload'],
    { widgetId: 'creative-variations' }
  >> = {}
): WorkshopCommitWidgetMessage => ({
  type: MessageType.WORKSHOP_COMMIT_WIDGET,
  source: 'webview.workshop.creative-variations',
  timestamp: 1,
  payload: {
    widgetId: 'creative-variations',
    requestToken: 'creative-commit-1',
    draft: creativeDraft,
    ...overrides
  }
});

const creativeDraftAtArtifactLength = (characters: number): WorkshopCreativeVariationsDraft => {
  const draft: WorkshopCreativeVariationsDraft = {
    ...JSON.parse(JSON.stringify(creativeDraft)) as WorkshopCreativeVariationsDraft,
    selections: [{ position: 1, carryMode: 'full-prose' }]
  };
  const cardsAtOne = draft.workup!.cards.map((card) => card.position === 1
    ? { ...card, prose: 'x' }
    : card);
  const oneCharacterDraft = {
    ...draft,
    workup: {
      ...draft.workup!,
      cards: cardsAtOne,
      overlap: computeCreativeVariationsTextualOverlap(draft.subject.text, cardsAtOne)
    }
  };
  const fixedCharacters = buildCreativeVariationsArtifact(oneCharacterDraft).length - 1;
  const cards = draft.workup!.cards.map((card) => card.position === 1
    ? { ...card, prose: 'x'.repeat(characters - fixedCharacters) }
    : card);
  return {
    ...draft,
    workup: {
      ...draft.workup!,
      cards,
      overlap: computeCreativeVariationsTextualOverlap(draft.subject.text, cards)
    }
  };
};

describe('WorkshopWidgetHostHandler', () => {
  const createHandler = (options: {
    available?: boolean;
    availableWidgetIds?: readonly WorkshopWidgetId[];
    roomRunActive?: boolean;
    generationActive?: boolean;
    commitOutcome?:
      | { status: 'accepted'; widgetConfigId: string; turnId: string }
      | { status: 'not-accepted'; widgetConfigId: string; reason?: string }
      | { status: 'failed'; widgetConfigId?: string; reason?: string };
    generationActivity?: jest.Mock;
  } = {}) => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const appendLine = jest.fn();
    const generationActivity = options.generationActivity
      ?? jest.fn(() => options.generationActive ?? false);
    const commit = jest.fn().mockImplementation(async (
      _prepared,
      _target,
      onAccepted
    ) => {
      const outcome = options.commitOutcome
        ?? { status: 'accepted', widgetConfigId: 'wc-1', turnId: 'turn-1' };
      if (outcome.status === 'accepted') {
        onAccepted({ widgetConfigId: outcome.widgetConfigId, turnId: outcome.turnId });
      }
      return outcome;
    });
    const handler = new WorkshopWidgetHostHandler(
      session,
      { commit } as never,
      fixedWorkshopWidgetAvailabilityPolicy(
        options.availableWidgetIds
          ?? (options.available === false ? [] : ['gesture-playground'])
      ),
      postMessage,
      { appendLine, show: jest.fn(), clear: jest.fn() },
      {
        isRoomRunActive: () => options.roomRunActive ?? false,
        isWidgetGenerationActive: generationActivity
      }
    );
    return { session, postMessage, appendLine, commit, generationActivity, handler };
  };

  it('fetches the full authoring config only through the on-demand route', async () => {
    const { session, postMessage, appendLine, handler } = createHandler();
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft });

    await handler.handleRequestConfig({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      source: 'webview.workshop',
      timestamp: 1,
      payload: { configId: 'wc-1' }
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      payload: expect.objectContaining({
        configId: 'wc-1',
        config: expect.objectContaining({
          id: 'wc-1',
          draft: expect.objectContaining({ dictionaryMarkdown: expect.any(String) })
        })
      })
    }));
    expect(appendLine).not.toHaveBeenCalled();
  });

  it('rejects malformed config ids without echoing the untrusted value to logs', async () => {
    const { postMessage, appendLine, handler } = createHandler();

    await handler.handleRequestConfig({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      source: 'webview.workshop',
      timestamp: 1,
      payload: { configId: 'not-a-widget-config' }
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      payload: {
        configId: 'not-a-widget-config',
        error: 'That widget configuration is no longer available.'
      }
    }));
    expect(appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Rejected an invalid widget config id'
    );
  });

  it('reports a valid config id that is no longer present in the session', async () => {
    const { postMessage, appendLine, handler } = createHandler();

    await handler.handleRequestConfig({
      type: MessageType.WORKSHOP_REQUEST_WIDGET_CONFIG,
      source: 'webview.workshop',
      timestamp: 1,
      payload: { configId: 'wc-99' }
    });

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_CONFIG_DATA,
      payload: {
        configId: 'wc-99',
        error: 'That widget configuration is no longer available.'
      }
    }));
    expect(appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Widget config wc-99 is unavailable'
    );
  });

  it('owns one-shot dispatch and acknowledges acceptance under the request token', async () => {
    const { handler, commit, postMessage } = createHandler();

    await handler.handleCommit(commitMessage());

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetId: 'gesture-playground',
        artifact: expect.objectContaining({
          content: expect.stringContaining('Gesture directions I want')
        })
      }),
      { kind: 'host' },
      expect.any(Function)
    );
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      payload: {
        action: 'commit',
        requestToken: 'commit-1',
        widgetId: 'gesture-playground',
        ok: true,
        widgetConfigId: 'wc-1',
        turnId: 'turn-1'
      }
    }));
  });

  it('dispatches the exact Creative arm with compact artifact and clone identity', async () => {
    const { handler, commit, postMessage } = createHandler({
      availableWidgetIds: ['creative-variations']
    });

    await handler.handleCommit(creativeCommitMessage({ clonedFromConfigId: 'wc-7' }));

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        widgetId: 'creative-variations',
        clonedFromConfigId: 'wc-7',
        widgetConfigInput: {
          widgetId: 'creative-variations',
          draft: creativeDraft
        },
        artifact: expect.objectContaining({
          selectionCount: 1,
          content: expect.stringContaining('Take 1 — direction:')
        })
      }),
      { kind: 'host' },
      expect.any(Function)
    );
    const prepared = commit.mock.calls[0][0];
    expect(prepared.artifact.content).not.toContain(creativeDraft.subject.text);
    expect(prepared.widgetConfigInput.draft.intent.aim).toBe('');
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        action: 'commit',
        requestToken: 'creative-commit-1',
        widgetId: 'creative-variations',
        ok: true
      })
    }));
  });

  it('refuses unavailable and non-ready Creative drafts before transaction mutation', async () => {
    const unavailable = createHandler({ availableWidgetIds: [] });
    await unavailable.handler.handleCommit(creativeCommitMessage());
    expect(unavailable.commit).not.toHaveBeenCalled();
    expect(unavailable.session.getWidgetConfig('wc-1')).toBeUndefined();

    const invalid = createHandler({ availableWidgetIds: ['creative-variations'] });
    await invalid.handler.handleCommit(creativeCommitMessage({
      draft: { ...creativeDraft, selections: [] }
    }));
    expect(invalid.commit).not.toHaveBeenCalled();
    expect(invalid.session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(invalid.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        widgetId: 'creative-variations',
        ok: false,
        message: expect.stringMatching(/Select at least one take/)
      })
    }));
  });

  it('rejects a one-character-over Creative artifact before session mutation', async () => {
    const host = createHandler({ availableWidgetIds: ['creative-variations'] });
    const over = creativeDraftAtArtifactLength(
      PROMPT_BUDGETS.workshopWidgets.creativeArtifactCharacters + 1
    );
    expect(buildCreativeVariationsArtifact(over)).toHaveLength(20_001);

    await host.handler.handleCommit(creativeCommitMessage({ draft: over }));

    expect(host.commit).not.toHaveBeenCalled();
    expect(host.session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(host.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        message: 'The Creative Variations artifact exceeds 20,000 characters.'
      })
    }));
  });

  it('refuses Creative commits for a tool target or active room before transaction mutation', async () => {
    const toolTarget = createHandler({ availableWidgetIds: ['creative-variations'] });
    toolTarget.session.setExcerpt({ text: 'A pinned passage.', source: { kind: 'manual' } });
    toolTarget.session.beginToolRun('prose', 'req-sidecar');
    toolTarget.session.completeToolReport('req-sidecar', 'Report.', 'conversation-tool');
    expect(toolTarget.session.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(true);
    await toolTarget.handler.handleCommit(creativeCommitMessage());
    expect(toolTarget.commit).not.toHaveBeenCalled();
    expect(toolTarget.session.getWidgetConfig('wc-1')).toBeUndefined();

    const activeRoom = createHandler({
      availableWidgetIds: ['creative-variations'],
      roomRunActive: true
    });
    await activeRoom.handler.handleCommit(creativeCommitMessage());
    expect(activeRoom.commit).not.toHaveBeenCalled();
    expect(activeRoom.session.getWidgetConfig('wc-1')).toBeUndefined();
  });

  it('refuses Creative commit during generation or another commit before mutation', async () => {
    const generating = createHandler({
      availableWidgetIds: ['creative-variations'],
      generationActive: true
    });
    await generating.handler.handleCommit(creativeCommitMessage());
    expect(generating.commit).not.toHaveBeenCalled();
    expect(generating.session.getWidgetConfig('wc-1')).toBeUndefined();
    expect(generating.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        message: expect.stringMatching(/generation to finish/)
      })
    }));

    let settle!: () => void;
    const first = createHandler({ availableWidgetIds: ['creative-variations'] });
    first.commit.mockImplementationOnce(async () => new Promise((resolve) => {
      settle = () => resolve({ status: 'not-accepted', widgetConfigId: 'wc-1' });
    }));
    const pending = first.handler.handleCommit(creativeCommitMessage({
      requestToken: 'creative-pending'
    }));
    await Promise.resolve();
    await first.handler.handleCommit(creativeCommitMessage({
      requestToken: 'creative-duplicate'
    }));

    expect(first.commit).toHaveBeenCalledTimes(1);
    expect(first.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        requestToken: 'creative-duplicate',
        ok: false,
        message: expect.stringMatching(/commit to finish/)
      })
    }));
    settle();
    await pending;
  });

  it('rejects unavailable and invalid commits before entering the transaction', async () => {
    const unavailable = createHandler({ available: false });
    await unavailable.handler.handleCommit(commitMessage());
    expect(unavailable.commit).not.toHaveBeenCalled();
    expect(unavailable.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit refused '
      + '(reason=widget-unavailable, requestToken="commit-1")'
    );

    const invalid = createHandler();
    await invalid.handler.handleCommit(commitMessage({
      draft: { ...draft, selections: [] }
    }));
    expect(invalid.commit).not.toHaveBeenCalled();
    expect(invalid.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ ok: false, message: expect.any(String) })
    }));
    expect(invalid.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit refused '
      + '(reason=invalid-draft, requestToken="commit-1")'
    );
  });

  it('refuses an available non-one-shot widget inside the closed dispatch', async () => {
    const generationActivity = jest.fn(() => {
      throw new Error('A non-one-shot id reached the partial generation adapter.');
    });
    const unsupported = createHandler({
      availableWidgetIds: ['lexical-gravity'],
      generationActivity
    });

    await unsupported.handler.handleCommit(commitMessage({
      widgetId: 'lexical-gravity'
    } as never));

    expect(generationActivity).not.toHaveBeenCalled();
    expect(unsupported.commit).not.toHaveBeenCalled();
    expect(unsupported.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        message: 'That widget does not support one-shot commits.'
      })
    }));
    expect(unsupported.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit refused '
      + '(reason=unsupported-one-shot-widget, requestToken="commit-1")'
    );
  });

  it('turns an unexpected pre-transaction exception into one retryable action result', async () => {
    const host = createHandler({
      availableWidgetIds: ['creative-variations'],
      generationActivity: jest.fn(() => {
        throw new Error('generation gate exploded');
      })
    });

    await host.handler.handleCommit(creativeCommitMessage());

    expect(host.commit).not.toHaveBeenCalled();
    expect(host.postMessage).toHaveBeenCalledTimes(1);
    expect(host.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        action: 'commit',
        requestToken: 'creative-commit-1',
        widgetId: 'creative-variations',
        ok: false,
        message: 'The commit could not be processed. Your draft is still open — try again.'
      })
    }));
    expect(host.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit route failed before acknowledgement: '
      + 'generation gate exploded'
    );
  });

  it('awaits and logs a rejected accepted-commit acknowledgement without lying about the commit', async () => {
    const host = createHandler();
    host.postMessage.mockRejectedValueOnce(new Error('webview unavailable'));

    await host.handler.handleCommit(commitMessage());

    expect(host.commit).toHaveBeenCalledTimes(1);
    expect(host.postMessage).toHaveBeenCalledTimes(1);
    expect(host.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Failed to post widget action result: webview unavailable'
    );
    expect(host.appendLine).not.toHaveBeenCalledWith(
      expect.stringContaining('reason=route-failed')
    );
  });

  it('refuses tool-sidecar and re-entrant room targets before transaction state changes', async () => {
    const toolTarget = createHandler();
    toolTarget.session.setExcerpt({ text: 'A pinned passage.', source: { kind: 'manual' } });
    toolTarget.session.beginToolRun('prose', 'req-sidecar');
    toolTarget.session.completeToolReport('req-sidecar', 'Report.', 'conversation-tool');
    expect(toolTarget.session.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(true);
    await toolTarget.handler.handleCommit(commitMessage());
    expect(toolTarget.commit).not.toHaveBeenCalled();
    expect(toolTarget.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ message: expect.stringMatching(/persona target/) })
    }));
    expect(toolTarget.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit refused '
      + '(reason=tool-target, requestToken="commit-1")'
    );

    const activeRoom = createHandler({ roomRunActive: true });
    await activeRoom.handler.handleCommit(commitMessage());
    expect(activeRoom.commit).not.toHaveBeenCalled();
    expect(activeRoom.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ message: expect.stringMatching(/current Workshop response/i) })
    }));
    expect(activeRoom.appendLine).toHaveBeenCalledWith(
      '[WorkshopWidgetHostHandler] Commit refused '
      + '(reason=room-run-active, requestToken="commit-1")'
    );
  });

  it.each([
    [{ status: 'not-accepted', widgetConfigId: 'wc-2' } as const, /did not accept/],
    [{ status: 'failed', widgetConfigId: 'wc-3' } as const, /failed before/]
  ])('translates a %s transaction outcome into a retryable action result', async (
    commitOutcome,
    expectedMessage
  ) => {
    const { handler, postMessage } = createHandler({ commitOutcome });

    await handler.handleCommit(commitMessage());

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        ok: false,
        widgetConfigId: commitOutcome.widgetConfigId,
        message: expect.stringMatching(expectedMessage)
      })
    }));
  });

  it('shows a specific room refusal reason instead of the generic retry loop', async () => {
    const reason = 'OpenRouter is rate limiting requests. Wait a moment and try again.';
    const { handler, postMessage } = createHandler({
      commitOutcome: { status: 'not-accepted', widgetConfigId: 'wc-2', reason }
    });

    await handler.handleCommit(commitMessage());

    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ ok: false, message: reason })
    }));
  });
});
