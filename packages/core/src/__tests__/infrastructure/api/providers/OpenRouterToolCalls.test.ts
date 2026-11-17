/* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire names. */
import { OpenRouterClient } from '@providers/OpenRouterClient';
import {
  OPENROUTER_TOOL_CALL_LIMITS,
  OpenRouterToolCallAssembler,
  readOpenRouterToolCalls
} from '@providers/OpenRouterToolCalls';

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

const WEB_SEARCH_ANNOTATION = { type: 'url_citation', url_citation: { url: 'https://example.org/alice', title: 'Alice' } };

describe('function calls at the provider boundary', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

  it('returns a whole reply\'s tool calls beside its empty content, apart from web-search citations', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'gen-1',
        model: 'placeholder/model',
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            annotations: [WEB_SEARCH_ANNOTATION],
            tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'transcript.catalog', arguments: '{"match":"6.11"}' } }]
          },
          finish_reason: 'tool_calls'
        }]
      })
    })) as unknown as typeof fetch;

    const reply = await new OpenRouterClient('key', 'placeholder/model').createChatCompletion([]);

    expect(reply.content).toBe('');
    expect(reply.finishReason).toBe('tool_calls');
    expect(reply.toolCalls).toEqual([{ id: 'call_1', name: 'transcript.catalog', arguments: '{"match":"6.11"}' }]);
    expect(reply.citations).toEqual([expect.objectContaining({ url: 'https://example.org/alice' })]);
  });

  it('reports no tool calls for an ordinary reply', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'Reply' }, finish_reason: 'stop' }] })
    })) as unknown as typeof fetch;
    const reply = await new OpenRouterClient('key').createChatCompletion([]);
    expect(reply).not.toHaveProperty('toolCalls');
  });

  it('stitches a stream\'s fragments together per call index and yields them on the terminal chunk', async () => {
    const delta = (tool_calls: unknown, extra: Record<string, unknown> = {}) => ({ choices: [{ delta: { tool_calls, ...extra } }] });
    global.fetch = jest.fn(async () => streamingResponse(
      { model: 'placeholder/model', choices: [{ delta: { content: 'Let me look. ' } }] },
      delta([{ index: 0, id: 'call_a', type: 'function', function: { name: 'transcript.catalog', arguments: '' } }]),
      delta([{ index: 0, function: { arguments: '{"mat' } }]),
      delta([{ index: 1, id: 'call_b', type: 'function', function: { name: 'memory.catalog', arguments: '{}' } }]),
      delta([{ index: 0, function: { name: 'transcript.catalog', arguments: 'ch":"6.11"}' } }], { annotations: [WEB_SEARCH_ANNOTATION] }),
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } },
      '[DONE]'
    )) as unknown as typeof fetch;

    const chunks = [];
    for await (const chunk of new OpenRouterClient('key', 'placeholder/model').createStreamingChatCompletion([])) {
      chunks.push(chunk);
    }
    const terminal = chunks.at(-1)!;

    expect(chunks.filter((chunk) => !chunk.done).map((chunk) => chunk.token).join('')).toBe('Let me look. ');
    expect(chunks.filter((chunk) => !chunk.done).every((chunk) => !('toolCalls' in chunk))).toBe(true);
    expect(terminal.done).toBe(true);
    expect(terminal.finishReason).toBe('tool_calls');
    expect(terminal.toolCalls).toEqual([
      { id: 'call_a', name: 'transcript.catalog', arguments: '{"match":"6.11"}' },
      { id: 'call_b', name: 'memory.catalog', arguments: '{}' }
    ]);
    expect(terminal.citations).toEqual([expect.objectContaining({ url: 'https://example.org/alice' })]);
  });

  it('leaves out OpenRouter\'s own server tools and anything that is not a function call', () => {
    expect(readOpenRouterToolCalls([
      { id: 'a', type: 'function', function: { name: 'openrouter:web_search', arguments: '{}' } },
      { id: 'b', type: 'server_tool_use', function: { name: 'web_search', arguments: '{}' } },
      { id: 'c', type: 'function', function: { arguments: '{}' } },
      'not a call',
      { id: 'd', function: { name: 'resource.catalog', arguments: '' } }
    ])).toEqual([{ id: 'd', name: 'resource.catalog', arguments: '' }]);
    expect(readOpenRouterToolCalls(undefined)).toBeUndefined();
    expect(readOpenRouterToolCalls([])).toBeUndefined();
    expect(readOpenRouterToolCalls({ function: { name: 'x' } })).toBeUndefined();
  });

  it('bounds how many calls and how much argument text one reply may carry', () => {
    const assembler = new OpenRouterToolCallAssembler();
    for (let index = 0; index < OPENROUTER_TOOL_CALL_LIMITS.calls + 5; index += 1) {
      assembler.add([{ index, function: { name: `tool_${index}`, arguments: '{}' } }]);
    }
    assembler.add([{ index: 0, function: { arguments: 'x'.repeat(OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters + 50) } }]);
    const calls = assembler.finish()!;
    expect(calls).toHaveLength(OPENROUTER_TOOL_CALL_LIMITS.calls);
    expect(calls[0].arguments).toHaveLength(OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters);
  });
});
