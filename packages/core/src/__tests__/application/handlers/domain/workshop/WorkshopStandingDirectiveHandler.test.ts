import {
  WorkshopStandingDirectiveHandler
} from '@handlers/domain/workshop/WorkshopStandingDirectiveHandler';
import {
  builtInLexicalGravityLens
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  MessageType,
  WorkshopApplyStandingWidgetMessage,
  WorkshopRemoveStandingWidgetMessage
} from '@messages';

const lexicalDraft = {
  lensSlug: 'photography',
  weight: 60,
  reach: 2 as const,
  metaphorPull: false,
  resolvedLens: builtInLexicalGravityLens('photography')!
};

const applyMessage = (requestToken = 'apply-1'): WorkshopApplyStandingWidgetMessage => ({
  type: MessageType.WORKSHOP_APPLY_STANDING_WIDGET,
  source: 'webview.test',
  timestamp: 1,
  payload: {
    requestToken,
    widgetId: 'lexical-gravity',
    draft: lexicalDraft
  }
});

const removeMessage = (requestToken = 'remove-1'): WorkshopRemoveStandingWidgetMessage => ({
  type: MessageType.WORKSHOP_REMOVE_STANDING_WIDGET,
  source: 'webview.test',
  timestamp: 2,
  payload: { requestToken, family: 'lexical-gravity' }
});

describe('WorkshopStandingDirectiveHandler', () => {
  it('owns apply and remove lifecycle responses with exact request correlation', async () => {
    const config = {
      id: 'wc-1',
      widgetId: 'lexical-gravity' as const,
      revision: 1,
      directiveId: 'pd-1',
      createdAt: 1,
      draft: lexicalDraft
    };
    const directive = {
      id: 'pd-1',
      family: 'lexical-gravity' as const,
      widgetId: 'lexical-gravity' as const,
      widgetConfigId: 'wc-1',
      revision: 1,
      updatedAt: 1
    };
    const directives = {
      apply: jest.fn().mockResolvedValue({
        action: 'installed',
        directiveId: 'pd-1',
        directive,
        config,
        turn: { id: 'turn-1' }
      }),
      remove: jest.fn().mockResolvedValue({
        removed: true,
        directiveId: 'pd-1',
        turn: { id: 'turn-2' }
      })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const options = {
      postSessionState: jest.fn(),
      postTurn: jest.fn(),
      markDirty: jest.fn()
    };
    const handler = new WorkshopStandingDirectiveHandler(
      directives as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      options
    );

    await handler.handleApply(applyMessage());
    await handler.handleRemove(removeMessage());

    expect(directives.apply).toHaveBeenCalledWith(expect.objectContaining({
      family: 'lexical-gravity',
      widgetId: 'lexical-gravity',
      widgetConfigInput: expect.objectContaining({ widgetId: 'lexical-gravity' })
    }));
    expect(directives.remove).toHaveBeenCalledWith('lexical-gravity');
    expect(postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      payload: expect.objectContaining({
        action: 'apply-standing',
        requestToken: 'apply-1',
        widgetId: 'lexical-gravity',
        ok: true
      })
    }));
    expect(postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      type: MessageType.WORKSHOP_WIDGET_ACTION_RESULT,
      payload: expect.objectContaining({
        action: 'remove-standing',
        requestToken: 'remove-1',
        widgetId: 'lexical-gravity',
        removed: true
      })
    }));
    expect(options.postTurn).toHaveBeenCalledTimes(2);
    expect(options.markDirty).toHaveBeenCalledTimes(2);
  });

  it('echoes the blocked request token and widget identity', async () => {
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const registerMutation = jest.fn();
    const appendLine = jest.fn();
    const handler = new WorkshopStandingDirectiveHandler(
      {} as never,
      postMessage,
      { appendLine } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() }
    );

    handler.registerRoutes({} as never, registerMutation);
    const applyBlocked = registerMutation.mock.calls[0][3];
    const removeBlocked = registerMutation.mock.calls[1][3];
    applyBlocked('The room is busy.', applyMessage('apply-blocked'));
    removeBlocked('The room is busy.', removeMessage('remove-blocked'));
    await Promise.resolve();

    expect(postMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({
      payload: expect.objectContaining({
        action: 'apply-standing',
        requestToken: 'apply-blocked',
        widgetId: 'lexical-gravity',
        ok: false
      })
    }));
    expect(postMessage).toHaveBeenNthCalledWith(2, expect.objectContaining({
      payload: expect.objectContaining({
        action: 'remove-standing',
        requestToken: 'remove-blocked',
        widgetId: 'lexical-gravity',
        ok: false
      })
    }));
    expect(appendLine).toHaveBeenCalledWith(
      '[WorkshopStandingDirectiveHandler] apply-standing blocked: The room is busy.'
    );
    expect(appendLine).toHaveBeenCalledWith(
      '[WorkshopStandingDirectiveHandler] remove-standing blocked: The room is busy.'
    );
  });

  it('catches a remove registry miss and still posts the correlated failure ack', async () => {
    const directives = { remove: jest.fn() };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const operations = {
      widgetIdForFamily: jest.fn(() => {
        throw new Error('registry entry missing');
      })
    };
    const handler = new WorkshopStandingDirectiveHandler(
      directives as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      { postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: jest.fn() },
      operations as never
    );

    await handler.handleRemove(removeMessage('remove-registry-miss'));

    expect(directives.remove).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        action: 'remove-standing',
        requestToken: 'remove-registry-miss',
        widgetId: 'lexical-gravity',
        ok: false,
        message: 'registry entry missing'
      })
    }));
  });

  it('rejects a cross-widget apply result after resynchronizing committed state', async () => {
    const directives = {
      apply: jest.fn().mockResolvedValue({
        action: 'installed',
        directiveId: 'pd-1',
        directive: {
          id: 'pd-1',
          family: 'lexical-gravity',
          widgetId: 'lexical-gravity',
          widgetConfigId: 'wc-1',
          revision: 1,
          updatedAt: 1
        },
        config: {
          id: 'wc-1',
          widgetId: 'gesture-playground',
          revision: 1,
          createdAt: 1,
          draft: {}
        },
        turn: { id: 'turn-1' }
      })
    };
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const options = {
      postSessionState: jest.fn(),
      postTurn: jest.fn(),
      markDirty: jest.fn()
    };
    const handler = new WorkshopStandingDirectiveHandler(
      directives as never,
      postMessage,
      { appendLine: jest.fn() } as never,
      options
    );

    await handler.handleApply(applyMessage('apply-cross-widget'));

    expect(options.postTurn).toHaveBeenCalledWith({ id: 'turn-1' });
    expect(options.postSessionState).toHaveBeenCalledTimes(1);
    expect(options.markDirty).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        action: 'apply-standing',
        requestToken: 'apply-cross-widget',
        widgetId: 'lexical-gravity',
        ok: false,
        message: 'Standing directive lexical-gravity produced the wrong widget config'
      })
    }));
  });
});
