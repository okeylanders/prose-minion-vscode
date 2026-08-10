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
  WorkshopGesturePlaygroundDraft
} from '@messages';

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
  overrides: Partial<WorkshopCommitWidgetMessage['payload']> = {}
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

describe('WorkshopWidgetHostHandler', () => {
  const createHandler = (options: {
    available?: boolean;
    roomRunActive?: boolean;
    commitOutcome?:
      | { status: 'accepted'; widgetConfigId: string; turnId: string }
      | { status: 'not-accepted'; widgetConfigId: string }
      | { status: 'failed'; widgetConfigId?: string };
  } = {}) => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const appendLine = jest.fn();
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
        options.available === false ? [] : ['gesture-playground']
      ),
      postMessage,
      { appendLine, show: jest.fn(), clear: jest.fn() },
      { isRoomRunActive: () => options.roomRunActive ?? false }
    );
    return { session, postMessage, appendLine, commit, handler };
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

  it('rejects unavailable and invalid commits before entering the transaction', async () => {
    const unavailable = createHandler({ available: false });
    await unavailable.handler.handleCommit(commitMessage());
    expect(unavailable.commit).not.toHaveBeenCalled();

    const invalid = createHandler();
    await invalid.handler.handleCommit(commitMessage({
      draft: { ...draft, selections: [] }
    }));
    expect(invalid.commit).not.toHaveBeenCalled();
    expect(invalid.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ ok: false, message: expect.any(String) })
    }));
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

    const activeRoom = createHandler({ roomRunActive: true });
    await activeRoom.handler.handleCommit(commitMessage());
    expect(activeRoom.commit).not.toHaveBeenCalled();
    expect(activeRoom.postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ message: expect.stringMatching(/current Workshop response/i) })
    }));
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
});
