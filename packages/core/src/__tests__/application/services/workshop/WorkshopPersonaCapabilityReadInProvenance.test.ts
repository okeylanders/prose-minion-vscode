/**
 * Read-in provenance as a persona's capabilities record it (ADR 2026-11-03
 * D4). Every family that mints a card names that card on its rows; a call the
 * session refused minted no card, and its rows name none. `resource.read`
 * also records the lines it returned and the whole file's fingerprint, which
 * stays out of the card's metadata and the evidence the persona reads.
 */
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { createHash } from 'crypto';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { AnalysisResult } from '@/domain/models/AnalysisResult';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceContent, ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';
import type { LogSink } from '@/platform';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';

const unusedRecall: WorkshopTranscriptRecallPort = {
  catalog: () => Promise.reject(new Error('recall is not under test here')),
  search: () => Promise.reject(new Error('recall is not under test here')),
  read: () => Promise.reject(new Error('recall is not under test here')),
  todos: () => Promise.reject(new Error('recall is not under test here'))
};

const RABBIT = [
  '# The White Rabbit',
  'Checks his watch.',
  'Late for the Duchess.',
  'Wears a waistcoat.',
  'Carries white gloves.'
].join('\n');

const RABBIT_FILE: ContextResourceContent = {
  group: 'characters',
  path: 'characters/rabbit.md',
  label: 'rabbit.md',
  sizeBytes: Buffer.byteLength(RABBIT, 'utf8'),
  absolutePath: '/workspace/characters/rabbit.md',
  content: RABBIT
};

const sha256 = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');

const ANALYSIS: WorkshopCapabilityRequest = {
  capability: 'analysis.run',
  toolId: 'continuity',
  excerpt: { mode: 'inherit' },
  context: { mode: 'omit' }
};
const LOOKUP: WorkshopCapabilityRequest = {
  capability: 'dictionary.lookup', word: 'tardy', context: 'the Rabbit', purpose: 'tone'
};
const FULL_ENTRY: WorkshopCapabilityRequest = {
  capability: 'dictionary.full-entry', word: 'tardy', context: 'the Rabbit', purpose: 'tone'
};
const READ_RANGE: WorkshopCapabilityRequest = {
  capability: 'resource.read', group: 'characters', path: 'characters/rabbit.md', startLine: 2, endLine: 4
};

describe('persona capability read-in provenance', () => {
  let session: WorkshopSessionService;

  beforeEach(() => {
    session = new WorkshopSessionService(() => 7);
    session.setExcerpt({ text: 'Alice followed the Rabbit.', source: { kind: 'manual' } });
    session.beginPersonaMessage('host-request', 'What does the Rabbit want?');
  });

  const capability = (requestId = 'host-request') => {
    const log = { appendLine: jest.fn() } as unknown as LogSink;
    const assistant = {
      analyzeWritingTools: jest.fn().mockResolvedValue({
        toolName: 'writing_tools_continuity',
        content: 'The watch recurs.',
        timestamp: new Date(0),
        replySource: 'provider'
      } satisfies AnalysisResult),
      discardConversation: jest.fn()
    } as unknown as AssistantToolService;
    const dictionary = {
      lookupWordStreaming: jest.fn().mockResolvedValue({
        toolName: 'dictionary_lookup', content: '# tardy\nLate.', outcome: 'entry', replySource: 'provider'
      }),
      generateParallelDictionary: jest.fn().mockResolvedValue({
        word: 'tardy',
        result: '# Full entry',
        metadata: { totalDuration: 1, blockDurations: {}, partialFailures: [], successCount: 3, totalBlocks: 3 },
        modelIds: [],
        replySource: 'provider'
      })
    } as unknown as DictionaryService;
    const { content: _content, ...summary } = RABBIT_FILE;
    const resourceProviderFactory: ContextResourceProviderFactory = {
      createProvider: jest.fn().mockResolvedValue({
        listResources: () => [summary],
        loadResources: jest.fn().mockResolvedValue([RABBIT_FILE])
      })
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
      requestId,
      excerptVersion: session.getExcerptVersion(),
      personaId: 'jill',
      owner: { kind: 'host' },
      excerpt: session.getExcerpt()!,
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
  };

  it.each<[string, WorkshopCapabilityRequest, string]>([
    ['an analysis', ANALYSIS, 'tool_report'],
    ['a dictionary lookup', LOOKUP, 'dictionary_lookup'],
    ['a full dictionary entry', FULL_ENTRY, 'dictionary_full_entry'],
    ['a resource read', READ_RANGE, 'resource_read']
  ])('names the card that recorded %s', async (_label, request, artifact) => {
    const fulfillment = await capability().fulfill(request);

    const card = session.getSnapshot().turns.find((turn) => turn.artifact === artifact)!;
    expect(card).toBeDefined();
    expect(fulfillment.deliveredSources).toHaveLength(1);
    expect(fulfillment.deliveredSources![0].turnId).toBe(card.id);
    // The card the row names is the card the engine is handed.
    expect(fulfillment.artifacts.map((entry) => entry.id)).toEqual([card.id]);
  });

  it('records the lines a range read returned and the whole file\'s fingerprint', async () => {
    const fulfillment = await capability().fulfill(READ_RANGE);

    expect(fulfillment.deliveredSources).toEqual([expect.objectContaining({
      kind: 'resource',
      configuredResource: { group: 'characters', path: 'characters/rabbit.md' },
      lineRange: { start: 2, end: 4 },
      sourceFingerprint: sha256(RABBIT)
    })]);
  });

  it('records the default window a read returned when it named no lines', async () => {
    const fulfillment = await capability().fulfill({
      capability: 'resource.read', group: 'characters', path: 'characters/rabbit.md'
    });

    expect(fulfillment.deliveredSources![0].lineRange).toEqual({ start: 1, end: 5 });
  });

  it('keeps the fingerprint out of the card\'s metadata and the persona\'s evidence', async () => {
    const fulfillment = await capability().fulfill(READ_RANGE);

    const card = session.getSnapshot().turns.find((turn) => turn.artifact === 'resource_read')!;
    expect(card.capability?.metadata).toMatchObject({ startLine: 2, endLine: 4 });
    expect(JSON.stringify(card)).not.toContain(sha256(RABBIT));
    expect(JSON.stringify(session.getSnapshot())).not.toContain(sha256(RABBIT));
    expect(fulfillment.evidence).not.toContain(sha256(RABBIT));
  });

  it('records no card, and so no turn id, for a call the session refused', async () => {
    // The run on record is another request's: the session refuses the card.
    const fulfillment = await capability('late-request').fulfill(READ_RANGE);

    expect(session.getSnapshot().turns.some((turn) => turn.artifact === 'resource_read')).toBe(false);
    expect(fulfillment.artifacts).toEqual([]);
    expect(fulfillment.deliveredSources).toHaveLength(1);
    expect(fulfillment.deliveredSources![0]).not.toHaveProperty('turnId');
    // What was read is still what was read.
    expect(fulfillment.deliveredSources![0].lineRange).toEqual({ start: 2, end: 4 });
  });

  it('records nothing for a read that failed', async () => {
    const fulfillment = await capability().fulfill({
      capability: 'resource.read', group: 'characters', path: 'characters/rabbit.md', startLine: 40
    });

    expect(fulfillment.deliveredSources).toEqual([]);
  });
});
