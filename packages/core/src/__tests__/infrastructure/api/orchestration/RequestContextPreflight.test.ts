import {
  AgentContextWindowExceededError,
  assertRequestFitsContext,
  estimateRequestTokens
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
});
