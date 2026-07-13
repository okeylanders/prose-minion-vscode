import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink } from '@/platform';

describe('WorkshopAnalysisSidePass', () => {
  it('shares tool invocation and atomically adopts a persona-requested retained report', async () => {
    const service = {
      analyzeWritingTools: jest.fn().mockResolvedValue({
        toolName: 'writing_tools_continuity',
        content: 'Verbatim continuity report.',
        conversationId: 'continuity-conv'
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({ text: 'The cup moves.' });
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
      content: 'Verbatim continuity report.',
      excerptVersion: 1,
      capability: { operation: 'analysis.run', requestedByPersonaId: 'jill' }
    });
    expect(session.getToolSidecarConversationId('continuity')).toBe('continuity-conv');
    expect(session.getSnapshot().activeRequestId).toBe('host-turn');
  });
});
