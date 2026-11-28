/* eslint-disable @typescript-eslint/naming-convention -- OpenRouter's wire names. */
/**
 * A persona turn over a mocked OpenRouter transport, for the native
 * tool-call adapter: the real client reads each scripted wire reply, the
 * real engine runs the turn, and the real persona capability translates,
 * decodes and fulfills over real session recall. Nothing reaches a network.
 */

import type { SettingsStore } from '@/platform';
import { unavailableHelpReference } from '@/__tests__/application/services/workshop/help/unavailableHelpReference';
import { unavailableProjectLocations } from '@/__tests__/application/services/workshop/locations/unavailableProjectLocations';
import { unavailableFileHistory } from '@/__tests__/application/services/workshop/history/unavailableFileHistory';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import {
  scriptedCheckpoint,
  setupCoordinator
} from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import { WorkshopLiveRoomBookmarkReader } from '@/application/services/workshop/WorkshopLiveRoomBookmarkReader';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { WorkshopResourceSources } from '@/application/services/workshop/WorkshopResourceCapability';
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { OpenRouterClient, type OpenRouterMessage, type OpenRouterWebSearchTool } from '@providers/OpenRouterClient';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import { noProjectLenses } from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';
import { groupListingOver } from '@/__tests__/application/services/workshop/resource/groupListingFixtures';

/** What web research attaches to a persona's request: the trigger of the native calls. */
export const WEB_RESEARCH_TOOLS: OpenRouterWebSearchTool[] = [{
  type: 'openrouter:web_search',
  parameters: { engine: 'auto', max_uses: 3, max_total_results: 10 }
}];

export interface NativeCall {
  readonly name: string;
  /** An object is sent as JSON; text is sent exactly as given. */
  readonly arguments: unknown;
  /** Send `arguments` on the wire as it is, not as JSON text: a malformed payload. */
  readonly raw?: boolean;
}

/** One scripted provider reply: plain text, or native calls with optional prose beside them. */
export type WireReply = string | {
  readonly text?: string;
  readonly calls: readonly NativeCall[];
  /** The finish reason the provider gives; `tool_calls` unless set. */
  readonly finish?: string;
};

export const native = (name: string, args: unknown = {}, text?: string): WireReply =>
  ({ calls: [{ name, arguments: args }], ...(text !== undefined ? { text } : {}) });

const argumentText = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));
const wireArguments = (call: NativeCall): unknown => (call.raw ? call.arguments : argumentText(call.arguments));

