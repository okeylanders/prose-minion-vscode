import {
  completeWorkshopRun,
  workshopMessageCompletionCopy,
  workshopSynthesisCompletionCopy,
  WorkshopRunCompletionEvents
} from '@/application/services/workshop/WorkshopRunCompletion';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { AnalysisResult } from '@/domain/models/AnalysisResult';
import { API_KEY_NOT_CONFIGURED_HEADING } from '@messages';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

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

  const widgetRecommendationFrame = (overrides: {
    widgetId?: string;
    targetPhrase?: string;
    writerInstructions?: string;
    surroundingContext?: string;
    sourceReferences?: string;
    characterNotes?: string;
  } = {}): string => [
    '### Try a widget',
    '<workshop-widget-recommendation version="1">',
    '<widget-id>',
    overrides.widgetId ?? 'gesture-playground',
    '</widget-id>',
    '<target-phrase>',
    overrides.targetPhrase ?? 'His eyes stretched wide.',
    '</target-phrase>',
    '<writer-instructions>',
    overrides.writerInstructions
      ?? 'Preserve recognition breaking through control.\nExplore stillness, breath, and a plausible misreading by Nate.',
    '</writer-instructions>',
    '<surrounding-context>',
    overrides.surroundingContext
      ?? 'Micah looked past Jasper.\nHis eyes stretched wide.\nNate turned but saw nothing.',
    '</surrounding-context>',
    '<source-references>',
    overrides.sourceReferences ?? 'none',
    '</source-references>',
    '<character-notes>',
    overrides.characterNotes
      ?? 'Micah has concealed his fear to protect Nate.\nThis recognition breaks that defense before he can recover.',
    '</character-notes>',
    '</workshop-widget-recommendation>'
  ].join('\n');

  const creativeRecommendationFrame = (overrides: {
    subjectText?: string;
    contextText?: string;
    sourceReferences?: string;
    mustSurvive?: string;
    mustNotChange?: string;
    aim?: string;
    distance?: string;
    requestedCount?: string;
  } = {}): string => [
    '### Try a widget',
    '<workshop-widget-recommendation version="1">',
    '<widget-id>', 'creative-variations', '</widget-id>',
    '<subject-passage>',
    overrides.subjectText ?? 'She turned the mug until the chip faced the wall.',
    '</subject-passage>',
    '<surrounding-context>', overrides.contextText ?? '', '</surrounding-context>',
    '<source-references>', overrides.sourceReferences ?? 'none', '</source-references>',
    '<must-survive>', overrides.mustSurvive ?? '', '</must-survive>',
    '<must-not-change>', overrides.mustNotChange ?? '', '</must-not-change>',
    '<creative-aim>', overrides.aim ?? '', '</creative-aim>',
    '<sampling-distance>', overrides.distance ?? 'tail', '</sampling-distance>',
    '<take-count>', overrides.requestedCount ?? '3', '</take-count>',
    '</workshop-widget-recommendation>'
  ].join('\n');

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
    session.setExcerpt({ text: 'A pinned excerpt.', source: { kind: 'manual' } });
    events = {
      streamCompleted: jest.fn(),
      turnCompleted: jest.fn(),
      status: jest.fn(),
      error: jest.fn(),
      widgetRecommendationRejected: jest.fn()
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

  it('extracts a rich widget seed, strips its accepted control, and preserves preceding Next steps', () => {
    session.beginPersonaMessage('req-1', 'Find a stronger embodied reaction.');
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Micah notes',
      words: 4,
      content: 'Micah recognizes the impossible.'
    });
    const visibleContent = [
      'The reaction should register as recognition rather than generic surprise.',
      '',
      '### Next steps',
      '- [high] Rework the final reaction around Micah’s broken self-control.'
    ].join('\n');
    const control = widgetRecommendationFrame({
      targetPhrase: 'His eyes stretched wide.',
      writerInstructions: [
        'Keep this as recognition rather than generic shock.',
        'Give the writer direct facial options, displaced body reactions, and one beat Nate could misread.'
      ].join('\n'),
      surroundingContext: [
        'Micah was up, locked on Jasper, shoulders set back and taut.',
        'Nate glanced at Jasper, then back to Micah.',
        'But Micah’s gaze had gone past Jasper. Past the room. His eyes stretched wide.'
      ].join('\n'),
      sourceReferences: 'active-excerpt\ncontext-attachment:ctx-1',
      characterNotes: [
        'Micah is trying to protect Nate by containing what he knows.',
        'Recognition ruptures that control, while Nate has enough history with him to notice but not necessarily interpret it correctly.'
      ].join('\n')
    });

    const turn = settle({
      requestId: 'req-1',
      result: result(`${visibleContent}\n\n${control}`, { conversationId: 'host-conv' })
    })!;

    expect(turn.content).toBe(visibleContent);
    expect(turn.actionableFindings).toEqual([{
      key: 'finding-1',
      ordinal: 1,
      priority: 'high',
      text: 'Rework the final reaction around Micah’s broken self-control.'
    }]);
    expect(turn.widgetRecommendation).toEqual({
      widgetId: 'gesture-playground',
      seed: {
        targetPhrase: 'His eyes stretched wide.',
        writerInstructions: [
          'Keep this as recognition rather than generic shock.',
          'Give the writer direct facial options, displaced body reactions, and one beat Nate could misread.'
        ].join('\n'),
        contextText: [
          'Micah was up, locked on Jasper, shoulders set back and taut.',
          'Nate glanced at Jasper, then back to Micah.',
          'But Micah’s gaze had gone past Jasper. Past the room. His eyes stretched wide.'
        ].join('\n'),
        characterNotes: [
          'Micah is trying to protect Nate by containing what he knows.',
          'Recognition ruptures that control, while Nate has enough history with him to notice but not necessarily interpret it correctly.'
        ].join('\n'),
        sourceReferences: [
          { kind: 'active-excerpt' },
          { kind: 'context-attachment', attachmentId: 'ctx-1' }
        ]
      }
    });
    expect(events.streamCompleted).toHaveBeenCalledWith(
      'req-1',
      visibleContent,
      false,
      expect.anything(),
      false
    );
    expect(log).toHaveBeenCalledWith('Actionable findings accepted: 1 items (Jill)');
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation accepted (Jill; widget=gesture-playground)'
    );
  });

  it('gives an invited guest the same rich recommendation contract', () => {
    session.adoptPersonaGuest('felix', 'felix-conv', []);
    session.beginPersonaGuestMessage(
      'felix',
      'req-1',
      'What is the physical rhythm of this recognition?'
    );
    const visibleContent = 'Let the reaction break the cadence Micah has been controlling.';
    const control = widgetRecommendationFrame({
      writerInstructions:
        'Preserve recognition and the broken cadence. Explore breath, stillness, and one action Nate can hear before he understands it.'
    });

    const turn = completeWorkshopRun({
      session,
      requestId: 'req-1',
      label: 'Felix',
      result: result(`${visibleContent}\n\n${control}`, { conversationId: 'felix-conv' }),
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Felix'),
      discardConversation,
      log,
      events
    })!;

    expect(turn).toMatchObject({
      participant: 'guest',
      personaId: 'felix',
      content: visibleContent,
      widgetRecommendation: {
        widgetId: 'gesture-playground',
        seed: {
          writerInstructions: expect.stringContaining('broken cadence'),
          contextText: expect.stringContaining('Nate turned'),
          characterNotes: expect.stringContaining('protect Nate'),
          sourceReferences: []
        }
      }
    });
  });

  it('attaches a Creative prefill from a persona and validates its live sources', () => {
    session.addContextAttachment({
      kind: 'text',
      origin: 'writer',
      label: 'Scene notes',
      words: 4,
      content: 'The mug is chipped.'
    });
    session.beginPersonaMessage('req-1', 'Prepare unlike versions of this beat.');
    const turn = settle({
      requestId: 'req-1',
      result: result([
        'Let us put unlike possibilities beside each other.',
        '',
        creativeRecommendationFrame({
          sourceReferences: 'active-excerpt\ncontext-attachment:ctx-1',
          mustSurvive: 'The refusal remains implicit.',
          mustNotChange: 'Keep the chipped mug.',
          requestedCount: '4'
        })
      ].join('\n'), { conversationId: 'host-conv' })
    })!;

    expect(turn.widgetRecommendation).toEqual({
      widgetId: 'creative-variations',
      seed: expect.objectContaining({
        subjectText: 'She turned the mug until the chip faced the wall.',
        sourceReferences: [
          { kind: 'active-excerpt' },
          { kind: 'context-attachment', attachmentId: 'ctx-1' }
        ],
        distance: 'tail',
        requestedCount: 4
      })
    });
    expect(turn.content).toBe('Let us put unlike possibilities beside each other.');
  });

  it('attaches a Creative prefill to the exact invited Guest persona turn', () => {
    session.adoptPersonaGuest('margot', 'margot-conv', []);
    session.beginPersonaGuestMessage(
      'margot',
      'req-1',
      'Prepare unlike versions of this beat.'
    );

    const turn = completeWorkshopRun({
      session,
      requestId: 'req-1',
      label: 'Margot',
      result: result([
        'Let us widen the possibilities without choosing one for you.',
        '',
        creativeRecommendationFrame({
          mustSurvive: 'The refusal remains implicit.',
          mustNotChange: 'Keep the chipped mug.',
          distance: 'far-tail',
          requestedCount: '5'
        })
      ].join('\n'), { conversationId: 'margot-conv' }),
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Margot'),
      discardConversation,
      log,
      events
    })!;

    expect(turn).toMatchObject({
      participant: 'guest',
      personaId: 'margot',
      widgetRecommendation: {
        widgetId: 'creative-variations',
        seed: expect.objectContaining({
          distance: 'far-tail',
          requestedCount: 5
        })
      }
    });
  });

  it('rejects a Creative prefill whose source address is no longer available', () => {
    session.beginPersonaMessage('req-1', 'Prepare unlike versions of this beat.');
    const turn = settle({
      requestId: 'req-1',
      result: result(creativeRecommendationFrame({
        sourceReferences: 'context-attachment:ctx-999'
      }), { conversationId: 'host-conv' })
    })!;

    expect(turn.widgetRecommendation).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation rejected (Jill; widget=creative-variations; '
      + 'reason=unavailable_source_reference:context-attachment:ctx-999)'
    );
    expect(events.widgetRecommendationRejected).toHaveBeenCalledWith(
      "Jill's Creative Variations Explorer setup could not be prepared.",
      expect.stringContaining('context-attachment:ctx-999')
    );
  });

  it('keeps widget recommendations persona-only on a direct tool completion', () => {
    session.beginToolRun('prose', 'tool-1');
    session.completeToolReport('tool-1', 'Initial report.', 'tool-conv');
    session.beginDirectToolMessage('prose', 'req-1', 'Prepare the widget.');

    const turn = settle({
      requestId: 'req-1',
      createsRetainedConversation: false,
      result: result(creativeRecommendationFrame(), { conversationId: 'tool-conv' })
    })!;

    expect(turn.participant).toBe('tool');
    expect(turn.widgetRecommendation).toBeUndefined();
    expect(turn.content).toBe('Jill returned a widget setup without an accompanying note.');
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation rejected '
      + '(Jill; widget=creative-variations; reason=participant_not_persona)'
    );
  });

  it('rejects a well-formed source id the current session did not mint', () => {
    session.beginPersonaMessage('req-1', 'Find a stronger embodied reaction.');
    const visibleContent = 'The reaction needs a more specific pressure.';
    const control = widgetRecommendationFrame({
      sourceReferences: 'context-attachment:ctx-999'
    });

    const turn = settle({
      requestId: 'req-1',
      result: result(
        `${visibleContent}\n\n${control}`,
        { conversationId: 'host-conv' }
      )
    })!;

    expect(turn.content).toBe(visibleContent);
    expect(turn.widgetRecommendation).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation rejected (Jill; widget=gesture-playground; '
      + 'reason=unavailable_source_reference:context-attachment:ctx-999)'
    );
  });

  it('strips a rejected widget control without attaching a recommendation', () => {
    session.beginPersonaMessage('req-1', 'Find a stronger embodied reaction.');
    const visibleContent = 'The reaction needs a more scene-specific pressure.';
    const rejectedControl = widgetRecommendationFrame().replace(
      '</character-notes>',
      ''
    );

    const turn = settle({
      requestId: 'req-1',
      result: result(
        `${visibleContent}\n\n${rejectedControl}`,
        { conversationId: 'host-conv' }
      )
    })!;

    expect(turn.content).toBe(visibleContent);
    expect(turn.widgetRecommendation).toBeUndefined();
    expect(events.streamCompleted).toHaveBeenCalledWith(
      'req-1',
      visibleContent,
      false,
      expect.anything(),
      false
    );
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation rejected (Jill; widget=gesture-playground; reason=invalid_frame)'
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        'Rejected widget recommendation response (Jill; widget=gesture-playground;'
      )
    );
    expect(events.widgetRecommendationRejected).toHaveBeenCalledWith(
      "Jill's Gesture Playground setup could not be prepared.",
      'The generated setup was incomplete or invalid. Ask Jill to try again.'
    );
  });

  it('reports the overflowing recommendation field and replaces a blank bubble', () => {
    session.beginPersonaMessage('req-1', 'Prepare Gesture Playground again.');
    const maximum = PROMPT_BUDGETS.workshopWidgets.gestureWriterInstructionsCharacters;
    const control = widgetRecommendationFrame({
      writerInstructions: 'x'.repeat(maximum + 1)
    });

    const turn = settle({
      requestId: 'req-1',
      result: result(control, { conversationId: 'host-conv' })
    })!;

    expect(turn.content).toBe(
      "Jill's widget setup could not be displayed on that pass. Ask Jill to try again."
    );
    expect(turn.widgetRecommendation).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Widget recommendation rejected '
      + `(Jill; widget=gesture-playground; `
      + `reason=field_too_long:writerInstructions:${maximum + 1}/${maximum})`
    );
    expect(events.widgetRecommendationRejected).toHaveBeenCalledWith(
      "Jill's Gesture Playground setup could not be prepared.",
      `Writer instructions used ${(maximum + 1).toLocaleString('en-US')} characters; `
      + `the limit is ${maximum.toLocaleString('en-US')}. Ask Jill to try again.`
    );
  });

  it('bounds rejected control diagnostics while preserving the response edges', () => {
    session.beginPersonaMessage('req-1', 'Prepare Gesture Playground again.');
    const oversized = [
      '### Try a widget',
      'START-EDGE',
      'a'.repeat(8_000),
      'MIDDLE-PRIVATE-PROSE',
      'b'.repeat(8_000),
      'END-EDGE'
    ].join('\n');

    settle({
      requestId: 'req-1',
      result: result(oversized, { conversationId: 'host-conv' })
    });

    const diagnostic = log.mock.calls
      .map(([line]) => line as string)
      .find((line) => line.startsWith('Rejected widget recommendation response'))!;
    expect(diagnostic).toContain('START-EDGE');
    expect(diagnostic).toContain('END-EDGE');
    expect(diagnostic).toContain('characters omitted');
    expect(diagnostic).not.toContain('MIDDLE-PRIVATE-PROSE');
    expect(diagnostic.length).toBeLessThan(9_000);
  });

  it('attaches proposals to a guest turn and promotes them with guest provenance', () => {
    session.adoptPersonaGuest('felix', 'felix-conv', []);
    session.beginPersonaGuestMessage('felix', 'req-1', 'Turn the review into tasks.');

    const turn = completeWorkshopRun({
      session,
      requestId: 'req-1',
      label: 'Felix',
      result: result([
        'The cadence has one revision target.',
        '',
        '### Next steps',
        '- [high] Restore the breath before the final image.'
      ].join('\n'), { conversationId: 'felix-conv' }),
      aborted: false,
      createsRetainedConversation: false,
      copy: workshopMessageCompletionCopy('Felix'),
      discardConversation,
      log,
      events
    })!;

    expect(turn).toMatchObject({
      participant: 'guest',
      personaId: 'felix',
      actionableFindings: [{
        key: 'finding-1',
        ordinal: 1,
        priority: 'high',
        text: 'Restore the breath before the final image.'
      }]
    });
    expect(session.addTodoFromFinding(turn.id, 'finding-1')).toMatchObject({
      priority: 'high',
      source: {
        kind: 'guest_turn',
        turnId: turn.id,
        participantLabel: 'Felix',
        personaId: 'felix'
      }
    });
  });

  it('logs a whole-section rejection without adopting any malformed proposals', () => {
    session.beginPersonaMessage('req-1', 'Turn the review into tasks.');

    const turn = settle({
      requestId: 'req-1',
      result: result('Advice.\n\n### Next steps\n- [ ] Rewrite the opening.', { conversationId: 'host-conv' })
    })!;

    expect(turn.actionableFindings).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      'Actionable findings rejected: 0 items (Jill; reason=invalid_item)'
    );
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
      'The participant response did not return a retained conversation.'
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
