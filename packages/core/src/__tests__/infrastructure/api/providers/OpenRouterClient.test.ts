import {
  normalizeContextCompression,
  OpenRouterClient
} from '@providers/OpenRouterClient';

const streamingResponse = (...events: unknown[]): Response => {
  const encoded = events.map(event => new TextEncoder().encode(
    event === '[DONE]' ? 'data: [DONE]\n\n' : `data: ${JSON.stringify(event)}\n\n`
  ));
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: jest.fn(async () => index < encoded.length
          ? { done: false, value: encoded[index++] }
          : { done: true, value: undefined }),
        releaseLock: jest.fn()
      }),
      cancel: jest.fn().mockResolvedValue(undefined)
    }
  } as unknown as Response;
};

describe('OpenRouter context-compression metadata', () => {
  it.each([
    ['missing metadata', undefined, 'unknown'],
    ['unrelated pipeline stage', { pipeline: [{ type: 'guardrail' }] }, 'not-applied'],
    ['material compression stage', { pipeline: [{ type: 'context_compression' }] }, 'applied'],
    ['metadata without a readable pipeline', {}, 'unknown'],
    ['unparseable pipeline', { pipeline: 'changed' }, 'unknown']
  ])('normalizes %s', (_label, metadata, expected) => {
    expect(normalizeContextCompression(metadata)).toBe(expected);
  });
});

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
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        'X-OpenRouter-Metadata': 'enabled'
      });

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

  it('returns one normalized non-streaming request observation', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'response-1',
        model: 'model/resolved',
        choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 38, completion_tokens: 4, total_tokens: 42, cost: 0.002 },
        openrouter_metadata: { pipeline: [{ type: 'context_compression', name: 'context-compression' }] }
      })
    }) as unknown as typeof fetch;

    try {
      const result = await new OpenRouterClient('key', 'model/requested').createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 9000 }
      );
      expect(result.observation).toMatchObject({
        modelId: 'model/resolved',
        promptTokens: 38,
        totalTokens: 42,
        requestedMaxOutputTokens: 9000,
        finishReason: 'stop',
        contextCompression: 'applied'
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('sends an explicitly enabled web-search server tool unchanged', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'response-1', choices: [{ message: { role: 'assistant', content: 'Hi' }, finish_reason: 'stop' }]
      })
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      await new OpenRouterClient('key', 'model/requested').createChatCompletion(
        [{ role: 'user', content: 'Hello' }],
        { tools: [{ type: 'openrouter:web_search', parameters: { engine: 'auto', max_uses: 2, max_total_results: 10 } }] }
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).tools).toEqual([
        { type: 'openrouter:web_search', parameters: { engine: 'auto', max_uses: 2, max_total_results: 10 } }
      ]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('preserves structured web citations outside the model-authored response text', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'response-1',
        choices: [{
          message: {
            role: 'assistant', content: 'Grounded answer [1]',
            annotations: [{ type: 'url_citation', url_citation: {
              url: 'https://www.anthropic.com/news/example', title: 'Primary source', start_index: 16, end_index: 19
            } }]
          },
          finish_reason: 'stop'
        }]
      })
    }) as unknown as typeof fetch;
    try {
      const result = await new OpenRouterClient('key').createChatCompletion([{ role: 'user', content: 'Hello' }]);
      expect(result).toMatchObject({
        content: 'Grounded answer [1]',
        citations: [{ url: 'https://www.anthropic.com/news/example', title: 'Primary source', startIndex: 16, endIndex: 19 }]
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('emits streaming terminal usage and metadata exactly once when they arrive after finish reason', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(streamingResponse(
      { model: 'model/resolved', choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
      { model: 'model/resolved', choices: [{ delta: {}, finish_reason: 'stop' }] },
      {
        choices: [],
        usage: { prompt_tokens: 12, completion_tokens: 2, total_tokens: 14 },
        openrouter_metadata: { pipeline: [{ type: 'guardrail' }] }
      },
      '[DONE]'
    ));
    global.fetch = fetchMock as unknown as typeof fetch;

    try {
      const chunks = [];
      for await (const chunk of new OpenRouterClient('key', 'model/requested')
        .createStreamingChatCompletion([{ role: 'user', content: 'Hello' }], { maxTokens: 5000 })) {
        chunks.push(chunk);
      }
      expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
        'X-OpenRouter-Metadata': 'enabled'
      });
      expect(chunks.filter(chunk => chunk.done)).toHaveLength(1);
      expect(chunks.at(-1)).toMatchObject({
        done: true,
        finishReason: 'stop',
        usage: { promptTokens: 12, completionTokens: 2, totalTokens: 14 },
        observation: {
          modelId: 'model/resolved',
          promptTokens: 12,
          requestedMaxOutputTokens: 5000,
          contextCompression: 'not-applied'
        }
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('accumulates citations reported across streaming frames', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(streamingResponse(
      { choices: [{ delta: { annotations: [{ type: 'url_citation', url_citation: { url: 'https://one.example', title: 'One' } }] } }] },
      { choices: [{ delta: { annotations: [{ type: 'url_citation', url_citation: { url: 'https://two.example', title: 'Two' } }] }, finish_reason: 'stop' }] },
      '[DONE]'
    )) as unknown as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of new OpenRouterClient('key').createStreamingChatCompletion([{ role: 'user', content: 'Hello' }])) {
        chunks.push(chunk);
      }
      expect(chunks.at(-1)).toMatchObject({
        citations: [
          { url: 'https://one.example', title: 'One' },
          { url: 'https://two.example', title: 'Two' }
        ]
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
