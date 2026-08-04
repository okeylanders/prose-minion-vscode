import {
  WorkshopWidgetHostHandler
} from '@handlers/domain/workshop/widgets/WorkshopWidgetHostHandler';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { MessageType, WorkshopGestureDraft } from '@messages';

const draft: WorkshopGestureDraft = {
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
  it('fetches the full authoring config only through the on-demand route', async () => {
    let clock = 0;
    const session = new WorkshopSessionService(() => ++clock);
    session.createWidgetConfig({ widgetId: 'gesture-playground', draft });
    const postMessage = jest.fn().mockResolvedValue(undefined);
    const handler = new WorkshopWidgetHostHandler(
      session,
      postMessage,
      { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() }
    );

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
  });
});
