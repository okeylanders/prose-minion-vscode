import {
  normalizeContextCompression,
  OpenRouterApiError,
  OpenRouterClient,
  OpenRouterMessage
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

describe('OpenRouterClient conversation prompt caching', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      return body.stream
        ? streamingResponse({ choices: [{ delta: { content: 'Reply' }, finish_reason: 'stop' }] }, '[DONE]')
        : { ok: true, json: async () => ({ choices: [{ message: { content: 'Reply' }, finish_reason: 'stop' }] }) };
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => { global.fetch = originalFetch; });

  const send = async (
    client: OpenRouterClient,
    streaming: boolean,
    conversationId?: string,
    messages: OpenRouterMessage[] = [{ role: 'user', content: 'Hello' }]
  ) => {
    const options = {
      conversationId,
      maxTokens: 512,
      reasoning: { effort: 'low' as const },
      signal: new AbortController().signal
    };
    if (streaming) {
      for await (const _chunk of client.createStreamingChatCompletion(messages, options)) {
        // Dispatch and consume the full response.
      }
    } else {
      await client.createChatCompletion(messages, options);
    }
    return JSON.parse(fetchMock.mock.calls.at(-1)![1].body as string);
  };

  describe.each([false, true])('streaming=%s', streaming => {
    it.each([
      ['anthropic/claude-sonnet-4.6', true],
      ['anthropic/claude-opus-4.6', true],
      ['anthropic/claude-opus-4.8:nitro', true],
      ['~anthropic/claude-sonnet-latest', true],
      ['openai/gpt-5.4', false],
      ['google/gemini-2.5-pro', false],
      ['z-ai/glm-4.6', false],
      ['qwen/qwen3-max-thinking', false],
      ['meta/muse-spark-1.3', false],
      ['openrouter/auto', false]
    ])('applies only the documented conversation policy for %s', async (model, explicitCaching) => {
      const body = await send(new OpenRouterClient('key', model), streaming, 'participant-1');
      expect(body).toMatchObject({
        model,
        max_tokens: 512,
        reasoning: { effort: 'low' },
        messages: [{ role: 'user', content: 'Hello' }],
        session_id: expect.stringMatching(/^prose-minion:[a-f0-9]{64}$/)
      });
      expect(body.cache_control).toEqual(explicitCaching ? { type: 'ephemeral' } : undefined);
      expect(body).not.toHaveProperty('conversationId');
      expect(body).not.toHaveProperty('provider');
      expect(fetchMock.mock.calls.at(-1)![1].signal).toBeInstanceOf(AbortSignal);
      if (streaming) {
        expect(body).toMatchObject({ stream: true, stream_options: { include_usage: true } });
      } else {
        expect(body.usage).toEqual({ include: true });
      }
    });

    it.each(['qwen/qwen3-max', 'qwen/qwen3.8-max-0902', '~deepseek/deepseek-v3.2:nitro'])
    ('serializes %s with content-block cache hints on the system and advancing tail', async model => {
      const client = new OpenRouterClient('key', model);
      const messages: OpenRouterMessage[] = [
        { role: 'system', content: 'Stable instructions' },
        { role: 'user', content: 'Hello' }
      ];
      const frozenMessages = messages.map(message => Object.freeze({ ...message }));
      const initial = await send(client, streaming, 'participant-1', frozenMessages);
      const followUp = await send(client, streaming, 'participant-1', [
        ...frozenMessages,
        { role: 'assistant', content: 'Reply' },
        { role: 'user', content: 'Continue' }
      ]);
      expect(followUp).toMatchObject({
        model, max_tokens: 512, reasoning: { effort: 'low' }, session_id: initial.session_id
      });
      expect(followUp.messages).toEqual([
        { role: 'system', content: [{ type: 'text', text: 'Stable instructions', cache_control: { type: 'ephemeral' } }] },
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        { role: 'assistant', content: [{ type: 'text', text: 'Reply' }] },
        { role: 'user', content: [{ type: 'text', text: 'Continue', cache_control: { type: 'ephemeral' } }] }
      ]);
      expect(initial.messages[1].content[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(followUp).not.toHaveProperty('cache_control');
      expect(followUp).not.toHaveProperty('provider');
      expect(frozenMessages).toEqual(messages);

      client.setModel('anthropic/claude-opus-4.6');
      const claude = await send(client, streaming, 'participant-1', frozenMessages);
      expect(claude.messages).toEqual(messages);
      expect(claude.cache_control).toEqual({ type: 'ephemeral' });
      expect(claude.session_id).toBe(initial.session_id);
      client.setModel('google/gemini-3.8-flash');
      const gemini = await send(client, streaming, 'participant-1', frozenMessages);
      expect(gemini.messages).toEqual(messages);
      expect(gemini).not.toHaveProperty('cache_control');
    });

    it.each(['anthropic/claude-opus-4.6', 'qwen/qwen3-max'])
    ('leaves discarded one-off %s requests without cache-write opt-in or session affinity', async model => {
      const body = await send(new OpenRouterClient('key', model), streaming);
      expect(body).not.toHaveProperty('cache_control');
      expect(body).not.toHaveProperty('session_id');
      expect(body.messages).toEqual([{ role: 'user', content: 'Hello' }]);
    });

    it('keeps affinity on continuation, isolates participants, and recalculates hints after a model swap', async () => {
      const client = new OpenRouterClient('key', 'anthropic/claude-opus-4.6');
      const messages: OpenRouterMessage[] = [
        { role: 'system', content: 'Stable instructions' },
        { role: 'user', content: 'Opening request' }
      ];
      const frozenMessages = messages.map(message => Object.freeze({ ...message }));
      const first = await send(client, streaming, 'participant-1', frozenMessages);
      const second = await send(client, streaming, 'participant-1', [
        ...frozenMessages,
        { role: 'assistant', content: 'Reply' },
        { role: 'user', content: 'Follow-up' }
      ]);
      expect(second.session_id).toBe(first.session_id);
      expect(second.messages.slice(0, first.messages.length)).toEqual(first.messages);
      expect(frozenMessages).toEqual(messages);
      expect(await send(client, streaming, 'participant-2')).not.toMatchObject({ session_id: first.session_id });

      client.setModel('openai/gpt-5.4');
      const openai = await send(client, streaming, 'participant-1');
      expect(openai.session_id).toBe(first.session_id);
      expect(openai).not.toHaveProperty('cache_control');
      client.setModel('anthropic/claude-sonnet-4.6');
      expect(await send(client, streaming, 'participant-1')).toMatchObject({
        session_id: first.session_id, cache_control: { type: 'ephemeral' }
      });
    });

    it('bounds opaque routing keys even when runtime conversation ids contain long tool names', async () => {
      const body = await send(new OpenRouterClient('key', 'anthropic/claude-sonnet-4.6'), streaming, 'tool-name'.repeat(100));
      expect(body.session_id.length).toBeLessThanOrEqual(256);
      expect(body.session_id).not.toContain('tool-name');
    });
  });
});

describe('OpenRouterClient model hot-swap', () => {
  it('preserves structured insufficient-credit failures', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: jest.fn(() => null) },
      text: jest.fn().mockResolvedValue(JSON.stringify({
        error: {
          code: 402,
          message: 'Insufficient credits',
          metadata: { error_type: 'payment_required' }
        }
      }))
    }) as unknown as typeof fetch;

    try {
      await expect(new OpenRouterClient('key').createChatCompletion([
        { role: 'user', content: 'Hello' }
      ])).rejects.toEqual(expect.objectContaining<Partial<OpenRouterApiError>>({
        status: 402,
        errorType: 'payment_required'
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('surfaces a typed mid-stream provider error instead of treating it as empty prose', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(streamingResponse({
      error: {
        code: 429,
        message: 'Rate limit exceeded',
        metadata: { error_type: 'rate_limit_exceeded' }
      },
      choices: [{ delta: { content: '' }, finish_reason: 'error' }]
    })) as unknown as typeof fetch;

    try {
      const consume = async () => {
        for await (const _chunk of new OpenRouterClient('key').createStreamingChatCompletion([
          { role: 'user', content: 'Hello' }
        ])) {
          // Consume the stream so the terminal error is observed.
        }
      };
      await expect(consume()).rejects.toEqual(expect.objectContaining<Partial<OpenRouterApiError>>({
        status: 429,
        errorType: 'rate_limit_exceeded'
      }));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('bounds and labels unstructured provider error bodies at the network boundary', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      headers: { get: jest.fn(() => null) },
      text: jest.fn().mockResolvedValue(`<html>${'gateway failure '.repeat(200)}</html>`)
    }) as unknown as typeof fetch;

    try {
      const promise = new OpenRouterClient('key').createChatCompletion([
        { role: 'user', content: 'Hello' }
      ]);
      await expect(promise).rejects.toEqual(
        expect.objectContaining<Partial<OpenRouterApiError>>({ status: 502 })
      );
      await promise.catch((error: OpenRouterApiError) => {
        expect(error.message).toContain('Unstructured provider response:');
        expect(error.message).toContain('…');
        expect(error.message.length).toBeLessThan(1_100);
        expect(error.message).not.toContain('\n');
      });
    } finally {
      global.fetch = originalFetch;
    }
  });

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
        usage: {
          prompt_tokens: 38, completion_tokens: 4, total_tokens: 42, cost: 0.002,
          prompt_tokens_details: { cached_tokens: 24, cache_write_tokens: 0 }
        },
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
      expect(result.usage).toMatchObject({ cachedTokens: 24, cacheWriteTokens: 0 });
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('normalizes provider-null assistant content at the API boundary', async () => {
    const originalFetch = global.fetch;
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'response-1',
        choices: [{ message: { role: 'assistant', content: null }, finish_reason: 'stop' }]
      })
    }) as unknown as typeof fetch;

    try {
      const result = await new OpenRouterClient('key', 'model/requested', output)
        .createChatCompletion([{ role: 'user', content: 'Hello' }]);
      expect(result.content).toBe('');
      expect(output.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Provider returned null assistant content')
      );
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

  it('sends an explicitly bounded reasoning effort unchanged', async () => {
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
        { reasoning: { effort: 'low' } }
      );
      expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).reasoning).toEqual({
        effort: 'low'
      });
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

  it('drops malformed citation URLs with a diagnostic while retaining valid sources', async () => {
    const originalFetch = global.fetch;
    const output = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        id: 'response-1',
        choices: [{
          message: {
            role: 'assistant', content: 'Grounded answer.',
            annotations: [
              { type: 'url_citation', url_citation: { url: 'https://', title: 'Broken' } },
              { type: 'url_citation', url_citation: { url: 'file:///private/draft', title: 'Unsafe' } },
              { type: 'url_citation', url_citation: { url: 'https://www.anthropic.com/news/example', title: 'Primary source' } }
            ]
          },
          finish_reason: 'stop'
        }]
      })
    }) as unknown as typeof fetch;
    try {
      const result = await new OpenRouterClient('key', undefined, output).createChatCompletion(
        [{ role: 'user', content: 'Hello' }]
      );
      expect(result.citations).toEqual([
        { url: 'https://www.anthropic.com/news/example', title: 'Primary source', startIndex: undefined, endIndex: undefined }
      ]);
      expect(output.appendLine).toHaveBeenCalledWith(
        expect.stringContaining('Dropped 2/3 unparseable citation annotation(s)')
      );
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('emits streaming terminal usage and metadata exactly once when they arrive after finish reason', async () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn().mockResolvedValue(streamingResponse(
      { id: 'gen-stream-123', model: 'model/resolved', choices: [{ delta: { content: 'Hi' }, finish_reason: null }] },
      { model: 'model/resolved', choices: [{ delta: {}, finish_reason: 'stop' }] },
      {
        choices: [],
        usage: {
          prompt_tokens: 12, completion_tokens: 2, total_tokens: 14,
          prompt_tokens_details: { cached_tokens: 0, cache_write_tokens: 12 }
        },
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
        id: 'gen-stream-123',
        finishReason: 'stop',
        usage: { promptTokens: 12, completionTokens: 2, totalTokens: 14, cachedTokens: 0, cacheWriteTokens: 12 },
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

  it('backfills a duplicate citation title from a later streaming annotation', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue(streamingResponse(
      { choices: [{ delta: { annotations: [{ type: 'url_citation', url_citation: { url: 'https://one.example' } }] } }] },
      { choices: [{ delta: { annotations: [{ type: 'url_citation', url_citation: { url: 'https://one.example', title: 'One' } }] }, finish_reason: 'stop' }] },
      '[DONE]'
    )) as unknown as typeof fetch;
    try {
      const chunks = [];
      for await (const chunk of new OpenRouterClient('key').createStreamingChatCompletion([{ role: 'user', content: 'Hello' }])) {
        chunks.push(chunk);
      }
      expect(chunks.at(-1)).toMatchObject({
        citations: [{ url: 'https://one.example', title: 'One' }]
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
