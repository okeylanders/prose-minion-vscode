import {
  AgentContextWindowExceededError,
  assertRequestFitsContext,
  estimateRequestTokens,
  estimateTextTokens,
  measureContextWindow
} from '@orchestration/RequestContextPreflight';

describe('estimated request context preflight', () => {
  const messages = [{ role: 'user' as const, content: 'word '.repeat(100) }];

  it('reserves both output and safety headroom', () => {
    expect(() => assertRequestFitsContext(messages, 200, 20)).not.toThrow();
    expect(() => assertRequestFitsContext(messages, 200, 30)).toThrow(AgentContextWindowExceededError);
  });

  it('counts retained history, tool envelopes, long words and Unicode', () => {
    expect(estimateRequestTokens(messages, [{ tool: 'word '.repeat(100) }]))
      .toBeGreaterThan(estimateRequestTokens(messages));
    expect(estimateRequestTokens([...messages, ...messages])).toBe(estimateRequestTokens(messages) * 2);
    expect(estimateRequestTokens([{ role: 'user', content: '界'.repeat(200) }])).toBeGreaterThan(100);
  });

  it('measures the room a request leaves by the rule the preflight refuses with', () => {
    const before = [...messages, { role: 'user' as const, content: '' }];
    const window = measureContextWindow(before, 2_000, 300);
    const evidence = (tokens: number) => [...messages, { role: 'user' as const, content: 'a'.repeat(4 * tokens) }];

    expect(window).toEqual({
      contextLength: 2_000,
      requestTokens: estimateRequestTokens(before),
      outputTokens: 300,
      headroomTokens: 100,
      freeInputTokens: 2_000 - estimateRequestTokens(before) - 300 - 100
    });
    expect(estimateTextTokens('a'.repeat(4 * window.freeInputTokens))).toBe(window.freeInputTokens);
    expect(() => assertRequestFitsContext(evidence(window.freeInputTokens), 2_000, 300)).not.toThrow();
    expect(() => assertRequestFitsContext(evidence(window.freeInputTokens + 1), 2_000, 300))
      .toThrow(AgentContextWindowExceededError);
    expect(measureContextWindow(before, 400, 300).freeInputTokens).toBe(0);
  });
});
