/**
 * The Settings overlay's context-path routes (ADR 2026-11-19 D21, D24):
 * registered by `ConfigurationHandler` when the service is given, every
 * answer echoing its request id, Apply passing ids and known groups only,
 * and a throw answered rather than left waiting. *Alice*.
 */
import { ConfigurationHandler } from '@/application/handlers/domain/ConfigurationHandler';
import { ContextPathsSuggestionRoute } from '@/application/handlers/domain/ContextPathsSuggestionRoute';
import { MessageRouter } from '@/application/handlers/MessageRouter';
import type { ContextPathSuggestions } from '@/application/services/contextPaths/ContextPathSuggestionService';
import { MessageType, type ExtensionToWebviewMessage } from '@messages';

function routeWith(overrides: Partial<ContextPathSuggestions> = {}) {
  const suggestions: ContextPathSuggestions = {
    suggest: jest.fn(async () => ({ outcome: 'proposed' as const, proposalId: 'cps-a:1', view: { groups: [] } })),
    apply: jest.fn(async (_id: string, groups: readonly string[]) => ({ outcome: 'done' as const, groups: groups.map((group) => ({ group, outcome: 'applied' as const })) })) as ContextPathSuggestions['apply'],
    everyGroupEmpty: jest.fn(async () => true),
    ...overrides
  };
  const sent: ExtensionToWebviewMessage[] = [];
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: jest.fn(), clear: jest.fn() };
  const router = new MessageRouter();
  new ContextPathsSuggestionRoute(suggestions, async (message) => { sent.push(message); }, log).registerRoutes(router);
  const send = (type: MessageType, payload: unknown) => router.route({ type, source: 'webview.settings', payload, timestamp: 0 } as never);
  return { suggestions, sent, lines, send };
}

describe('ContextPathsSuggestionRoute', () => {
  it('is registered by ConfigurationHandler when the service is given, and only then', () => {
    const service = { suggest: jest.fn(), apply: jest.fn(), everyGroupEmpty: jest.fn() } as unknown as ContextPathSuggestions;
    const args = [{}, {}, {}, {}, {}, {}, {}, {}, jest.fn(), { appendLine: jest.fn() }] as const;
    const withService = new MessageRouter();
    new ConfigurationHandler(...(args as unknown as [never, never, never, never, never, never, never, never, never, never]), service).registerRoutes(withService);
    expect(withService.hasHandler(MessageType.CONTEXT_PATHS_SUGGEST)).toBe(true);
    expect(withService.hasHandler(MessageType.CONTEXT_PATHS_APPLY)).toBe(true);
    expect(withService.hasHandler(MessageType.CONTEXT_PATHS_STATUS_REQUEST)).toBe(true);
    const without = new MessageRouter();
    new ConfigurationHandler(...(args as unknown as [never, never, never, never, never, never, never, never, never, never])).registerRoutes(without);
    expect(without.hasHandler(MessageType.CONTEXT_PATHS_SUGGEST)).toBe(false);
  });

  it('answers a suggestion under its request id', async () => {
    const { sent, send } = routeWith();
    await send(MessageType.CONTEXT_PATHS_SUGGEST, { requestId: 'cps-w:1' });
    expect(sent).toEqual([expect.objectContaining({
      type: MessageType.CONTEXT_PATHS_SUGGESTION,
      payload: { requestId: 'cps-w:1', outcome: 'proposed', proposalId: 'cps-a:1', view: { groups: [] } }
    })]);
  });

  it('ignores a request with no id, and answers a throw as failed', async () => {
    const { sent, send, suggestions } = routeWith({ suggest: jest.fn(async () => { throw new Error('Cast/**/* broke'); }) });
    await send(MessageType.CONTEXT_PATHS_SUGGEST, {});
    expect(suggestions.suggest).not.toHaveBeenCalled();
    await send(MessageType.CONTEXT_PATHS_SUGGEST, { requestId: 'r1' });
    expect(sent.map((message) => message.payload)).toEqual([{ requestId: 'r1', outcome: 'failed' }]);
  });

  it('passes Apply the proposal id and only known groups, in order, never anything else', async () => {
    const { sent, send, suggestions } = routeWith();
    await send(MessageType.CONTEXT_PATHS_APPLY, { requestId: 'r2', proposalId: 'cps-a:1', groups: ['locations', 'people', 'characters', 'Cast/**/*'], patterns: ['/etc'] });
    expect(suggestions.apply).toHaveBeenCalledWith('cps-a:1', ['characters', 'locations']);
    expect(sent[0]).toMatchObject({ type: MessageType.CONTEXT_PATHS_APPLIED, payload: { requestId: 'r2', outcome: 'done' } });
  });

  it('refuses an Apply naming no proposal', async () => {
    const { sent, send, suggestions } = routeWith();
    await send(MessageType.CONTEXT_PATHS_APPLY, { requestId: 'r3', groups: ['characters'] });
    expect(suggestions.apply).not.toHaveBeenCalled();
    expect(sent[0].payload).toEqual({ requestId: 'r3', outcome: 'unknown-proposal', groups: [] });
  });

  it('answers the status under its request id', async () => {
    const { sent, send } = routeWith();
    await send(MessageType.CONTEXT_PATHS_STATUS_REQUEST, { requestId: 'r4' });
    expect(sent[0]).toMatchObject({ type: MessageType.CONTEXT_PATHS_STATUS, payload: { requestId: 'r4', everyGroupEmpty: true } });
  });

  it('logs no pattern or host message', async () => {
    const { lines, send } = routeWith({ suggest: jest.fn(async () => { throw new Error('Cast/**/* broke'); }) });
    await send(MessageType.CONTEXT_PATHS_SUGGEST, { requestId: 'r5' });
    expect(lines.join('\n')).not.toContain('Cast');
  });
});
