import { MessageType } from '@messages';
import { createCancelRequestMessage } from '@shared/streamingCancelMessages';

describe('createCancelRequestMessage', () => {
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(123456);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['analysis', MessageType.CANCEL_ANALYSIS_REQUEST],
    ['dictionary', MessageType.CANCEL_DICTIONARY_REQUEST],
    ['context', MessageType.CANCEL_CONTEXT_REQUEST],
    ['search', MessageType.CANCEL_CATEGORY_SEARCH_REQUEST],
    ['workshop', MessageType.CANCEL_WORKSHOP_REQUEST]
  ] as const)('builds a %s cancel message', (domain, type) => {
    expect(createCancelRequestMessage(domain, 'request-1', 'webview.test')).toEqual({
      type,
      source: 'webview.test',
      payload: {
        requestId: 'request-1',
        domain
      },
      timestamp: 123456
    });
  });
});
