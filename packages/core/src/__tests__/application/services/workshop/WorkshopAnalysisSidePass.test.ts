import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink } from '@/platform';

describe('WorkshopAnalysisSidePass', () => {
  it('shares tool invocation and atomically adopts a persona-requested retained report', async () => {
    const service = {
      analyzeWritingTools: jest.fn().mockResolvedValue({
        toolName: 'writing_tools_continuity',
        content: 'Verbatim continuity report.\n\n### Next steps\n- Put the cup back.',
        conversationId: 'continuity-conv'
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({ text: 'The cup moves.', source: { kind: 'manual' } });
    session.setContextBrief('Mara cannot see the cup.');
    session.beginPersonaMessage('host-turn', 'Check continuity.');
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const result = await sidePass.run(
      'continuity',
      excerpt,
      { retainConversation: true },
      'Track the cup.'
    );
    const adoption = sidePass.adoptPersonaReport({
      hostRequestId: 'host-turn',
      excerptVersion: excerpt.version,
      toolId: 'continuity',
      conversationId: result.conversationId,
      details: {
        operation: 'analysis.run',
        status: 'success',
        requestSummary: 'Continuity',
        requestedByPersonaId: 'jill'
      },
      result: {
        capability: 'analysis.run',
        status: 'success',
        requestSummary: 'Continuity',
        content: result.content
      }
    });

    expect(service.analyzeWritingTools).toHaveBeenCalledWith(
      'The cup moves.',
      expect.stringContaining('<persona-requested-analysis-focus>\n\nTrack the cup.'),
      undefined,
      'continuity',
      { retainConversation: true }
    );
    expect(adoption?.turn).toMatchObject({
      artifact: 'tool_report',
      toolId: 'continuity',
      content: 'Verbatim continuity report.\n\n### Next steps\n- Put the cup back.',
      excerptVersion: 1,
      capability: { operation: 'analysis.run', requestedByPersonaId: 'jill' },
      actionableFindings: [
        { key: 'finding-1', ordinal: 1, text: 'Put the cup back.' }
      ]
    });
    expect(session.getToolSidecarConversationId('continuity')).toBe('continuity-conv');
    expect(session.getSnapshot().activeRequestId).toBe('host-turn');
  });

  it('logs malformed findings from both writer and persona-requested reports', () => {
    const service = {
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    session.setExcerpt({ text: 'The cup moves.', source: { kind: 'manual' } });
    const outputChannel = { appendLine: jest.fn() } as unknown as LogSink;
    const sidePass = new WorkshopAnalysisSidePass(service, session, outputChannel);
    const malformed = 'Report.\n\n### Next steps\n- [ ] Rewrite the opening.';

    session.beginToolRun('prose', 'writer-run');
    sidePass.adoptWriterReport({
      requestId: 'writer-run',
      content: malformed,
      conversationId: 'writer-conv',
      toolId: 'prose'
    });

    session.beginPersonaMessage('host-run', 'Check the report.');
    sidePass.adoptPersonaReport({
      hostRequestId: 'host-run',
      excerptVersion: 1,
      toolId: 'prose',
      details: {
        operation: 'analysis.run',
        status: 'success',
        requestSummary: 'Prose',
        requestedByPersonaId: 'jill'
      },
      result: {
        capability: 'analysis.run',
        status: 'success',
        requestSummary: 'Prose',
        content: malformed
      }
    });

    expect((outputChannel.appendLine as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        [expect.stringContaining('Actionable findings rejected (prose writer-requested report; 0 items; reason=invalid_item)')],
        [expect.stringContaining('Actionable findings rejected (prose persona-requested report; 0 items; reason=invalid_item)')]
      ])
    );
  });
});