const wholeReply = (reply: WireReply): Response => ({
  ok: true,
  json: async () => ({
    id: 'gen-test',
    model: 'placeholder/model',
    choices: [typeof reply === 'string'
      ? { message: { role: 'assistant', content: reply }, finish_reason: 'stop' }
      : {
          message: {
            role: 'assistant',
            content: reply.text ?? null,
            tool_calls: reply.calls.map((call, index) => ({
              id: `call_${index}`, type: 'function', function: { name: call.name, arguments: wireArguments(call) }
            }))
          },
          finish_reason: reply.finish ?? 'tool_calls'
        }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  })
}) as unknown as Response;

/** The same reply as SSE frames, with each call's argument JSON split across two fragments. */
const streamedReply = (reply: WireReply): Response => {
  const frames: unknown[] = [];
  const text = typeof reply === 'string' ? reply : reply.text;
  if (text) {
    const middle = Math.ceil(text.length / 2);
    frames.push({ model: 'placeholder/model', choices: [{ delta: { content: text.slice(0, middle) } }] });
    frames.push({ choices: [{ delta: { content: text.slice(middle) } }] });
  }
  if (typeof reply !== 'string') {
    reply.calls.forEach((call, index) => {
      frames.push({ choices: [{ delta: { tool_calls: [{ index, id: `call_${index}`, type: 'function', function: { name: call.name, arguments: '' } }] } }] });
      if (call.raw) {
        frames.push({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: call.arguments } }] } }] });
        return;
      }
      const args = argumentText(call.arguments);
      const middle = Math.ceil(args.length / 2);
      frames.push({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: args.slice(0, middle) } }] } }] });
      frames.push({ choices: [{ delta: { tool_calls: [{ index, function: { arguments: args.slice(middle) } }] } }] });
    });
  }
  frames.push({
    choices: [{ delta: {}, finish_reason: typeof reply === 'string' ? 'stop' : reply.finish ?? 'tool_calls' }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
  });
  const encoded = [...frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`), 'data: [DONE]\n\n']
    .map((frame) => new TextEncoder().encode(frame));
  let index = 0;
  return {
    ok: true,
    body: {
      getReader: () => ({
        read: async () => (index < encoded.length ? { done: false, value: encoded[index++] } : { done: true, value: undefined }),
        releaseLock: () => undefined
      }),
      cancel: async () => undefined
    }
  } as unknown as Response;
};

export interface SentRequest {
  readonly body: Record<string, unknown>;
  readonly messages: OpenRouterMessage[];
}

const flatten = (content: unknown): string =>
  (typeof content === 'string'
    ? content
    : (content as Array<{ text?: string }>).map((block) => block.text ?? '').join(''));

export function createNativeToolCallHarness(settings?: SettingsStore) {
  const room = setupCoordinator();
  const { session, manager, store, coordinator, log, time } = room;
  const engine = new AgentRunEngine(new OpenRouterClient('test-key', 'placeholder/model', log), manager, undefined, log, undefined, settings);
  const recall = new WorkshopTranscriptRecallService(store, coordinator, log, {
    liveRoom: new WorkshopLiveRoomBookmarkReader(session, () => time.exportState().timezone)
  });
  const dictionary = {
    lookupWordStreaming: jest.fn().mockResolvedValue({ toolName: 'dictionary_lookup', content: '# curious\nEager to know.' })
  };
  const analysis = {
    runWithInputs: jest.fn().mockResolvedValue({ toolName: 'writing_tools_continuity', content: 'Continuity report.', conversationId: 'continuity-conv' }),
    adoptPersonaReport: jest.fn(() => ({
      turn: {
        id: 'analysis-turn', role: 'assistant', kind: 'tool_run', participant: 'tool', artifact: 'tool_report',
        toolId: 'continuity', toolLabel: 'Continuity', reportTurnId: 'analysis-turn',
        excerptVersion: session.getExcerptVersion(), content: 'Continuity report.', timestamp: 7
      }
    })),
    discardConversation: jest.fn()
  };
  const listResources = jest.fn().mockReturnValue([]);
  const factory = new WorkshopPersonaCapabilityFactory(
    dictionary as unknown as DictionaryService,
    analysis as unknown as WorkshopAnalysisSidePass,
    {
      createProvider: jest.fn().mockResolvedValue({ listResources, loadResources: jest.fn().mockResolvedValue([]) }),
      ...groupListingOver(() => listResources())
    } as WorkshopResourceSources,
    session,
    log,
    recall,
    offProjectMemory,
    noProjectLenses,
    unavailableHelpReference,
    unavailableFileHistory,
    unavailableProjectLocations
  );
  const originalFetch = global.fetch;
  const sent: SentRequest[] = [];
  let script: WireReply[] = [];

  global.fetch = jest.fn(async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push({
      body,
      messages: (body.messages as Array<{ role: OpenRouterMessage['role']; content: unknown }>).map((message) => ({ role: message.role, content: flatten(message.content) }))
    });
    const reply = script.shift();
    if (reply === undefined) {throw new Error('the provider was asked for a reply the test did not script');}
    return body.stream ? streamedReply(reply) : wholeReply(reply);
  }) as unknown as typeof fetch;

  let requests = 0;
  /** One writer message to the host persona, with web research on. `visible` is what the stream showed. */
  const hostTurn = async (text: string, replies: WireReply[], options: { streaming?: boolean; conversationId?: string } = {}) => {
    script = [...replies];
    const requestId = `request-${++requests}`;
    session.beginPersonaMessage(requestId, text);
    const capability = factory.create({
      requestId,
      personaId: 'jill',
      owner: { kind: 'host' },
      excerpt: session.getExcerpt(),
      excerptVersion: session.getExcerptVersion(),
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const visible: string[] = [];
    const runOptions = { tools: WEB_RESEARCH_TOOLS, ...(options.streaming ? { onToken: (token: string) => { visible.push(token); } } : {}) };
    const result = options.conversationId
      ? await engine.continueConversation({ conversationId: options.conversationId, userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability, options: runOptions })
      : await engine.runInitial({ toolName: 'workshop_jill', systemMessage: 'Jill system', userMessage: text, policy: AGENT_RUN_POLICIES.workshopHost, capability, options: runOptions });
    return { result, visible: visible.join(''), unusedReplies: script.length };
  };

  /** A saved session recall can find by its title. */
  const saveSession = (sessionId: string, title: string) =>
    store.saveNamed({ ...scriptedCheckpoint(sessionId, new ScriptedWorkshopRoom().start()), title });

  /** Capability cards the room recorded, by operation. */
  const cards = () => session.readRoomLedger()
    .filter((turn) => turn.capability !== undefined)
    .map((turn) => `${turn.capability!.operation}:${turn.capability!.status}`);

  const logLines = (): string[] => (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));

  return {
    ...room, engine, sent, hostTurn, saveSession, cards, logLines, dictionary, analysis,
    dispose: () => { engine.dispose(); global.fetch = originalFetch; }
  };
}
