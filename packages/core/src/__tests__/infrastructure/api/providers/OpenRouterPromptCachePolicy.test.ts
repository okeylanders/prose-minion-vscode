import type { OpenRouterMessage, OpenRouterWireMessage } from '@providers/OpenRouterChatContracts';
import { prepareOpenRouterPromptCacheRequest, getOpenRouterPromptCacheTtlSeconds } from '@providers/OpenRouterPromptCachePolicy';

describe('selected cache duration', () => {
  it.each([
    'openai/gpt-5.6-terra', 'openai/gpt-5.6-luna', 'openai/gpt-5.6-sol',
    'openai/gpt-6-sol', 'openai/gpt-6-luna-pro', 'openai/gpt-6-astra',
    'openai/gpt-6.1-sol', '~openai/gpt-5.6-terra:nitro'
  ])('recognizes %s native 30-minute window without changing its request', model => {
    const messages: OpenRouterMessage[] = [{ role: 'user', content: 'Hello' }];
    expect(getOpenRouterPromptCacheTtlSeconds(model, '1h')).toBe(1800);
    const request = prepareOpenRouterPromptCacheRequest(model, messages, 'room', '1h');
    expect(request.messages).toBe(messages);
    expect(request).not.toHaveProperty('cache_control');
    expect(request).not.toHaveProperty('prompt_cache_options');
  });

  it.each(['openai/gpt-5.5', 'openai/gpt-5.4', 'openai/gpt-5.2', 'openai/gpt-4.1',
    'openai/gpt-oss-120b', 'openai/gpt-chat-latest', 'openrouter/auto', 'other/gpt-5.6-terra',
    'openai/gpt-5.60invalid', 'openai/gpt-60invalid'])('keeps %s lifetime unknown', model => {
    expect(getOpenRouterPromptCacheTtlSeconds(model)).toBeUndefined();
  });

  it('selects one hour only for retained Claude requests, including aliases', () => {
    expect(prepareOpenRouterPromptCacheRequest('~anthropic/claude-sonnet-latest', [], 'room', '1h').cache_control)
      .toEqual({ type: 'ephemeral', ttl: '1h' });
    expect(prepareOpenRouterPromptCacheRequest('anthropic/claude-sonnet-5', [], undefined, '1h'))
      .toEqual({ messages: [] });
    const qwen = prepareOpenRouterPromptCacheRequest('qwen/qwen-plus', [{ role: 'user', content: 'Hello' }], 'room', '1h');
    expect(qwen.messages).toEqual([cachedMessage('user', 'Hello')]);
    expect(getOpenRouterPromptCacheTtlSeconds('qwen/qwen-plus', '1h')).toBe(300);
    expect(getOpenRouterPromptCacheTtlSeconds('anthropic/claude-sonnet-5', '1h')).toBe(3600);
    expect(getOpenRouterPromptCacheTtlSeconds('google/gemini-2.5-pro', '1h')).toBeUndefined();
  });
});

const cachedMessage = (role: OpenRouterMessage['role'], text: string): OpenRouterWireMessage => ({
  role,
  content: [{ type: 'text', text, cache_control: { type: 'ephemeral' } }]
});

const removeCacheMarkers = (messages: readonly OpenRouterWireMessage[]) => messages.map(message => ({
  role: message.role,
  content: typeof message.content === 'string' ? message.content : message.content.map(({ type, text }) => ({ type, text }))
}));

