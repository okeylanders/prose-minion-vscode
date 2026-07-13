import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  workshopSynthesisCompletionCopy,
  WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { API_KEY_NOT_CONFIGURED_HEADING } from '@messages';

/**
 * The one shared four-branch completion machine (PR #72 review #7). These
 * tests pin the branch contract directly — the handler and side-pass suites
 * exercise it end-to-end.
 */
describe('completeWorkshopRun', () => {
  let session: WorkshopSessionService;
  let events: jest.Mocked<WorkshopRunCompletionEvents>;
  let discardConversation: jest.Mock;
  let log: jest.Mock;

  const result = (content: string, extra: Partial<AnalysisResult> = {}): AnalysisResult => ({
    toolName: 'workshop-test',
    content,
    usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
    ...extra
  } as AnalysisResult);

  const settle = (input: {
    requestId: string;
    result: AnalysisResult;
    aborted?: boolean;
    createsRetainedConversation?: boolean;
  }) => completeWorkshopRun({
    session,
    requestId: input.requestId,
    label: 'Jill',
    result: input.result,
    aborted: input.aborted ?? false,
    createsRetainedConversation: input.createsRetainedConversation ?? true,
    copy: workshopMessageCompletionCopy('Jill'),
    discardConversation,
    log,
    events
  });

  beforeEach(() => {
    session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'A pinned excerpt.' });
    events = {
      streamCompleted: jest.fn(),
      turnCompleted: jest.fn(),
      status: jest.fn(),
      error: jest.fn()
    };
    discardConversation = jest.fn();
    log = jest.fn();
  });

  it('adopts a completed run: content streams only after the session accepts the turn', () => {
    session.beginPersonaMessage('req-1', 'Hello');

    const turn = settle({ requestId: 'req-1', result: result('reply', { conversationId: 'host-conv' }) });

    expect(turn).toMatchObject({ content: 'reply', artifact: 'persona_message' });
    expect(events.streamCompleted).toHaveBeenCalledTimes(1);
    expect(events.streamCompleted).toHaveBeenCalledWith(
      'req-1', 'reply', false, expect.anything(), false
    );
    expect(events.turnCompleted).toHaveBeenCalledWith(expect.objectContaining({ content: 'reply' }));
    expect(session.getHostConversationId()).toBe('host-conv');
  });

  it('attaches strict prioritized proposals to a completed host turn', () => {
    session.beginPersonaMessage('req-1', 'Turn the review into tasks.');

    const turn = settle({
      requestId: 'req-1',
      result: result([
        'The sermon has two revision targets.',
        '',
        '### Next steps',
        '- [high] Replace the beacon image.',
        '- [medium] Audit the gravity metaphor.'
      ].join('\n'), { conversationId: 'host-conv' })
    })!;

    expect(turn.actionableFindings).toEqual([
      {
        key: 'finding-1', ordinal: 1, priority: 'high',
        text: 'Replace the beacon image.'
      },
      {
        key: 'finding-2', ordinal: 2, priority: 'medium',
        text: 'Audit the gravity metaphor.'
      }
    ]);
    const todo = session.addTodoFromFinding(turn.id, 'finding-1');
    expect(todo).toMatchObject({
      priority: 'high',
      source: {
        kind: 'host_turn',
        turnId: turn.id,
        participantLabel: 'Jill',
        personaId: 'jill'
      }
    });
  });

  it('cancelled: discards only a conversation this run created, sends status, and logs', () => {
    session.beginPersonaMessage('req-1', 'Hello');

    const turn = settle({
      requestId: 'req-1',
      result: result('partial', { conversationId: 'fresh-conv' }),
      aborted: true
    });

    expect(turn).toBeUndefined();
    expect(discardConversation).toHaveBeenCalledWith('fresh-conv');
    expect(events.streamCompleted).toHaveBeenCalledWith('req-1', '', true);
    expect(events.status).toHaveBeenCalledWith('Jill cancelled');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('Run cancelled: req-1'));
    expect(session.getSnapshot().activeRequestId).toBeUndefined();
  });

  it('cancelled continuation: never discards the conversation the sidecar/host still owns', () => {
    session.beginPersonaMessage('req-1', 'Hello');

    settle({
      requestId: 'req-1',
      result: result('partial', { conversationId: 'owned-conv' }),
      aborted: true,
      createsRetainedConversation: false
    });

    expect(discardConversation).not.toHaveBeenCalled();
  });

  it('api-key warning: keeps the warning out of the thread and reports the error', () => {
    session.beginPersonaMessage('req-1', 'Hello');

    const turn = settle({
      requestId: 'req-1',
      result: result(`${API_KEY_NOT_CONFIGURED_HEADING}\nConfigure a key.`)
    });

    expect(turn).toBeUndefined();
    expect(events.error).toHaveBeenCalledWith(
      'OpenRouter API key not configured.',
      expect.stringContaining('Configure a key.')
    );
    expect(session.getSnapshot().turns.filter((t) => t.role === 'assistant')).toHaveLength(0);
  });

  it('retention failure: a new host run without a retained conversation is refused', () => {
    session.beginPersonaMessage('req-1', 'Hello');

    const turn = settle({ requestId: 'req-1', result: result('reply') });

    expect(turn).toBeUndefined();
    expect(events.error).toHaveBeenCalledWith(
      "Failed to retain Jill's conversation.",
      'The host response did not return a retained conversation.'
    );
  });

  it('zombie: a refused completion discards, logs, and never streams its content (PR #72 #5/#10)', () => {
    // The session's run was replaced without this controller aborting — the
    // exact stale-completion class the review found silent.
    session.beginPersonaMessage('req-1', 'Hello');
    session.abandonRun('req-1');

    const turn = settle({ requestId: 'req-1', result: result('billed reply', { conversationId: 'fresh-conv' }) });

    expect(turn).toBeUndefined();
    expect(discardConversation).toHaveBeenCalledWith('fresh-conv');
    expect(events.streamCompleted).toHaveBeenCalledTimes(1);
    expect(events.streamCompleted).toHaveBeenCalledWith('req-1', '', true);
    expect(events.turnCompleted).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Discarded zombie completion: req-1 (Jill) — session was reset or the run preempted mid-stream')
    );
  });

  it('centralizes the copy both call sites drifted on', () => {
    expect(workshopSynthesisCompletionCopy('Jill', 'Prose')).toEqual({
      cancelledStatus: "Jill synthesis cancelled; Prose's report remains available.",
      apiKeyMissingError: 'Prose completed, but Jill could not synthesize it because the OpenRouter API key is not configured.',
      retentionFailedError: 'Prose completed, but Jill synthesis could not be retained.'
    });
    expect(workshopMessageCompletionCopy('Prose')).toEqual({
      cancelledStatus: 'Prose cancelled',
      apiKeyMissingError: 'OpenRouter API key not configured.',
      retentionFailedError: "Failed to retain Prose's conversation."
    });
  });
});
