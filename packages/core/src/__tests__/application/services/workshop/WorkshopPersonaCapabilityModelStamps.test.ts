/**
 * A persona's analyses and dictionary lookups are provider runs, so their
 * turns carry the run's model stamp (ADR 2026-11-03 D7; dictionary added after
 * Astra's N-01). Capability turns no provider made carry none, a host-written
 * stand-in carries none (F-02), and the stamp never reaches the evidence the
 * persona reads.
 */
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
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

const DICTIONARY_MODEL = {
  scope: 'dictionary' as const,
  requestedModelId: 'vendor/dictionary-requested',
  servedModelIds: ['vendor/dictionary-served']
};

const LOOKUP = { capability: 'dictionary.lookup' as const, word: 'liminal', context: 'threshold', purpose: 'tone' };
const FULL_ENTRY = { capability: 'dictionary.full-entry' as const, word: 'liminal', context: 'threshold', purpose: 'tone' };

describe('persona capability model stamps', () => {
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
      model: RUN_MODEL,
      replySource: 'provider'
    });
    dictionary = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        toolName: 'dictionary_lookup',
        content: '# liminal\nThreshold-toned.',
        outcome: 'entry',
        model: DICTIONARY_MODEL,
        replySource: 'provider'
      }),
      generateParallelDictionary: jest.fn().mockResolvedValue({
        word: 'liminal',
        result: '# Full entry',
        metadata: { totalDuration: 1, blockDurations: {}, partialFailures: [], successCount: 3, totalBlocks: 3 },
        modelIds: ['vendor/dictionary-served'],
        model: DICTIONARY_MODEL,
        replySource: 'provider'
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
      unusedRecall,
      offProjectMemory
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
      model: RUN_MODEL,
      replySource: 'provider'
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

  it('records no stamp for an analysis whose reply the engine wrote', async () => {
    analyzeWritingTools.mockResolvedValue({
      toolName: 'writing_tools_continuity',
      content: 'The assistant returned no usable final response. Please try again.',
      timestamp: new Date(0),
      model: RUN_MODEL,
      replySource: 'host-fallback'
    });

    await capability().fulfill(ANALYSIS_REQUEST);

    expect(turnsWithArtifact('tool_report')[0].model).toBeUndefined();
  });

  it('stamps a dictionary lookup and a full entry with the dictionary scope', async () => {
    const adapter = capability();
    const lookup = await adapter.fulfill(LOOKUP);
    const entry = await adapter.fulfill(FULL_ENTRY);

    expect(turnsWithArtifact('dictionary_lookup')[0].model).toEqual(DICTIONARY_MODEL);
    expect(turnsWithArtifact('dictionary_full_entry')[0].model).toEqual(DICTIONARY_MODEL);
    expect(lookup.evidence).not.toContain('vendor/');
    expect(entry.evidence).not.toContain('vendor/');
  });

  it.each([
    ['a failed lookup', { content: 'Error: provider unavailable', outcome: 'failed' }],
    ['an unconfigured key', { content: '⚠️ OpenRouter API key not configured', outcome: 'unconfigured' }],
    ['a host-written stand-in', { content: 'The assistant returned no usable final response.', outcome: 'entry', replySource: 'host-fallback' }]
  ])('records no dictionary stamp for %s', async (_label, outcome) => {
    dictionary.lookupWordStreaming.mockResolvedValue({
      toolName: 'dictionary_lookup',
      model: DICTIONARY_MODEL,
      replySource: 'provider',
      ...outcome
    } as never);

    await capability().fulfill(LOOKUP);

    expect(turnsWithArtifact('dictionary_lookup')[0].model).toBeUndefined();
  });

  it('records no full-entry stamp when no block was generated', async () => {
    dictionary.generateParallelDictionary.mockResolvedValue({
      word: 'liminal',
      result: '# Prose Minion | Writer\'s Dictionary Lookup',
      metadata: { totalDuration: 1, blockDurations: {}, partialFailures: ['definition'], successCount: 0, totalBlocks: 1 },
      modelIds: []
    });

    await capability().fulfill(FULL_ENTRY);

    expect(turnsWithArtifact('dictionary_full_entry')[0].model).toBeUndefined();
  });

  it('leaves capability turns no provider made unstamped', async () => {
    await capability().fulfill({ capability: 'resource.catalog' });

    expect(turnsWithArtifact('resource_catalog')).toHaveLength(1);
    expect(session.getSnapshot().turns.every((turn) => turn.model === undefined)).toBe(true);
  });
});
