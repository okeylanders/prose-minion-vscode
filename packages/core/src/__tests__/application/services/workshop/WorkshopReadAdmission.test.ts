/** Real persona engine and read families across a refresh of the live model catalog. */
import { AgentRunEngine } from '@orchestration/AgentRunEngine';
import { AGENT_RUN_POLICIES } from '@orchestration/AgentRunPolicies';
import { ConversationManager } from '@orchestration/ConversationManager';
import { OpenRouterModels } from '@providers/OpenRouterModels';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { WorkshopProjectMemoryPort } from '@/application/services/workshop/memory/WorkshopProjectMemoryCapability';
import type { WorkshopResourceSources } from '@/application/services/workshop/WorkshopResourceCapability';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { libraryHost, writerMemory } from './memory/projectMemoryLibraryHost';
import { offProjectMemory } from './memory/projectMemoryTestPorts';
import { noProjectLenses } from './lens/lensLibraryFixtures';
import { unavailableHelpReference } from './help/unavailableHelpReference';
import { unavailableFileHistory } from './history/unavailableFileHistory';
import { unavailableProjectLocations } from './locations/unavailableProjectLocations';
import { aliceLines, aliceResources, manuscript } from './resource/resourceReadFixtures';
import { saveExcerptCorpus } from './recall/workshopRecallExcerptFixtures';

const call = (operation: string, fields: string) => `<prose-minion-tool-call name="${operation}">${fields}</prose-minion-tool-call>`;

async function runChangingCatalog(
  reads: { resources?: WorkshopResourceSources; recall?: WorkshopTranscriptRecallPort; memory?: WorkshopProjectMemoryPort },
  firstCall: string, retry: string, extraCall?: string
) {
  const session = new WorkshopSessionService(() => Date.parse('2026-11-04T10:00:00.000Z'));
  session.setSessionScope('open');
  session.beginPersonaMessage('request', 'Read the material.');
  const log = { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() };
  const capability = new WorkshopPersonaCapabilityFactory(
    {} as DictionaryService, {} as WorkshopAnalysisSidePass, reads.resources ?? aliceResources([]).factory,
    session, log, reads.recall ?? {} as WorkshopTranscriptRecallPort, reads.memory ?? offProjectMemory,
    noProjectLenses, unavailableHelpReference, unavailableFileHistory, unavailableProjectLocations
  ).create({
    requestId: 'request', excerptVersion: 0, personaId: 'jill', owner: { kind: 'host' },
    signal: new AbortController().signal,
    events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
  });
  const facts = jest.spyOn(OpenRouterModels, 'getCachedContextLength').mockReturnValue(undefined);
  const prepare = capability.prepareEvidence.bind(capability);
  jest.spyOn(capability, 'prepareEvidence').mockImplementationOnce(async (...args) => {
    const result = await prepare(...args);
    facts.mockReturnValue(8_192);
    return result;
  });
  const provider = { createChatCompletion: jest.fn() };
  provider.createChatCompletion.mockResolvedValueOnce({ content: firstCall, finishReason: 'stop' })
    .mockImplementationOnce(async () => {
      facts.mockReturnValue(undefined);
      return { content: retry, finishReason: 'stop' };
    });
  if (extraCall) {
    provider.createChatCompletion.mockResolvedValueOnce({ content: extraCall, finishReason: 'stop' });
  }
  provider.createChatCompletion.mockResolvedValueOnce({ content: 'Finished reading.', finishReason: 'stop' });
  const manager = new ConversationManager();
  const engine = new AgentRunEngine(provider as never, manager);
  try {
    const result = await engine.runInitial({
      toolName: 'workshop_persona_jill', systemMessage: 'System.', userMessage: 'Read the material.',
      policy: AGENT_RUN_POLICIES.workshopHost, capability, options: { maxTokens: 1_000 }
    });
    expect(result.content).toBe('Finished reading.');
    const evidence = provider.createChatCompletion.mock.calls.slice(1).map(([messages]) => messages.at(-1).content as string);
    expect(evidence[0]).toContain('did not fit');
    return { evidence, sources: manager.getContextSources(result.conversationId),
      statuses: session.readRoomLedger().flatMap(turn => turn.capability ? [turn.capability.status] : []) };
  } finally {
    facts.mockRestore();
    engine.dispose();
  }
}

describe('read allowances when the window becomes known before admission and unknown again on retry', () => {
  it('delivers all four memory notes after withholding their first read', async () => {
    const host = libraryHost();
    const ids = ['mem-000001', 'mem-000002', 'mem-000003', 'mem-000004'];
    ids.forEach(id => host.put(writerMemory({ id, title: id, body: projectMemoryBody('<'.repeat(7_000)) })));
    const read = call('memory.read', ids.map(id => `<memory>${id}</memory>`).join(''));
    const { evidence, sources, statuses } = await runChangingCatalog({ memory: host.library }, read, read);
    expect(evidence[0]).not.toContain('end of note');
    for (const id of ids) {
      expect(evidence[1]).toContain(`end of note ${id}`);
    }
    expect(sources).toHaveLength(4);
    expect(statuses).toEqual(['rejected', 'success']);
  });

  it('leaves the file allowance available for a narrower retry after withholding a full multi-file read', async () => {
    const files = Array.from({ length: 4 }, (_, i) => manuscript(`chapter-${i}.md`, aliceLines(400, 255, `Chapter ${i}`)));
    const project = aliceResources(files);
    const group = '<group>manuscript</group>';
    const read = call('resource.read', group + files.map(file => `<path>${file.path}</path>`).join(''));
    const retry = call('resource.read', group + '<path>chapter-0.md</path><startLine>1</startLine><endLine>20</endLine>');
    const { evidence, sources, statuses } = await runChangingCatalog({ resources: project.factory }, read, retry);
    expect(evidence[0]).not.toContain('Chapter 0 line');
    expect(evidence[1]).toContain('Chapter 0 line 20');
    expect(sources).toHaveLength(1);
    expect(statuses).toEqual(['rejected', 'success']);
  });

  it('leaves recall characters available for the retry while counting the withheld service call toward the turn limit', async () => {
    const budgets = jest.replaceProperty(PROMPT_BUDGETS, 'workshopTranscriptRecall',
      { ...PROMPT_BUDGETS.workshopTranscriptRecall, readsPerTurn: 2 });
    try {
      const corpus = await saveExcerptCorpus();
      const recall = new WorkshopTranscriptRecallService(corpus.store, corpus.coordinator, corpus.log);
      const batch = [corpus.sessions.stock, corpus.sessions.cliche, corpus.sessions.endings].map(id => `<session>${id}</session>`).join('');
      const read = call('transcript.read', batch + '<detail>full</detail>');
      const retry = call('transcript.read', `<session turns="10-18">${corpus.sessions.stock}</session>`);
      const { evidence, sources, statuses } = await runChangingCatalog({ recall }, read, retry, retry);
      expect(evidence[0]).not.toContain(corpus.reports.stock[0].body.slice(0, 80));
      expect(evidence[1]).toContain(`"readLimit":${PROMPT_BUDGETS.workshopTranscriptRecall.readCharacters}`);
      expect(evidence[2]).toContain('recall-read-limit');
      expect(sources).toHaveLength(1);
      expect(statuses).toEqual(['rejected', 'success', 'rejected']);
    } finally {
      budgets.restore();
    }
  });
});
