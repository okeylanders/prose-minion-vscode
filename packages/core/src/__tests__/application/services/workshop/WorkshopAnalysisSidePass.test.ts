import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopAnalysisSidePass } from '@/application/services/workshop/WorkshopAnalysisSidePass';
import type { AssistantToolService } from '@services/analysis/AssistantToolService';
import type { LogSink } from '@/platform';

describe('WorkshopAnalysisSidePass', () => {
  it('executes a legal persona-selected vacuum run without mutating room inputs', async () => {
    const service = {
      analyzeWritingTools: jest.fn().mockResolvedValue({
        toolName: 'writing_tools_fresh',
        content: 'Vacuum report.',
        conversationId: 'fresh-conv'
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({ text: 'Room passage.', source: { kind: 'manual' } });
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Room note',
      words: 2,
      content: 'Standing context.'
    });
    const beforeExcerpt = session.getExcerpt();
    const beforeAttachments = session.getContextAttachments();
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const result = await sidePass.runWithInputs(
      'fresh',
      {
        excerptText: '',
        provenance: {
          excerpt: {
            mode: 'omit', material: 'omitted', chosenBy: 'Jill', words: 0
          },
          context: {
            mode: 'omit', material: 'omitted', chosenBy: 'Jill', words: 0
          }
        }
      },
      { retainConversation: true }
    );

    expect(service.analyzeWritingTools).toHaveBeenCalledWith(
      '',
      expect.not.stringContaining('Room passage.'),
      undefined,
      'fresh',
      { retainConversation: true, workshopSource: undefined }
    );
    expect(result.content).toBe('Vacuum report.');
    expect(result.inputProvenance).toEqual({
      excerpt: {
        mode: 'omit', material: 'omitted', chosenBy: 'Jill', words: 0
      },
      context: {
        mode: 'omit', material: 'omitted', chosenBy: 'Jill', words: 0
      }
    });
    expect(session.getExcerpt()).toEqual(beforeExcerpt);
    expect(session.getContextAttachments()).toEqual(beforeAttachments);
    expect(excerpt.text).toBe('Room passage.');
  });

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
    session.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Mara note\u2026', words: 6,
      content: 'Mara cannot see the cup.'
    });
    session.beginPersonaMessage('host-turn', 'Check continuity.');
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const result = await sidePass.run(
      'continuity',
      excerpt,
      { retainConversation: true }
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
      expect.stringContaining('<context-attachments count="1">'),
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

  it('threads the configured source and shares the excerpt-source frame with tool runs (Phase 6)', async () => {
    const service = {
      analyzeProse: jest.fn().mockResolvedValue({
        toolName: 'prose_analysis',
        content: 'Prose report.',
        conversationId: 'prose-conv'
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({
      text: 'The cup moves.',
      source: {
        kind: 'editor-selection',
        sourceUri: 'file:///abs/chapters/ch-05.md',
        relativePath: 'chapters/ch-05.md',
        startLine: 3,
        endLine: 9,
        configuredResource: { group: 'chapters', path: 'chapters/ch-05.md' }
      }
    });
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    await sidePass.run('prose', excerpt, { retainConversation: true });

    const [text, context, sourceFileUri, options] = service.analyzeProse.mock.calls[0];
    expect(text).toBe('The cup moves.');
    // The raw file: URI never reaches prompt text; the frame carries provenance.
    expect(sourceFileUri).toBeUndefined();
    expect(context).toContain('<workshop-excerpt-source>');
    expect(context).toContain('Configured resource: [chapters] chapters/ch-05.md');
    expect(context).not.toContain('file://');
    expect(options).toMatchObject({
      retainConversation: true,
      workshopSource: { group: 'chapters', path: 'chapters/ch-05.md' }
    });
  });

  it('appends heading-led delivered-context provenance without corrupting Next steps parsing (Phase 6)', async () => {
    const service = {
      analyzeProse: jest.fn().mockResolvedValue({
        toolName: 'prose_analysis',
        content: 'Report body.\n\n### Next steps\n- Tighten the opening.',
        conversationId: 'prose-conv',
        usedGuides: ['craft/dialogue.md'],
        requestedResources: ['chapters/ch-05.md', 'chapters/ch-06.md']
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({ text: 'The cup moves.', source: { kind: 'manual' } });
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const result = await sidePass.run('prose', excerpt, { retainConversation: true });

    expect(result.content).toContain('### Context delivered to this run');
    expect(result.content).toContain('- Project resources: chapters/ch-05.md, chapters/ch-06.md');
    expect(result.content).toContain('- Craft guides: craft/dialogue.md');
    // The footer's own heading terminates the strict Next-steps section, so
    // the finding still parses and the footer lines never become tasks.
    session.beginToolRun('prose', 'writer-run');
    const completion = sidePass.adoptWriterReport({
      requestId: 'writer-run',
      content: result.content,
      conversationId: 'prose-conv',
      toolId: 'prose'
    });
    expect(completion?.turn.actionableFindings).toEqual([
      expect.objectContaining({ text: 'Tighten the opening.' })
    ]);
  });

  it('returns deterministic input provenance without changing a plain report', async () => {
    const service = {
      analyzeProse: jest.fn().mockResolvedValue({
        toolName: 'prose_analysis',
        content: 'Plain report.',
        conversationId: 'prose-conv'
      }),
      discardConversation: jest.fn()
    } as unknown as jest.Mocked<AssistantToolService>;
    const session = new WorkshopSessionService(() => 3);
    const excerpt = session.setExcerpt({ text: 'The cup moves.', source: { kind: 'manual' } });
    const sidePass = new WorkshopAnalysisSidePass(
      service,
      session,
      { appendLine: jest.fn() } as unknown as LogSink
    );

    const result = await sidePass.run('prose', excerpt, { retainConversation: true });

    expect(result.content).toBe('Plain report.');
    expect(result.inputProvenance).toMatchObject({
      excerpt: { material: 'pinned excerpt v1', mode: 'inherit' },
      context: { material: 'no context attachments', mode: 'inherit' }
    });
  });
});
