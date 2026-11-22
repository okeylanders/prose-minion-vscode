/**
 * What a Passage Search call that threw came to (ADR 2026-11-20 D7, D11;
 * PR #295 re-review): one rule, shared by the reads and the organizing
 * pass, for whether the request reached the provider. One case per reason,
 * and a table that does not compile until a new engine reason is placed.
 */
import { AgentRunUnavailableError, type AgentRunUnavailableReason } from '@orchestration/AgentRunEngine';
import {
  classifyPassageSearchCallFailure,
  passageSearchCallWasDispatched,
  passageSearchFaultKind,
  type PassageSearchCallFailure
} from '@services/search/passage/PassageSearchCallFailures';

describe('classifyPassageSearchCallFailure', () => {
  it('key-changed: the retired engine refused, nothing was sent, stopped or not', () => {
    expect(classifyPassageSearchCallFailure(new AgentRunUnavailableError('missing-credentials'), false)).toBe('key-changed');
    expect(classifyPassageSearchCallFailure(new AgentRunUnavailableError('missing-credentials'), true)).toBe('key-changed');
    expect(passageSearchCallWasDispatched('key-changed')).toBe(false);
  });

  it('too-large: the engine\'s own preflight refused before dispatch, nothing was sent, stopped or not', () => {
    const refused = new AgentRunUnavailableError('context-window-exceeded', 'Request needs about 20,000 tokens; the model has a 16,384-token window.');
    expect(classifyPassageSearchCallFailure(refused, false)).toBe('too-large');
    expect(classifyPassageSearchCallFailure(refused, true)).toBe('too-large');
    expect(passageSearchCallWasDispatched('too-large')).toBe(false);
  });

  it('stopped-in-flight: any other failure once the caller\'s signal was aborted, dispatched', () => {
    expect(classifyPassageSearchCallFailure(new Error('The operation was aborted.'), true)).toBe('stopped-in-flight');
    expect(classifyPassageSearchCallFailure(new AgentRunUnavailableError('provider-unavailable'), true)).toBe('stopped-in-flight');
    expect(passageSearchCallWasDispatched('stopped-in-flight')).toBe(true);
  });

  it('provider-failed: anything else, since nothing says the request did not go out, dispatched', () => {
    expect(classifyPassageSearchCallFailure(new Error('503'), false)).toBe('provider-failed');
    expect(classifyPassageSearchCallFailure(new SyntaxError('Unexpected token'), false)).toBe('provider-failed');
    expect(classifyPassageSearchCallFailure('not an error at all', false)).toBe('provider-failed');
    expect(passageSearchCallWasDispatched('provider-failed')).toBe(true);
  });

  it('places every reason the engine gives, unstopped: only two are known to precede dispatch', () => {
    // A new engine reason does not compile here until it is placed on purpose.
    /* eslint-disable @typescript-eslint/naming-convention -- keyed by the engine's closed reasons. */
    const placed: Record<AgentRunUnavailableReason, PassageSearchCallFailure> = {
      'missing-credentials': 'key-changed',
      'context-window-exceeded': 'too-large',
      authentication: 'provider-failed',
      'insufficient-credits': 'provider-failed',
      'token-budget-exceeded': 'provider-failed',
      'rate-limited': 'provider-failed',
      'provider-unavailable': 'provider-failed'
    };
    /* eslint-enable @typescript-eslint/naming-convention */
    for (const [reason, failure] of Object.entries(placed) as Array<[AgentRunUnavailableReason, PassageSearchCallFailure]>) {
      expect([reason, classifyPassageSearchCallFailure(new AgentRunUnavailableError(reason), false)]).toEqual([reason, failure]);
    }
  });
});

describe('passageSearchFaultKind', () => {
  it('names a closed reason or a class, never a message', () => {
    expect(passageSearchFaultKind(new AgentRunUnavailableError('context-window-exceeded', 'Alice’s chapter is too long'))).toBe('context-window-exceeded');
    expect(passageSearchFaultKind(new TypeError('the Rabbit’s watch'))).toBe('TypeError');
    expect(passageSearchFaultKind({ message: 'the Queen' })).toBe('unknown');
  });
});
