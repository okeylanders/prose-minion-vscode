import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  type WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopReplyMemoryContext } from '@/application/services/workshop/memory/WorkshopReplyMemory';
import { workshopMemoryProposalPhrasingFault } from '@/application/services/workshop/memory/WorkshopMemoryProposalPhrasing';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { sanitizeWorkshopReplyForRetention, WORKSHOP_MEMORY_ONLY_REPLY_LINE } from '@/utils/workshopReplyControls';
import { memoryFrame, WIDGET } from '@/__tests__/application/services/workshop/memory/memoryProposalFixtures';
import { offProjectMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryTestPorts';
import { WorkshopPersonaCapabilityFactory } from '@/application/services/workshop/WorkshopPersonaCapability';
import type { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { DictionaryService } from '@services/dictionary/DictionaryService';
import type { ContextResourceProviderFactory } from '@/domain/models/ContextGeneration';
import type { WorkshopTranscriptRecallPort } from '@/application/services/workshop/recall/WorkshopTranscriptRecallCapability';

/**
 * Run completion owns the reply's tail (ADR 2026-11-04 D6, D8, D9; PR #192
 * F-01): a proposal becomes a card, never reply text; the persona's retained
 * history never holds it; and no memory text reaches any log line.
 */

const SENTINEL = 'ZZQ-SENTINEL';
const sentinelFrame = (extra: { supersedes?: string[]; kind?: string; title?: string } = {}): string => memoryFrame({
  title: extra.title ?? `Title ${SENTINEL}`,
  summary: `Summary ${SENTINEL}`,
  body: `Body ${SENTINEL}`,
  kind: extra.kind,
  supersedes: extra.supersedes
});

const OPEN: WorkshopReplyMemoryContext = {
  open: true,
  listed: new Map([['mem-1a9e04', 'The Rabbit\'s watch stops at six']])
};

describe('completeWorkshopRun with a project-memory trailer', () => {
  let session: WorkshopSessionService;
  let events: jest.Mocked<WorkshopRunCompletionEvents>;
  let log: jest.Mock;

  const result = (content: string): AnalysisResult => ({
    toolName: 'workshop-test',
    content,
    conversationId: 'host-conv',
    timestamp: new Date(0),
    usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    replySource: 'provider',
    model: { scope: 'assistant', requestedModelId: 'openrouter/model-a', servedModelIds: ['openrouter/model-a'] }
  } as AnalysisResult);

  const settle = (content: string, memory?: WorkshopReplyMemoryContext) => {
    session.beginPersonaMessage('req-1', 'So it is settled.');
    return completeWorkshopRun({
      session,
      requestId: 'req-1',
      label: 'Jill',
      result: result(content),
      aborted: false,
      createsRetainedConversation: true,
      copy: workshopMessageCompletionCopy('Jill'),
      discardConversation: jest.fn(),
      readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
      memory,
      log,
      events
    });
  };

  const logged = (): string => log.mock.calls.map(([line]) => String(line)).join('\n');

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'A pinned excerpt.', source: { kind: 'manual' } });
    events = {
      streamCompleted: jest.fn(),
      turnCompleted: jest.fn(),
      status: jest.fn(),
      error: jest.fn(),
      widgetRecommendationRejected: jest.fn()
    };
    log = jest.fn();
  });

  it('a valid trailer becomes a pending card; the bubble shows only the prose', () => {
    const turn = settle(`Good.\n\n${memoryFrame({ supersedes: ['mem-1a9e04', 'mem-ffffff'] })}`, OPEN)!;
    expect(turn.content).toBe('Good.');
    expect(turn.memoryProposals).toEqual([{
      proposes: 'new',
      title: 'The Rabbit\'s watch runs backward',
      kind: 'canon',
      summary: 'From chapter 3 on, the White Rabbit\'s watch runs backward.',
      body: 'We settled this while working the tea-party scene.',
      supersedes: [{ id: 'mem-1a9e04', title: 'The Rabbit\'s watch stops at six' }],
      droppedSupersedes: 1,
      state: 'pending'
    }]);
    expect(events.streamCompleted).toHaveBeenCalledWith('req-1', 'Good.', false, expect.anything(), false);
    expect(turn.model).toBeDefined();
  });

  it('a card and a widget recommendation stand together when the memory frame is last', () => {
    const turn = settle(`Good.\n\n${WIDGET}\n\n${memoryFrame()}`, OPEN)!;
    expect(turn.memoryProposals?.[0]?.state).toBe('pending');
    expect(turn.widgetRecommendation?.widgetId).toBe('gesture-playground');
    expect(turn.content).toBe('Good.');
  });

  it('a proposal-only reply shows the host line and is not attributed to a model', () => {
    const turn = settle(memoryFrame(), OPEN)!;
    expect(turn.content).toBe(WORKSHOP_MEMORY_ONLY_REPLY_LINE);
    expect(turn.model).toBeUndefined();
    expect(turn.memoryProposals?.[0]?.state).toBe('pending');
    expect(sanitizeWorkshopReplyForRetention(memoryFrame())).toBe(WORKSHOP_MEMORY_ONLY_REPLY_LINE);
  });

  it('memory off: the trailer is stripped and dropped with a log line and no card', () => {
    const turn = settle(`Good.\n\n${memoryFrame()}`, { open: false })!;
    expect(turn.content).toBe('Good.');
    expect(turn.memoryProposals).toBeUndefined();
    expect(logged()).toContain('Memory proposal dropped (reason=memory-off) (Jill)');
  });

  it('no context at all reads as off', () => {
    expect(settle(`Good.\n\n${memoryFrame()}`)!.memoryProposals).toBeUndefined();
  });

  it('a listing that could not be read drops every supersedes, counted', () => {
    const turn = settle(`Good.\n\n${memoryFrame({ supersedes: ['mem-1a9e04'] })}`, { open: true })!;
    expect(turn.memoryProposals?.[0]).toMatchObject({ droppedSupersedes: 1 });
    expect(turn.memoryProposals?.[0]).not.toHaveProperty('supersedes');
  });

  it('a guest persona\'s reply carries the card too', () => {
    session.adoptPersonaGuest('felix', 'felix-conv', []);
    session.beginPersonaGuestMessage('felix', 'req-g', 'Felix, thoughts?');
    const turn = completeWorkshopRun({
      session,
      requestId: 'req-g',
      label: 'Felix',
      result: { ...result(`Yes.\n\n${memoryFrame()}`), conversationId: 'felix-conv' } as AnalysisResult,
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Felix'),
      discardConversation: jest.fn(),
      readRetainedHistory: jest.fn(() => ({ messageCount: 2, contextSourceCount: 0 })),
      memory: OPEN,
      log,
      events
    })!;
    expect(turn.participant).toBe('guest');
    expect(turn.memoryProposals?.[0]?.state).toBe('pending');
  });

  it('several trailers become several cards, in order; a malformed one drops only itself, logged by reason (Slice 6b)', () => {
    const turn = settle(`Good.\n\n${memoryFrame({ title: 'One' })}\n${memoryFrame({ title: 'Bad', kind: 'secret' })}\n${memoryFrame({ title: 'Two', kind: 'idea' })}`, OPEN)!;
    expect(turn.content).toBe('Good.');
    expect(turn.memoryProposals?.map((proposal) => [proposal.proposes, proposal.title, proposal.kind, proposal.state])).toEqual([
      ['new', 'One', 'canon', 'pending'],
      ['new', 'Two', 'idea', 'pending']
    ]);
    expect(logged()).toContain('Memory proposal dropped (reason=malformed:invalid-kind) (Jill)');
    expect(log.mock.calls.filter(([line]) => String(line).startsWith('Memory proposal pending'))).toHaveLength(2);
  });

  it('the phrasing fence withholds one card of several, and keeps the rest', () => {
    const turn = settle(`Good.\n\n${memoryFrame({ title: 'One' })}\n${memoryFrame({ title: 'Two', body: 'You seem anxious about the ending lately.' })}`, OPEN)!;
    expect(turn.memoryProposals?.map((proposal) => proposal.title)).toEqual(['One']);
    expect(logged()).toContain('Memory proposal withheld (reason=personal-inference)');
  });

  it('a reply whose every trailer was dropped carries no list, never an empty one', () => {
    const turn = settle(`Good.\n\n${memoryFrame({ kind: 'secret' })}\n${memoryFrame({ title: 'Two', kind: 'secret' })}`, OPEN)!;
    expect(turn.memoryProposals).toBeUndefined();
  });

  describe('the phrasing fence (D9)', () => {
    it('withholds a writer-directed personal inference, logged by reason', () => {
      const turn = settle(`Good.\n\n${memoryFrame({ body: 'You seem anxious about the ending lately.' })}`, OPEN)!;
      expect(turn.memoryProposals).toBeUndefined();
      expect(logged()).toContain('Memory proposal withheld (reason=personal-inference)');
    });

    it('keeps a character\'s feelings, which are canon', () => {
      const turn = settle(`Good.\n\n${memoryFrame({ body: 'Alice is anxious at the trial; her grief for Dinah shows.' })}`, OPEN)!;
      expect(turn.memoryProposals?.[0]?.state).toBe('pending');
    });

    it('reads "the writer", the second person and the About-you name', () => {
      expect(workshopMemoryProposalPhrasingFault({ title: 'T', summary: 'The writer is going through a divorce.', body: '' })).toBe('personal-inference');
      expect(workshopMemoryProposalPhrasingFault({ title: 'T', summary: 'S', body: 'Your health comes first.' })).toBe('personal-inference');
      expect(workshopMemoryProposalPhrasingFault({ title: 'T', summary: 'Okeymo mentioned therapy.', body: '' }, 'Okeymo')).toBe('personal-inference');
      expect(workshopMemoryProposalPhrasingFault({ title: 'T', summary: 'You prefer structure before line edits.', body: '' })).toBeUndefined();
      expect(workshopMemoryProposalPhrasingFault({ title: 'T', summary: 'The Duchess is ill in chapter 6.', body: '' })).toBeUndefined();
    });
  });

  describe('no memory text in any diagnostic (PR #192 F-01)', () => {
    const outcomes: Array<[string, string, WorkshopReplyMemoryContext]> = [
      ['both valid', `Good.\n\n${WIDGET}\n\n${sentinelFrame({ supersedes: ['mem-1a9e04'] })}`, OPEN],
      ['misplaced', `Good.\n\n${sentinelFrame()}\n\n${WIDGET}`, OPEN],
      ['duplicate', `Good.\n\n${sentinelFrame()}\n${sentinelFrame()}`, OPEN],
      ['several, one malformed', `Good.\n\n${sentinelFrame()}\n${sentinelFrame({ kind: 'secret', title: `Other ${SENTINEL}` })}\n${sentinelFrame({ title: `Third ${SENTINEL}` })}`, OPEN],
      ['malformed', `Good.\n\n${sentinelFrame({ kind: 'secret' })}`, OPEN],
      ['unclosed', `Good.\n\n<prose-minion-memory-proposal><title>${SENTINEL}</title>`, OPEN],
      ['memory off', `Good.\n\n${sentinelFrame()}`, { open: false }],
      ['control only', sentinelFrame(), OPEN],
      ['withheld', `Good.\n\n${memoryFrame({ title: SENTINEL, body: `You seem anxious. ${SENTINEL}` })}`, OPEN],
      ['provenance named', `Good.\n\n${memoryFrame({ title: SENTINEL, extra: `<source-session>${SENTINEL}</source-session>` })}`, OPEN],
      ['supersedes sentinel', `Good.\n\n${memoryFrame({ title: SENTINEL, supersedes: [SENTINEL] })}`, OPEN]
    ];

    it.each(outcomes)('%s: the sentinel never reaches a log line', (_name, reply, memory) => {
      settle(reply, memory);
      expect(log).toHaveBeenCalled();
      expect(logged()).not.toContain(SENTINEL);
    });

    it('the widget-rejection dump reads the redacted copy', () => {
      const badWidget = WIDGET.replace('gesture-playground', 'no-such-widget');
      settle(`Good.\n\n${badWidget}\n\n${sentinelFrame()}`, OPEN);
      expect(logged()).toContain('Rejected widget recommendation response');
      expect(logged()).toContain('[project memory proposal removed]');
      expect(logged()).not.toContain(SENTINEL);
    });

    it('the actionable-findings log reads the rest, never the frame', () => {
      settle(`Good.\n\n### Next steps\n- [high] Tighten the trial.\n\n${sentinelFrame()}`, OPEN);
      expect(logged()).toContain('Actionable findings accepted: 1 items');
      expect(logged()).not.toContain(SENTINEL);
    });
  });
});

describe('the persona capability\'s log redaction (ADR 2026-11-04 D9)', () => {
  it('replaces every proposal in what the engine\'s rejected-response dump logs', () => {
    const session = new WorkshopSessionService(() => 1);
    const capability = new WorkshopPersonaCapabilityFactory(
      {} as DictionaryService,
      {} as WorkshopAnalysisSidePass,
      { createProvider: jest.fn() } as unknown as ContextResourceProviderFactory,
      session,
      { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() },
      {} as WorkshopTranscriptRecallPort,
      offProjectMemory
    ).create({
      requestId: 'r', excerptVersion: 0, personaId: 'jill', owner: { kind: 'host' },
      signal: new AbortController().signal,
      events: { status: jest.fn(), turnCompleted: jest.fn(), sessionChanged: jest.fn() }
    });
    const logged = capability.redactPrivateControls(`Good.\n\n${sentinelFrame()}`);
    expect(logged).toBe('Good.\n\n[project memory proposal removed]');
    expect(logged).not.toContain(SENTINEL);
  });
});

