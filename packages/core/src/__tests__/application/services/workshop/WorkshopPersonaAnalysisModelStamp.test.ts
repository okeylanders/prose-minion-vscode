/**
 * A persona-run analysis is a provider run, so its report turn carries the
 * run's model stamp (ADR 2026-11-03 D7). Capability turns no provider made
 * carry none, and the stamp never reaches the evidence the persona reads.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { LogSink } from '@/platform';

const unusedRecall: WorkshopTranscriptRecallPort = {
  catalog: () => Promise.reject(new Error('recall is not under test here')),
  search: () => Promise.reject(new Error('recall is not under test here')),
  read: () => Promise.reject(new Error('recall is not under test here')),
  todos: () => Promise.reject(new Error('recall is not under test here'))
};

const ANALYSIS_REQUEST = {
  capability: 'analysis.run' as const,
  toolId: 'continuity' as const,
  excerpt: { mode: 'inherit' as const },
  context: { mode: 'omit' as const }
};

const RUN_MODEL = {
  scope: 'assistant' as const,
  requestedModelId: 'vendor/requested-for-analysis',
  servedModelIds: ['vendor/served-for-analysis']
};

describe('persona-run analysis model stamps', () => {
  let session: WorkshopSessionService;
  let analyzeWritingTools: jest.Mock<Promise<AnalysisResult>>;
  let dictionary: jest.Mocked<DictionaryService>;
  let listResources: jest.Mock;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 7);
    session.setExcerpt({ text: 'The cup crossed the table.', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-request', 'Help me revise this.');
    analyzeWritingTools = jest.fn().mockResolvedValue({
      toolName: 'writing_tools_continuity',
      content: 'Verbatim continuity report.',
      timestamp: new Date(0),
      model: RUN_MODEL
    });
    dictionary = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        toolName: 'dictionary_lookup', content: '# liminal\nThreshold-toned.'
      })
    } as unknown as jest.Mocked<DictionaryService>;
    listResources = jest.fn().mockReturnValue([]);
  });

  const capability = () => {
    const log = { appendLine: jest.fn() } as unknown as LogSink;
    const assistant = {
      analyzeWritingTools,
      discardConversation: jest.fn()
    } as unknown as AssistantToolService;
    const resourceProviderFactory: ContextResourceProviderFactory = {
      createProvider: jest.fn().mockResolvedValue({ listResources, loadResources: jest.fn().mockResolvedValue([]) })
    };
    return new WorkshopPersonaCapabilityFactory(
      dictionary,
      new WorkshopAnalysisSidePass(assistant, session, log),
      resourceProviderFactory,
      session,
      log,
      unusedRecall
    ).create({
      requestId: 'host-request',
      excerptVersion: session.getExcerptVersion(),
      personaId: 'jill',
      owner: { kind: 'host' },
      excerpt: session.getExcerpt()!,
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
  };

  const turnsWithArtifact = (artifact: string) =>
    session.getSnapshot().turns.filter((turn) => turn.artifact === artifact);

  it('stamps the report with the analysis run\'s scope, requested and served models', async () => {
    const fulfillment = await capability().fulfill(ANALYSIS_REQUEST);

    const [report] = turnsWithArtifact('tool_report');
    expect(report.model).toEqual(RUN_MODEL);
    expect(fulfillment.evidence).toContain('Verbatim continuity report.');
    expect(fulfillment.evidence).not.toContain('vendor/');
  });

  it('records no stamp for a failed analysis', async () => {
    analyzeWritingTools.mockResolvedValue({
      toolName: 'writing_tools_continuity',
      content: 'Error: provider unavailable',
      timestamp: new Date(0),
      model: RUN_MODEL
    });

    await capability().fulfill(ANALYSIS_REQUEST);

    const [report] = turnsWithArtifact('tool_report');
    expect(report.capability?.status).toBe('failed');
    expect(report.model).toBeUndefined();
  });

  it('records no stamp for a run that reported no models', async () => {
    analyzeWritingTools.mockResolvedValue({
      toolName: 'writing_tools_continuity',
      content: 'Verbatim continuity report.',
      timestamp: new Date(0)
    });

    await capability().fulfill(ANALYSIS_REQUEST);

    expect(turnsWithArtifact('tool_report')[0].model).toBeUndefined();
  });

  it('leaves capability turns that are not D7 replies unstamped', async () => {
    const adapter = capability();
    await adapter.fulfill({ capability: 'resource.catalog' });
    await adapter.fulfill({ capability: 'dictionary.lookup', word: 'liminal', context: 'threshold', purpose: 'tone' });

    expect(turnsWithArtifact('resource_catalog')).toHaveLength(1);
    expect(turnsWithArtifact('dictionary_lookup')).toHaveLength(1);
    expect(session.getSnapshot().turns.every((turn) => turn.model === undefined)).toBe(true);
  });
});
