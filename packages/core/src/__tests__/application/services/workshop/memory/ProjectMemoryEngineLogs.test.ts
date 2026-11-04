/**
 * No memory text in any log (ADR 2026-11-04 D9; PR #197 F-03), through the
 * real engine, persona capability, library and store: a committed
 * `memory.read` keeps its title in the manifest the writer sees, and out of
 * the engine's log, with debug logging off and on. *Alice*, with made-up ids.
 */
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { SettingsStore } from '@/platform';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { libraryHost, writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

const SENTINELS = ['PRIVATE_MEMORY_TITLE_SENTINEL', 'PRIVATE_MEMORY_SUMMARY_SENTINEL', 'PRIVATE_MEMORY_BODY_SENTINEL'];

describe.each([['off', false], ['on', true]])('a committed memory.read, debug logging %s', (_name, debugLogging) => {
  it('keeps the title in the manifest and every memory text out of every log', async () => {
    const host = libraryHost();
    host.put(writerMemory({ id: 'mem-abcdef', title: SENTINELS[0], summary: SENTINELS[1], body: projectMemoryBody(SENTINELS[2]) }));
    const lines: string[] = [];
    const sink = { appendLine: (line: string) => { lines.push(line); }, clear: jest.fn(), show: jest.fn() };
    const settings = { get: ((_section: string, key: string, fallback?: unknown) => (key === 'debugLogging' ? debugLogging : fallback)) as SettingsStore['get'], update: jest.fn() };
    const client = { createChatCompletion: jest.fn(), createStreamingChatCompletion: jest.fn() };
    client.createChatCompletion
      .mockResolvedValueOnce({ content: '<prose-minion-tool-call name="memory.read"><memory>mem-abcdef</memory></prose-minion-tool-call>', finishReason: 'stop' })
      .mockResolvedValueOnce({ content: 'The saved note settles it.', finishReason: 'stop' });
    const manager = new ConversationManager();
    const engine = new AgentRunEngine(client as never, manager, undefined, sink, undefined, settings);
    try {
      const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
      session.setSessionScope('open');
      session.beginPersonaMessage('host-request', 'What did we settle?');
      const capability = new WorkshopPersonaCapabilityFactory(
        {} as DictionaryService,
        {} as WorkshopAnalysisSidePass,
        { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
        session,
        sink,
        {} as WorkshopTranscriptRecallPort,
        host.library
      ).create({
        requestId: 'host-request',
        excerptVersion: 0,
        personaId: 'jill',
        owner: { kind: 'host' },
        signal: new AbortController().signal,
        events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
      });
      const result = await engine.runInitial({
        toolName: 'workshop_persona_jill', systemMessage: 'System.', userMessage: 'What did we settle?', policy: AGENT_RUN_POLICIES.workshopHost, capability
      });

      expect(manager.getContextSources(result.conversationId)).toEqual([expect.objectContaining({ kind: 'memory', label: SENTINELS[0] })]);
      const logged = [...lines, ...host.lines].join('\n');
      expect(logged).toContain('[AgentRunEngine] Context sources committed for');
      for (const sentinel of SENTINELS) {
        expect(logged).not.toContain(sentinel);
      }
    } finally {
      engine.dispose();
    }
  });
});
