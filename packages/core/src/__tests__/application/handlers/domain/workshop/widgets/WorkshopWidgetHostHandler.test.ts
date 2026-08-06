import {
  WorkshopWidgetHostHandler
} from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageType, WorkshopGesturePlaygroundDraft } from '@messages';

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

describe('WorkshopWidgetHostHandler', () => {
  const createHandler = () => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const appendLine = jest.fn();
    const handler = new WorkshopWidgetHostHandler(
      session,
      postMessage,
      { appendLine, show: jest.fn(), clear: jest.fn() }
    );
    return { session, postMessage, appendLine, handler };
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
});