describe('OpenRouter prompt cache request policies', () => {
  const messages: OpenRouterMessage[] = [
    { role: 'system', content: 'Stable instructions' },
    { role: 'user', content: 'Opening request' }
  ];

  it.each([
    'deepseek/deepseek-v3.2',
    'qwen/qwen-plus',
    'qwen/qwen3-max',
    'qwen/qwen3-coder-plus',
    'qwen/qwen3-coder-flash',
    'qwen/qwen3.6-plus',
    'qwen/qwen3.6-flash',
    'qwen/qwen3.6-max-preview',
    'qwen/qwen3.7-max',
    'qwen/qwen3.7-plus',
    'qwen/qwen3.7-flash',
    'qwen/qwen3.8-max',
    'qwen/qwen3.8-max-0902',
    'qwen/qwen3.8-flash',
    '~qwen/qwen3.7-max',
    'qwen/qwen3-max:nitro',
    '~deepseek/deepseek-v3.2:floor'
  ])('prepares supported %s with content-level caching instead of a request-level hint', model => {
    const request = prepareOpenRouterPromptCacheRequest(model, messages, 'participant-1');
    expect(request.messages).toEqual([
      cachedMessage('system', 'Stable instructions'),
      cachedMessage('user', 'Opening request')
    ]);
    expect(request.session_id).toMatch(/^prose-minion:[a-f0-9]{64}$/);
    expect(request).not.toHaveProperty('cache_control');
    expect(request).not.toHaveProperty('provider');
  });

  it.each([
    'qwen/qwen3-max-thinking',
    'qwen/qwen3.8-max-prime',
    'qwen/qwen3.5-plus-02-15',
    'qwen/qwen3.5-flash-02-23',
    'qwen/qwen3.8-max-future',
    'deepseek/deepseek-v3.2-exp',
    'deepseek/deepseek-v4-pro',
    'google/gemini-3.8-flash',
    'meta/muse-spark-1.3',
    'openrouter/auto',
    'unknown/model'
  ])('keeps unverified or native %s on its existing content shape', model => {
    const request = prepareOpenRouterPromptCacheRequest(model, messages, 'participant-1');
    expect(request.messages).toEqual(messages);
    expect(request).not.toHaveProperty('cache_control');
  });

  it.each(['anthropic/claude-opus-4.6', '~anthropic/claude-sonnet-latest:nitro', 'qwen/qwen3-max'])
  ('preserves one-off %s without explicit cache-write intent', model => {
    expect(prepareOpenRouterPromptCacheRequest(model, messages)).toEqual({ messages });
  });

  it('advances the tail breakpoint while preserving the system marker, content, roles, and routing identity', () => {
    const frozenInitial = Object.freeze(messages.map(message => Object.freeze({ ...message })));
    const frozenFollowUp = Object.freeze([
      ...frozenInitial,
      Object.freeze({ role: 'assistant' as const, content: 'Reply' }),
      Object.freeze({ role: 'user' as const, content: 'Follow-up' })
    ]);
    const initial = prepareOpenRouterPromptCacheRequest('qwen/qwen3-max', frozenInitial, 'participant-1');
    const followUp = prepareOpenRouterPromptCacheRequest('qwen/qwen3-max', frozenFollowUp, 'participant-1');
    expect(followUp.session_id).toBe(initial.session_id);
    expect(followUp.messages).toEqual([
      cachedMessage('system', 'Stable instructions'),
      { role: 'user', content: [{ type: 'text', text: 'Opening request' }] },
      { role: 'assistant', content: [{ type: 'text', text: 'Reply' }] },
      cachedMessage('user', 'Follow-up')
    ]);
    expect(removeCacheMarkers(followUp.messages).slice(0, initial.messages.length))
      .toEqual(removeCacheMarkers(initial.messages));
    expect(frozenFollowUp).toEqual([
      ...messages, { role: 'assistant', content: 'Reply' }, { role: 'user', content: 'Follow-up' }
    ]);
  });

  it('keeps only two breakpoints on long histories so the stable system prefix remains reusable', () => {
    const history: OpenRouterMessage[] = [
      messages[0],
      ...Array.from({ length: 41 }, (_, index): OpenRouterMessage => ({
        role: index % 2 === 0 ? 'user' : 'assistant', content: `Message ${index}`
      }))
    ];
    const request = prepareOpenRouterPromptCacheRequest('qwen/qwen3.8-max', history, 'participant-1');
    const marked = request.messages.flatMap((message, index) => typeof message.content === 'string'
      ? [] : message.content.filter(block => block.cache_control).map(() => index));
    expect(marked).toEqual([0, history.length - 1]);
    expect(removeCacheMarkers(request.messages).map(message => ({
      role: message.role, content: typeof message.content === 'string' ? message.content : message.content.map(block => block.text).join('')
    }))).toEqual(history);
  });

  it.each([
    [[], []],
    [[{ role: 'user', content: '' }], [{ role: 'user', content: '' }]],
    [[{ role: 'system', content: 'System only' }], [cachedMessage('system', 'System only')]],
    [[{ role: 'user', content: 'No system' }], [cachedMessage('user', 'No system')]],
    [[{ role: 'system', content: 'System' }, { role: 'user', content: '' }],
      [cachedMessage('system', 'System'), { role: 'user', content: '' }]],
    [[{ role: 'user', content: 'Question' }, { role: 'assistant', content: 'Assistant tail' }],
      [{ role: 'user', content: [{ type: 'text', text: 'Question' }] }, cachedMessage('assistant', 'Assistant tail')]]
  ])('handles short/empty transcripts without duplicate or empty cache markers (%j)', (input, expected) => {
    const request = prepareOpenRouterPromptCacheRequest('qwen/qwen3-max', input as OpenRouterMessage[], 'participant-1');
    expect(request.messages).toEqual(expected);
  });
});
