import {
  MessageType
} from '@messages';
import {
  analysisResult,
  message,
  createWorkshopHandlerTestHarness
} from './WorkshopHandlerTestHarness';
import type { WorkshopHandlerTestHarness } from './WorkshopHandlerTestHarness';

describe('WorkshopHandler routing — todo owner', () => {
  let session: WorkshopHandlerTestHarness['session'];
  let postMessage: WorkshopHandlerTestHarness['postMessage'];
  let log: WorkshopHandlerTestHarness['log'];
  let service: WorkshopHandlerTestHarness['service'];
  let router: WorkshopHandlerTestHarness['router'];
  let posted: WorkshopHandlerTestHarness['posted'];
  let pin: WorkshopHandlerTestHarness['pin'];
  let runProse: WorkshopHandlerTestHarness['runProse'];

  beforeEach(() => {
    ({
      session,
      postMessage,
      log,
      service,
      router,
      posted,
      pin,
      runProse
    } = createWorkshopHandlerTestHarness());
  });

  it('promotes only a structured report finding and attributes it on the next host turn', async () => {
    service.analyzeProse.mockResolvedValue(analysisResult(
      'Report body.\n\n### Next steps\n- Tighten the first paragraph.',
      { conversationId: 'tool-conv' }
    ));
    await pin();
    await runProse();
    const report = session.getSnapshot().turns.find((turn) => turn.artifact === 'tool_report')!;

    await router.route(message(MessageType.WORKSHOP_TODO_ACTION, {
      action: 'add',
      sourceTurnId: report.id,
      findingKey: 'finding-1'
    }) as any);
    const todo = session.getSnapshot().todos[0];
    expect(todo).toMatchObject({
      text: 'Tighten the first paragraph.',
      source: { kind: 'tool_report', toolId: 'prose', turnId: report.id }
    });
    expect(log.appendLine).toHaveBeenCalledWith(
      expect.stringContaining(`Task action applied (add, sourceTurnId=${report.id}, findingKey=finding-1`)
    );

    service.continueConversation.mockClear();
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'What should we do next?' }
    ) as any);
    const delivered = service.continueConversation.mock.calls[0][1] as string;
    expect(delivered).toContain('Task: Tighten the first paragraph.');
    expect(delivered).toContain('Source participant: Prose');
    expect(delivered).toContain('Source tool id: prose');
    expect(delivered).toContain(`Source turn: ${report.id}`);
    expect(delivered).toContain('Status: open');
  });

  it('lets the host propose prioritized tasks from the full report with upstream provenance', async () => {
    service.analyzeProse.mockResolvedValue(analysisResult(
      'Priority assessment: HIGH replace the beacon; MEDIUM audit gravity.',
      { conversationId: 'tool-conv' }
    ));
    service.startWorkshopPersonaConversation.mockResolvedValue(analysisResult([
      'The report points to a clear revision order.',
      '',
      '### Next steps',
      '- [high] Replace the beacon image.',
      '- [medium] Audit the gravity metaphor.'
    ].join('\n'), { conversationId: 'host-conv' }));
    await pin();
    await runProse();

    const snapshot = session.getSnapshot();
    const report = snapshot.turns.find((turn) => turn.artifact === 'tool_report')!;
    const synthesis = snapshot.turns.find((turn) => turn.artifact === 'persona_synthesis')!;
    expect(synthesis.actionableFindings).toEqual([
      {
        key: 'finding-1', ordinal: 1, priority: 'high',
        text: 'Replace the beacon image.'
      },
      {
        key: 'finding-2', ordinal: 2, priority: 'medium',
        text: 'Audit the gravity metaphor.'
      }
    ]);

    await router.route(message(MessageType.WORKSHOP_TODO_ACTION, {
      action: 'add',
      sourceTurnId: synthesis.id,
      findingKey: 'finding-1'
    }) as any);
    expect(session.getSnapshot().todos[0]).toMatchObject({
      priority: 'high',
      source: {
        kind: 'host_turn',
        turnId: synthesis.id,
        participantLabel: 'Jill',
        personaId: 'jill',
        upstreamReportTurnId: report.id
      }
    });

    service.continueConversation.mockClear();
    await router.route(message(
      MessageType.WORKSHOP_SEND_MESSAGE,
      { text: 'Which task comes first?' }
    ) as any);
    const evidence = service.continueConversation.mock.calls[0][1] as string;
    expect(evidence).toContain('Source kind: host_turn');
    expect(evidence).toContain('Source participant: Jill');
    expect(evidence).toContain(`Source turn: ${synthesis.id}`);
    expect(evidence).toContain(`Upstream tool report: ${report.id}`);
  });

  it('rejects task promotion when the report did not expose the exact finding', async () => {
    await pin();
    await runProse();
    const report = session.getSnapshot().turns.find((turn) => turn.artifact === 'tool_report')!;
    postMessage.mockClear();

    await router.route(message(MessageType.WORKSHOP_TODO_ACTION, {
      action: 'add',
      sourceTurnId: report.id,
      findingKey: 'finding-1'
    }) as any);

    expect(session.getSnapshot().todos).toEqual([]);
    expect(posted(MessageType.ERROR)[0].payload).toMatchObject({ source: 'workshop.todo' });
  });

  it('rejects malformed task actions before attempting a session mutation', async () => {
    postMessage.mockClear();
    (log.appendLine as jest.Mock).mockClear();

    await router.route(message(MessageType.WORKSHOP_TODO_ACTION, {
      action: 'complete'
    }) as any);

    expect(posted(MessageType.ERROR)[0].payload).toMatchObject({
      source: 'workshop.todo',
      message: 'Task action must include an id'
    });
    expect(log.appendLine).toHaveBeenCalledWith(
      '[WorkshopTodoHandler] ERROR [workshop.todo]: Task action must include an id'
    );
    expect(log.appendLine).not.toHaveBeenCalledWith(
      expect.stringContaining('Task action applied')
    );
  });
});
