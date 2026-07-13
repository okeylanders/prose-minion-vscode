import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { LogSink } from '@/platform';

const usage = { promptTokens: 4, completionTokens: 6, totalTokens: 10, costUsd: 0.001 };

describe('WorkshopPersonaCapability', () => {
  let session: WorkshopSessionService;
  let dictionary: jest.Mocked<DictionaryService>;
  let analysis: jest.Mocked<WorkshopAnalysisSidePass>;
  let events: { status: jest.Mock; turnCompleted: jest.Mock; sessionChanged: jest.Mock };
  let controller: AbortController;
  let log: LogSink;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 7);
    const excerpt = session.setExcerpt({ text: 'The cup crossed the table.' });
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
  });

  const capability = () => new WorkshopPersonaCapabilityFactory(
    dictionary,
    analysis,
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
    const result = await adapter.fulfill({
      capability: 'analysis.run',
      toolId: 'continuity',
      instructions: 'Track the cup.'
    });

    expect(analysis.run).toHaveBeenCalledWith(
      'continuity',
      expect.objectContaining({ version: 1, text: 'The cup crossed the table.' }),
      { signal: controller.signal, retainConversation: true },
      'Track the cup.'
    );
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
});
