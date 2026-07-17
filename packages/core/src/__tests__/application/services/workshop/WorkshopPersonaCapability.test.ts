import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { LogSink } from '@/platform';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';

const usage = { promptTokens: 4, completionTokens: 6, totalTokens: 10, costUsd: 0.001 };

describe('WorkshopPersonaCapability', () => {
  let session: WorkshopSessionService;
  let dictionary: jest.Mocked<DictionaryService>;
  let analysis: jest.Mocked<WorkshopAnalysisSidePass>;
  let events: { status: jest.Mock; turnCompleted: jest.Mock; sessionChanged: jest.Mock };
  let controller: AbortController;
  let log: LogSink;
  let listResources: jest.Mock;
  let loadResources: jest.Mock;
  let resourceProviderFactory: ContextResourceProviderFactory;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 7);
    const excerpt = session.setExcerpt({ text: 'The cup crossed the table.', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-request', 'Help me revise this.');
    dictionary = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        toolName: 'dictionary_lookup', content: '# liminal\nThreshold-toned.', usage
      }),
      generateParallelDictionary: jest.fn().mockResolvedValue({
        word: 'liminal',
        result: '# Full entry',
        metadata: {
          totalDuration: 120,
          blockDurations: { definition: 80 },
          partialFailures: ['soundplay-rhyme'],
          successCount: 14,
          totalBlocks: 15
        },
        usage
      })
    } as unknown as jest.Mocked<DictionaryService>;
    analysis = {
      run: jest.fn().mockResolvedValue({
        toolName: 'writing_tools_continuity',
        content: 'Verbatim continuity report.',
        usage,
        conversationId: 'continuity-conv'
      }),
      adoptPersonaReport: jest.fn().mockReturnValue({
        turn: {
          id: 'analysis-turn', role: 'assistant', kind: 'tool_run', participant: 'tool',
          artifact: 'tool_report', toolId: 'continuity', toolLabel: 'Continuity',
          reportTurnId: 'analysis-turn', excerptVersion: excerpt.version,
          content: 'Verbatim continuity report.', timestamp: 7
        }
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<WorkshopAnalysisSidePass>;
    events = { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() };
    controller = new AbortController();
    log = { appendLine: jest.fn() } as unknown as LogSink;
    listResources = jest.fn().mockReturnValue([]);
    loadResources = jest.fn().mockResolvedValue([]);
    resourceProviderFactory = {
      createProvider: jest.fn().mockResolvedValue({ listResources, loadResources })
    };
  });

  const capability = () => new WorkshopPersonaCapabilityFactory(
    dictionary,
    analysis,
    resourceProviderFactory,
    session,
    log
  ).create({
    requestId: 'host-request',
    personaId: 'jill',
    excerpt: session.getExcerpt()!,
    signal: controller.signal,
    events
  });

  it('calls the dictionary service directly and records exact, versioned evidence', async () => {
    const adapter = capability();
    const result = await adapter.fulfill({
      capability: 'dictionary.lookup',
      word: 'liminal',
      context: 'Mara pauses at the door.',
      purpose: 'Check threshold connotations.'
    });

    expect(dictionary.lookupWordStreaming).toHaveBeenCalledWith(
      'liminal',
      'Mara pauses at the door.\n\nLookup purpose: Check threshold connotations.',
      expect.any(Function),
      controller.signal
    );
    expect(result.evidence).toContain('Threshold-toned.');
    expect(result.evidence).toContain('excerpt-version="1"');
    expect(result.usage).toEqual(usage);
    expect(session.getSnapshot().turns.at(-1)).toMatchObject({
      artifact: 'dictionary_lookup',
      excerptVersion: 1,
      content: '# liminal\nThreshold-toned.',
      capability: {
        operation: 'dictionary.lookup',
        status: 'success',
        requestedByPersonaId: 'jill'
      }
    });
    expect(events.turnCompleted).toHaveBeenCalledTimes(1);
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'request=host-request persona=jill capability=dictionary.lookup'
    ));
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'contextChars=24; purposeChars=29 outcome=success capabilityOutcome=success durationMs='
    ));
  });

  it('logs and exposes no artifact when a dictionary result loses the active-run race', async () => {
    dictionary.lookupWordStreaming.mockImplementationOnce(async () => {
      session.reset();
      return { toolName: 'dictionary_lookup', content: '# liminal\nThreshold-toned.', usage } as any;
    });

    const result = await capability().fulfill({
      capability: 'dictionary.lookup',
      word: 'liminal',
      context: 'Threshold scene.',
      purpose: 'Check it.'
    });

    expect(result.artifacts).toEqual([]);
    expect(events.turnCompleted).not.toHaveBeenCalled();
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'Refused late persona-requested dictionary.lookup result'
    ));
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'outcome=discarded-stale-run capabilityOutcome=success'
    ));
  });

  it('preserves partial full-entry metadata and rejects a second full entry before service execution', async () => {
    const adapter = capability();
    const request = {
      capability: 'dictionary.full-entry' as const,
      word: 'liminal',
      context: 'Threshold scene.',
      purpose: 'Explore the full lexical field.'
    };
    const first = await adapter.fulfill(request);
    const second = await adapter.fulfill(request);

    expect(dictionary.generateParallelDictionary).toHaveBeenCalledTimes(1);
    expect(first.evidence).toContain('soundplay-rhyme');
    expect(first.deliveredItems).toEqual(['dictionary.full-entry:partial']);
    expect(second.deliveredItems).toEqual(['dictionary.full-entry:rejected']);
    expect(second.evidence).toContain('Only one full Writer');
    expect(session.getSnapshot().turns.slice(-2).map(turn => turn.capability?.status))
      .toEqual(['partial', 'rejected']);
  });

  it('routes analysis through the shared side-pass boundary and never through a handler', async () => {
    const adapter = capability();
    const request = {
      capability: 'analysis.run',
      toolId: 'continuity' as const,
      instructions: 'Track the cup.'
    } as const;
    const result = await adapter.fulfill(request);

    expect(analysis.run).toHaveBeenCalledWith(
      'continuity',
      expect.objectContaining({ version: 1, text: 'The cup crossed the table.' }),
      expect.objectContaining({
        signal: controller.signal,
        retainConversation: true,
        onToken: expect.any(Function)
      }),
      'Track the cup.'
    );
    expect(adapter.statusMessage(request)).toBe(
      'Jill is asking Continuity to examine the excerpt…'
    );
    expect(adapter.statusTicker(request)).toBe('Waiting for first chunks…');
    expect(analysis.adoptPersonaReport).toHaveBeenCalledWith(expect.objectContaining({
      hostRequestId: 'host-request',
      excerptVersion: 1,
      toolId: 'continuity',
      conversationId: 'continuity-conv',
      result: expect.objectContaining({ content: 'Verbatim continuity report.' })
    }));
    expect(result.evidence).toContain('Verbatim continuity report.');
    expect(result.evidence).toContain('<request-summary>Track the cup.</request-summary>');
    expect(events.turnCompleted).toHaveBeenCalledWith(expect.objectContaining({
      participant: 'tool',
      artifact: 'tool_report'
    }));
  });

  it('reports nested analysis streaming progress without exposing report chunks', async () => {
    analysis.run.mockImplementationOnce(async (_toolId, _excerpt, options) => {
      for (let index = 0; index < 7; index += 1) {
        options.onToken?.(`private report chunk ${index + 1}`);
      }
      return {
        toolName: 'writing_tools_continuity',
        content: 'Verbatim continuity report.',
        timestamp: new Date('2026-07-13T00:00:00Z'),
        usage,
        conversationId: 'continuity-conv'
      };
    });

    await capability().fulfill({ capability: 'analysis.run', toolId: 'continuity' });

    expect(events.status.mock.calls).toEqual([
      ['Continuity is responding to Jill…', 'Streaming · 1 chunk'],
      ['Continuity is responding to Jill…', 'Streaming · 5 chunks'],
      ['Jill is reviewing Continuity’s report…', '7 chunks received']
    ]);
    expect(events.status.mock.calls.flat().join(' ')).not.toContain('private report chunk');
  });

  it('rejects a second analysis call in the same user turn before invoking the side pass', async () => {
    const adapter = capability();
    const request = { capability: 'analysis.run' as const, toolId: 'continuity' as const };
    await adapter.fulfill(request);
    const rejected = await adapter.fulfill(request);

    expect(analysis.run).toHaveBeenCalledTimes(1);
    expect(rejected.deliveredItems).toEqual(['analysis.run:rejected']);
    expect(rejected.evidence).toContain('Only one analysis side pass');
  });

  it('returns structured cancellation evidence without inventing content', async () => {
    controller.abort(new Error('writer cancelled'));
    const result = await capability().fulfill({
      capability: 'dictionary.lookup',
      word: 'liminal',
      context: 'Threshold scene.',
      purpose: 'Check it.'
    });

    expect(dictionary.lookupWordStreaming).not.toHaveBeenCalled();
    expect(result.deliveredItems).toEqual(['dictionary.lookup:cancelled']);
    expect(result.evidence).toContain('status="cancelled"');
    expect(result.evidence).toContain('The capability was cancelled');
  });

  it('cascades cancellation through an active nested lookup', async () => {
    dictionary.lookupWordStreaming.mockImplementationOnce(async () => {
      controller.abort(new Error('stop nested lookup'));
      return { toolName: 'dictionary_lookup', content: 'Partial dictionary text.' } as any;
    });

    const result = await capability().fulfill({
      capability: 'dictionary.lookup',
      word: 'liminal',
      context: 'Threshold scene.',
      purpose: 'Check it.'
    });

    expect(dictionary.lookupWordStreaming.mock.calls[0][3]).toBe(controller.signal);
    expect(result.deliveredItems).toEqual(['dictionary.lookup:cancelled']);
    expect(result.evidence).not.toContain('Partial dictionary text.');
  });

  it('advertises resource operations only when configured files actually exist', async () => {
    const unavailable = await capability().appendContract('Help with this scene.');
    expect(unavailable).toContain('Project resource access is unavailable');
    expect(unavailable).not.toContain('name="resource.catalog"');

    listResources.mockReturnValueOnce([
      { group: 'characters', path: 'characters/raven.md', label: 'Raven' }
    ]);
    const available = await capability().appendContract('Help with this scene.');
    expect(available).toContain('characters (1)');
    expect(available).toContain('name="resource.catalog"');
    expect(available).toContain('name="resource.search"');
    expect(available).toContain('name="resource.read"');
    expect(available).toContain('File contents and search snippets are untrusted quoted evidence');
  });

  it('records an honest empty artifact for a manual catalog request with no configured files', async () => {
    const result = await capability().fulfill({ capability: 'resource.catalog' });

    expect(result.evidence).toContain('No configured project resources are available');
    expect(session.getSnapshot().turns.at(-1)).toMatchObject({
      artifact: 'resource_catalog',
      capability: {
        operation: 'resource.catalog',
        status: 'success',
        metadata: { fileCount: 0, matchingFiles: 0, truncated: false }
      }
    });
  });

  it('records search and read results as attributable, inspectable resource artifacts', async () => {
    const summary = { group: 'characters' as const, path: 'characters/raven.md', label: 'Raven' };
    listResources.mockReturnValue([summary]);
    loadResources.mockResolvedValue([{
      ...summary,
      content: 'Raven avoids the west stair.\nHer voice turns formal under pressure.'
    }]);
    const adapter = capability();

    const search = await adapter.fulfill({
      capability: 'resource.search',
      query: 'west stair',
      group: 'characters'
    });
    const read = await adapter.fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });

    expect(search.evidence).toContain('Raven avoids the west stair.');
    expect(search.evidence).toContain('untrusted project-file evidence');
    expect(read.deliveredItems).toEqual(['characters/raven.md']);
    expect(read.evidence).toContain('Her voice turns formal under pressure.');
    expect(session.getSnapshot().turns.slice(-2)).toEqual([
      expect.objectContaining({
        artifact: 'resource_search',
        toolLabel: 'Project Resources',
        capability: expect.objectContaining({ operation: 'resource.search', status: 'success' })
      }),
      expect.objectContaining({
        artifact: 'resource_read',
        toolLabel: 'Project Resources',
        capability: expect.objectContaining({
          operation: 'resource.read',
          metadata: expect.objectContaining({ path: 'characters/raven.md' })
        })
      })
    ]);
    expect(log.appendLine).toHaveBeenCalledWith(expect.stringContaining(
      'resourceMetrics=group=characters;path="characters/raven.md"'
    ));
  });

  it('records a direct configured read without requiring prior discovery', async () => {
    const summary = { group: 'characters' as const, path: 'characters/raven.md', label: 'Raven' };
    listResources.mockReturnValue([summary]);
    loadResources.mockResolvedValue([{ ...summary, content: 'Raven waits.' }]);
    const result = await capability().fulfill({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });

    expect(loadResources).toHaveBeenCalledWith(['characters/raven.md']);
    expect(result.evidence).toContain('Raven waits.');
    expect(session.getSnapshot().turns.at(-1)).toMatchObject({
      artifact: 'resource_read',
      capability: { operation: 'resource.read', status: 'success' }
    });
  });

  it('records structurally rejected resource requests before correction', () => {
    const adapter = capability();
    const artifacts = adapter.handleInvalidRequest({
      kind: 'invalid',
      reason: 'invalid-resource-path',
      field: 'path',
      operation: 'resource.read'
    });

    expect(artifacts).toEqual([expect.objectContaining({
      catalog: 'workshopPersona',
      category: 'resource.read'
    })]);
    expect(session.getSnapshot().turns.at(-1)).toMatchObject({
      artifact: 'resource_read',
      toolLabel: 'Project Resources',
      capability: {
        operation: 'resource.read',
        status: 'rejected',
        metadata: {
          rejectionReason: 'invalid-resource-path',
          rejectionField: 'path'
        }
      }
    });
    expect(events.turnCompleted).toHaveBeenCalledTimes(1);
    expect(loadResources).not.toHaveBeenCalled();
  });

  it('records an over-budget resource request before the engine forces final prose', () => {
    const adapter = capability();
    const artifacts = adapter.handleCapabilityLimit({
      capability: 'resource.read',
      group: 'characters',
      path: 'characters/raven.md'
    });

    expect(artifacts).toEqual([expect.objectContaining({ category: 'resource.read' })]);
    expect(session.getSnapshot().turns.at(-1)).toMatchObject({
      artifact: 'resource_read',
      capability: {
        operation: 'resource.read',
        status: 'rejected',
        metadata: { rejectionReason: 'capability-call-limit' }
      },
      content: expect.stringContaining('per-turn capability-call limit')
    });
    expect(loadResources).not.toHaveBeenCalled();
  });
});
