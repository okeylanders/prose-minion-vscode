import { OpenRouterClient } from '@providers/OpenRouterClient';

describe('OpenRouterClient model hot-swap', () => {
  it('keeps the model captured when an in-flight request was dispatched', async () => {
    const originalFetch = global.fetch;
    let resolveFetch!: (response: Response) => void;
    const fetchMock = jest.fn().mockImplementation(
      async () => new Promise<Response>((resolve) => { resolveFetch = resolve; })
    );
    global.fetch = fetchMock as unknown as typeof fetch;
    const client = new OpenRouterClient('key', 'model/a');

    try {
      const request = client.createChatCompletion([{ role: 'user', content: 'Hello' }]);
      const dispatchedBody = JSON.parse(fetchMock.mock.calls[0][1].body as string);

      client.setModel('model/b');
      expect(dispatchedBody.model).toBe('model/a');

      resolveFetch({
        ok: true,
        json: jest.fn().mockResolvedValue(JSON.parse(
          '{"id":"response-1","choices":[{"message":{"role":"assistant","content":"Hi"},"finish_reason":"stop"}]}'
        ))
      } as unknown as Response);
      await request;
      expect(client.getModel()).toBe('model/b');
    } finally {
      global.fetch = originalFetch;
    }
  });
});
