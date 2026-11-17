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

  it('bounds how many calls one reply may carry', () => {
    const assembler = new OpenRouterToolCallAssembler();
    for (let index = 0; index < OPENROUTER_TOOL_CALL_LIMITS.calls + 5; index += 1) {
      assembler.add([{ index, function: { name: `tool_${index}`, arguments: '{}' } }]);
    }
    expect(assembler.finish()).toHaveLength(OPENROUTER_TOOL_CALL_LIMITS.calls);
  });

  describe('a call the wire did not carry soundly is marked, never mended (PR #267 F-01)', () => {
    const limit = OPENROUTER_TOOL_CALL_LIMITS.argumentCharacters;
    const call = (fn: unknown) => [{ id: 'a', type: 'function', function: fn }];
    const faulted = (fault: string, name = 'transcript.catalog') => [{ id: 'a', name, arguments: '', fault }];

    it.each<[string, unknown]>([
      ['an object', { match: '6.11' }],
      ['a list', ['6.11']],
      ['a number', 611],
      ['a boolean', false]
    ])('marks whole arguments sent as %s malformed, and keeps none of them', (_label, args) => {
      expect(readOpenRouterToolCalls(call({ name: 'transcript.catalog', arguments: args }))).toEqual(faulted('malformed'));
    });

    it('marks arguments over the bound oversized instead of keeping a prefix that could parse', () => {
      const invalidButValidWhenCut = '{}'.padEnd(limit, ' ') + 'invalid tail';
      expect(() => JSON.parse(invalidButValidWhenCut)).toThrow();
      expect(readOpenRouterToolCalls(call({ name: 'transcript.catalog', arguments: invalidButValidWhenCut }))).toEqual(faulted('oversized'));
      // Exactly at the bound is kept whole.
      const atBound = '{}'.padEnd(limit, ' ');
      expect(readOpenRouterToolCalls(call({ name: 'transcript.catalog', arguments: atBound }))).toEqual([{ id: 'a', name: 'transcript.catalog', arguments: atBound }]);
    });

    it('lets a later fragment invalidate the whole pending call, whatever came before or comes after', () => {
      const fragments = (...later: unknown[]) => {
        const assembler = new OpenRouterToolCallAssembler();
        assembler.add([{ index: 0, id: 'a', type: 'function', function: { name: 'transcript.catalog', arguments: '{}' } }]);
        later.forEach((fn) => assembler.add([{ index: 0, function: fn }]));
        return assembler.finish();
      };
      expect(fragments({ arguments: { match: '6.11' } }, { arguments: ' ' })).toEqual(faulted('malformed'));
      expect(fragments({ arguments: ' '.repeat(limit) }, { arguments: ' ' })).toEqual(faulted('oversized'));
      expect(fragments('not a function object')).toEqual(faulted('malformed'));
      // Sound fragments still stitch, and absent or null fields are simply not there.
      expect(fragments({ arguments: null }, {}, { name: null, arguments: ' ' })).toEqual([{ id: 'a', name: 'transcript.catalog', arguments: '{} ' }]);
    });

    it('marks a name that is not text, or too long to keep whole, and never a cut name', () => {
      expect(readOpenRouterToolCalls(call({ name: 42, arguments: '{}' }))).toEqual(faulted('malformed', ''));
      // Cut at the bound and trimmed, this name would read as a known operation.
      const padded = 'transcript.catalog'.padEnd(OPENROUTER_TOOL_CALL_LIMITS.nameCharacters, ' ') + 'x';
      expect(readOpenRouterToolCalls(call({ name: padded, arguments: '{}' }))).toEqual(faulted('oversized', ''));
    });

    it('keeps genuinely empty arguments apart: they are a sound call with none', () => {
      for (const fn of [{ name: 'transcript.catalog' }, { name: 'transcript.catalog', arguments: '' }, { name: 'transcript.catalog', arguments: null }]) {
        expect(readOpenRouterToolCalls(call(fn))).toEqual([{ id: 'a', name: 'transcript.catalog', arguments: '' }]);
      }
    });
  });
});
