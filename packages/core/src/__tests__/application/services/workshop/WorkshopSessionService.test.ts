import {
  WorkshopSessionService,
  WORKSHOP_SNAPSHOT_TURN_WINDOW,
  WORKSHOP_TODO_BOUNDS
} from '@/application/services/workshop/WorkshopSessionService';
import {
  buildWorkshopDirectHandoff,
  buildWorkshopGuestHandoff
} from '@/application/services/workshop/WorkshopPromptBuilder';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

describe('WorkshopSessionService — Sprint 06B sidecars and direct handoff', () => {
  let clock: number;
  let service: WorkshopSessionService;

  beforeEach(() => {
    clock = 1_000;
    service = new WorkshopSessionService(() => ++clock);
  });

  const pin = (text = 'She leaves the letter on the table.') => service.setExcerpt({
    text,
    sourceUri: 'file:///chapter-one.md',
    relativePath: 'chapters/one.md'
  });

  it('reports no pending host updates before an excerpt exists', () => {
    expect(service.collectPendingHostUpdates()).toBeUndefined();
  });

  const adoptReport = (
    toolId: 'prose' | 'continuity' = 'prose',
    requestId = `${toolId}-run`,
    conversationId = `${toolId}-conv`,
    content = `${toolId} report`
  ) => {
    service.beginToolRun(toolId, requestId);
    return service.completeToolReport(requestId, content, conversationId)!.turn;
  };

  const directExchange = (toolId: 'prose' | 'continuity', index: number, content?: string) => {
    const requestId = `${toolId}-direct-${index}`;
    service.beginDirectToolMessage(toolId, requestId, `writer ${index}`);
    service.completeRun(requestId, content ?? `tool ${index}`);
  };

  it('starts with an id-free Jill host snapshot', () => {
    expect(service.getSnapshot().participants).toEqual({
      host: { personaId: 'jill', hasConversation: false },
      toolSidecars: [],
      personaGuests: [],
      chatTarget: { kind: 'host' }
    });
    expect(JSON.stringify(service.getSnapshot())).not.toContain('conversationId');
  });

  it('owns the attributed task lifecycle without mutating the source report', () => {
    pin();
    service.beginToolRun('continuity', 'report-run');
    const report = service.completeToolReport(
      'report-run',
      'Verbatim report.\n\n### Next steps\n- Put the cup back before Mara leaves.',
      'continuity-conv',
      undefined,
      false,
      [{ key: 'finding-1', ordinal: 1, text: 'Put the cup back before Mara leaves.' }]
    )!.turn;

    const added = service.addTodoFromFinding(report.id, 'finding-1');
    expect(added).toMatchObject({
      text: 'Put the cup back before Mara leaves.',
      status: 'open',
      stale: false,
      source: {
        kind: 'tool_report',
        turnId: report.id,
        participantLabel: 'Continuity',
        toolId: 'continuity',
        findingKey: 'finding-1',
        excerptVersion: 1
      }
    });
    expect(service.addTodoFromFinding(report.id, 'finding-1').id).toBe(added.id);

    service.editTodo(added.id, 'Move the cup before Mara leaves.');
    service.setTodoStatus(added.id, 'completed');
    expect(service.collectOpenTodosForHost()).toEqual([]);
    service.setTodoStatus(added.id, 'open');

    const todo = service.getSnapshot().todos[0];
    expect(todo).toMatchObject({
      text: 'Move the cup before Mara leaves.',
      status: 'open',
      writerEdit: { originalText: 'Put the cup back before Mara leaves.' }
    });
    expect(service.getSnapshot().turns.find((turn) => turn.id === report.id)?.content).toBe(
      'Verbatim report.\n\n### Next steps\n- Put the cup back before Mara leaves.'
    );
  });

  it('preserves tasks as stale history on excerpt replacement and clears them on reset', () => {
    pin();
    service.beginToolRun('prose', 'report-run');
    const report = service.completeToolReport(
      'report-run',
      'Report.',
      'prose-conv',
      undefined,
      false,
      [{ key: 'finding-1', ordinal: 1, text: 'Tighten the opening.' }]
    )!.turn;
    service.addTodoFromFinding(report.id, 'finding-1');

    expect(service.collectOpenTodosForHost()).toHaveLength(1);
    service.replaceExcerpt({ text: 'A new excerpt.' });

    expect(service.getSnapshot().todos[0].stale).toBe(true);
    expect(service.collectOpenTodosForHost()).toEqual([]);
    expect(() => service.addTodoFromFinding(report.id, 'finding-1')).toThrow(
      'Cannot add a task from a stale excerpt turn'
    );
    service.clearAllConversations();
    expect(service.getSnapshot().todos).toHaveLength(1);
    service.reset();
    expect(service.getSnapshot().todos).toEqual([]);
  });

  it('reorders and defensively clones task snapshots', () => {
    pin();
    service.beginToolRun('prose', 'report-run');
    const report = service.completeToolReport(
      'report-run',
      'Report.',
      'prose-conv',
      undefined,
      false,
      [
        { key: 'finding-1', ordinal: 1, text: 'First task.' },
        { key: 'finding-2', ordinal: 2, text: 'Second task.' }
      ]
    )!.turn;
    const first = service.addTodoFromFinding(report.id, 'finding-1');
    const second = service.addTodoFromFinding(report.id, 'finding-2');

    service.reorderTodo(second.id, 'up');
    const snapshot = service.getSnapshot();
    expect(snapshot.todos.map((todo) => todo.id)).toEqual([second.id, first.id]);
    snapshot.todos[0].source.findingText = 'mutated outside';
    expect(service.getSnapshot().todos[0].source.findingText).toBe('Second task.');
  });

  it('refuses the 201st writer-promoted task at the session bound', () => {
    pin();
    service.beginToolRun('prose', 'report-run');
    const findings = Array.from(
      { length: WORKSHOP_TODO_BOUNDS.items + 1 },
      (_, index) => ({ key: `finding-${index}`, ordinal: index + 1, text: `Task ${index}.` })
    );
    const report = service.completeToolReport(
      'report-run',
      'Report.',
      'prose-conv',
      undefined,
      false,
      findings
    )!.turn;

    for (let index = 0; index < WORKSHOP_TODO_BOUNDS.items; index += 1) {
      service.addTodoFromFinding(report.id, `finding-${index}`);
    }

    expect(service.getSnapshot().todos).toHaveLength(WORKSHOP_TODO_BOUNDS.items);
    expect(() => service.addTodoFromFinding(report.id, `finding-${WORKSHOP_TODO_BOUNDS.items}`))
      .toThrow(`Workshop task list is limited to ${WORKSHOP_TODO_BOUNDS.items} items`);
  });

  it('allows a tool side-pass while the retained host remains unchanged', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Stay with this scene.');
    service.completeRun('host-1', 'I am here.', undefined, false, 'host-conv');

    const request = service.beginToolRun('prose', 'tool-1');
    const completion = service.completeToolReport('tool-1', 'The middle drifts.', 'tool-conv');

    expect(request).toMatchObject({ participant: 'writer', artifact: 'tool_request' });
    expect(completion?.turn).toMatchObject({
      participant: 'tool',
      artifact: 'tool_report',
      toolId: 'prose'
    });
    expect(service.getHostConversationId()).toBe('host-conv');
    expect(service.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('adopts a report atomically and exposes only safe direct-follow-up metadata', () => {
    pin();
    const report = adoptReport('continuity');
    const sidecar = service.getSnapshot().participants.toolSidecars[0];

    expect(service.getToolSidecarConversationId('continuity')).toBe('continuity-conv');
    expect(sidecar).toEqual({
      toolId: 'continuity',
      hasConversation: true,
      latestReportTurnId: report.id,
      availableForDirectFollowUp: true,
      activeTarget: false
    });
    expect(JSON.stringify(sidecar)).not.toContain('continuity-conv');
  });

  it('refuses zombie reports without replacing the previous usable sidecar', () => {
    pin();
    adoptReport('prose', 'first', 'old-conv');
    service.beginToolRun('prose', 'zombie');
    service.abandonRun('zombie');

    expect(service.completeToolReport('zombie', 'late', 'zombie-conv')).toBeUndefined();
    expect(service.getToolSidecarConversationId('prose')).toBe('old-conv');
  });

  it('replaces only the same tool sidecar and returns the displaced id for disposal', () => {
    pin();
    adoptReport('prose', 'prose-1', 'prose-old');
    adoptReport('continuity', 'continuity-1', 'continuity-conv');
    service.beginToolRun('prose', 'prose-2');
    const replacement = service.completeToolReport('prose-2', 'new report', 'prose-new');

    expect(replacement?.replacedConversationId).toBe('prose-old');
    expect(service.getToolSidecarConversationId('prose')).toBe('prose-new');
    expect(service.getToolSidecarConversationId('continuity')).toBe('continuity-conv');
  });

  it('correlates report and persona synthesis as separate attributed turns', () => {
    pin();
    const report = adoptReport('prose');
    service.beginPersonaSynthesis('synthesis-1', report.id);
    const synthesis = service.completeRun(
      'synthesis-1',
      'Jill weighs the report.',
      undefined,
      false,
      'host-conv'
    );

    expect(synthesis).toMatchObject({
      participant: 'host',
      artifact: 'persona_synthesis',
      personaId: 'jill',
      reportTurnId: report.id
    });
    expect(service.getSnapshot().turns.map((turn) => turn.artifact)).toEqual([
      'tool_request',
      'tool_report',
      'persona_synthesis'
    ]);
  });

  it('enters direct mode only through an explicit live target and correlates exchanges', () => {
    pin();
    const report = adoptReport('continuity');

    expect(service.setChatTarget({ kind: 'tool', toolId: 'prose' })).toBe(false);
    expect(service.setChatTarget({ kind: 'tool', toolId: 'continuity' })).toBe(true);
    service.beginDirectToolMessage('continuity', 'direct-1', 'Where did it vanish?');
    const response = service.completeRun('direct-1', 'Between paragraphs three and four.');

    expect(response).toMatchObject({
      participant: 'tool',
      artifact: 'direct_tool_response',
      toolId: 'continuity',
      reportTurnId: report.id
    });
    expect(service.getSnapshot().participants.toolSidecars[0].activeTarget).toBe(true);
  });

  it('collects the unseen delta and advances cursors only for shipped turns after commit', () => {
    pin();
    adoptReport('prose');
    for (let index = 0; index < 6; index += 1) {
      directExchange('prose', index);
    }

    const handoff = buildWorkshopDirectHandoff(service.collectUnseenDirectExchanges())!;
    expect(handoff.unseenTurns).toBe(12);
    expect(handoff.includedTurns).toBe(PROMPT_BUDGETS.directHandoff.turns);
    expect(handoff.omittedTurns).toBe(4);

    // A failed/cancelled host turn does not consume the delta.
    expect(service.collectUnseenDirectExchanges()).toHaveLength(12);
    service.commitHostHandoff(handoff.deliveredTurnIds);
    expect(service.collectUnseenDirectExchanges()).toHaveLength(0);

    directExchange('prose', 7);
    expect(service.collectUnseenDirectExchanges()).toHaveLength(2);
  });

  it('does not advance a cursor for a tool whose exchanges the turn window dropped (PR #72 #1)', () => {
    pin();
    adoptReport('prose');
    directExchange('prose', 1, 'the oldest unseen exchange');
    adoptReport('continuity');
    for (let index = 0; index < 4; index += 1) {
      directExchange('continuity', index);
    }

    const unseen = service.collectUnseenDirectExchanges();
    expect(unseen).toHaveLength(10);
    const handoff = buildWorkshopDirectHandoff(unseen)!;
    // The newest-8 window is filled entirely by continuity turns.
    expect(handoff.includedTurns).toBe(PROMPT_BUDGETS.directHandoff.turns);
    expect(handoff.omittedTurns).toBe(2);
    expect(handoff.message).not.toContain('the oldest unseen exchange');

    service.commitHostHandoff(handoff.deliveredTurnIds);

    // Continuity is caught up; prose's undelivered pair survives for the next handoff.
    const stillUnseen = service.collectUnseenDirectExchanges();
    expect(stillUnseen.map((turn) => turn.toolId)).toEqual(['prose', 'prose']);
    expect(stillUnseen[1].content).toBe('the oldest unseen exchange');
  });

  it('keeps undelivered direct exchanges claimable across a same-tool re-run (PR #72 #2)', () => {
    pin();
    adoptReport('prose', 'first-run', 'first-conv');
    directExchange('prose', 1, 'undelivered insight');

    // Side-pass order: the pending delta is snapshotted, then the replacement
    // report is adopted — and its synthesis fails, so nothing commits.
    expect(service.collectUnseenDirectExchanges()).toHaveLength(2);
    adoptReport('prose', 'second-run', 'second-conv');

    const survivors = service.collectUnseenDirectExchanges();
    expect(survivors.map((turn) => turn.content)).toEqual(['writer 1', 'undelivered insight']);

    // A later successful host turn ships and commits them exactly once.
    const handoff = buildWorkshopDirectHandoff(survivors)!;
    expect(handoff.message).toContain('undelivered insight');
    service.commitHostHandoff(handoff.deliveredTurnIds);
    expect(service.collectUnseenDirectExchanges()).toHaveLength(0);
  });

  it('does not hand a cancelled direct attempt to the host as a completed exchange', () => {
    pin();
    adoptReport('prose');
    service.beginDirectToolMessage('prose', 'cancelled-direct', 'Never delivered');
    service.abandonRun('cancelled-direct');

    expect(service.collectUnseenDirectExchanges()).toHaveLength(0);
  });

  it('preserves the host, retires sidecars, versions turns, and collapses replacement notices', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Read this version.');
    service.completeRun('host-1', 'I have it.', undefined, false, 'host-conv');
    const proseReport = adoptReport('prose', 'prose-1', 'prose-conv');
    adoptReport('continuity', 'continuity-1', 'continuity-conv');
    service.setChatTarget({ kind: 'tool', toolId: 'prose' });

    const first = service.replaceExcerpt({
      text: 'The revised letter waits on the table.',
      relativePath: 'chapters/two.md'
    });

    expect(first.disposedConversationIds.sort()).toEqual(['continuity-conv', 'prose-conv']);
    expect(first.retiredSidecarCount).toBe(2);
    expect(first.dividerTurn).toMatchObject({
      role: 'system',
      participant: 'session',
      artifact: 'excerpt_revision',
      excerptVersion: 2,
      content: 'Excerpt v2 pinned · chapters/two.md · retired: Continuity, Prose'
    });
    expect(service.getHostConversationId()).toBe('host-conv');
    expect(service.getChatTarget()).toEqual({ kind: 'host' });
    expect(service.getSnapshot().participants.toolSidecars).toEqual([]);
    expect(proseReport.excerptVersion).toBe(1);
    expect(service.collectPendingHostUpdates()?.excerpt?.version).toBe(2);

    service.replaceExcerpt({ text: 'Only the newest draft should ship.' });
    expect(service.collectPendingHostUpdates()?.excerpt).toMatchObject({
      version: 3,
      text: 'Only the newest draft should ship.'
    });
    expect(service.getSnapshot()).toMatchObject({
      excerptVersion: 3,
      replacementCount: 2,
      pendingHostUpdate: { excerptVersion: 3, contextBrief: false }
    });
  });

  it('keeps project context across excerpt revisions and commits only the delivered generation', () => {
    pin();
    service.setContextBrief('A pre-conversation story brief.');
    expect(service.collectPendingHostUpdates()).toBeUndefined();
    service.beginPersonaMessage('host-1', 'Begin.');
    service.completeRun('host-1', 'Ready.', undefined, false, 'host-conv');

    service.setContextBrief('First changed brief.');
    const firstDelivery = service.collectPendingHostUpdates()!;
    service.setContextBrief('Newest changed brief.');
    service.commitPendingHostUpdates(firstDelivery);
    expect(service.collectPendingHostUpdates()?.contextBrief?.text).toBe('Newest changed brief.');

    service.replaceExcerpt({ text: 'Revised text.' });
    expect(service.getContextBrief()).toBe('Newest changed brief.');
    const combinedDelivery = service.collectPendingHostUpdates()!;
    expect(combinedDelivery.excerpt?.version).toBe(2);
    expect(combinedDelivery.contextBrief?.text).toBe('Newest changed brief.');
    service.commitPendingHostUpdates(combinedDelivery);
    expect(service.collectPendingHostUpdates()).toBeUndefined();

    service.setContextBrief('   ');
    expect(service.getContextBrief()).toBeUndefined();
    expect(service.collectPendingHostUpdates()?.contextBrief).toMatchObject({ text: undefined });
  });

  it('records nested capability artifacts without replacing the active host turn', () => {
    pin();
    service.beginPersonaMessage('host-capabilities', 'Check this word and continuity.');

    const dictionary = service.recordCapabilityArtifact({
      hostRequestId: 'host-capabilities',
      excerptVersion: 1,
      details: {
        operation: 'dictionary.lookup',
        status: 'success',
        requestSummary: 'liminal',
        requestedByPersonaId: 'jill'
      },
      result: {
        capability: 'dictionary.lookup',
        status: 'success',
        requestSummary: 'liminal',
        content: 'Threshold-toned.',
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
      }
    });
    const analysis = service.recordCapabilityArtifact({
      hostRequestId: 'host-capabilities',
      excerptVersion: 1,
      toolId: 'continuity',
      conversationId: 'persona-continuity-conv',
      details: {
        operation: 'analysis.run',
        status: 'success',
        requestSummary: 'Continuity',
        requestedByPersonaId: 'jill',
        metadata: { toolId: 'continuity' }
      },
      result: {
        capability: 'analysis.run',
        status: 'success',
        requestSummary: 'Continuity',
        content: 'The cup remains on the table.'
      }
    });

    expect(dictionary?.turn).toMatchObject({
      artifact: 'dictionary_lookup', excerptVersion: 1, capability: { requestedByPersonaId: 'jill' }
    });
    expect(analysis?.turn).toMatchObject({
      artifact: 'tool_report', toolId: 'continuity', excerptVersion: 1,
      capability: { operation: 'analysis.run' }
    });
    expect(service.getSnapshot().activeRequestId).toBe('host-capabilities');
    expect(service.getToolSidecarConversationId('continuity')).toBe('persona-continuity-conv');

    service.completeRun('host-capabilities', 'Here is my synthesis.', undefined, false, 'host-conv');
    const snapshot = service.getSnapshot();
    expect(snapshot.turns.slice(-3).map(turn => turn.artifact)).toEqual([
      'dictionary_lookup', 'tool_report', 'persona_message'
    ]);
    snapshot.turns.at(-3)!.capability!.metadata = { mutated: true };
    expect(service.getSnapshot().turns.at(-3)!.capability?.metadata).not.toEqual({ mutated: true });
  });

  it('refuses a capability artifact stamped with a stale excerpt version', () => {
    pin();
    service.setExcerpt({ text: 'A revised excerpt.' });
    service.beginPersonaMessage('host-capabilities', 'Check this word.');

    const completion = service.recordCapabilityArtifact({
      hostRequestId: 'host-capabilities',
      excerptVersion: 1,
      details: {
        operation: 'dictionary.lookup',
        status: 'success',
        requestSummary: 'liminal',
        requestedByPersonaId: 'jill'
      },
      result: {
        capability: 'dictionary.lookup',
        status: 'success',
        requestSummary: 'liminal',
        content: 'Stale evidence.'
      }
    });

    expect(completion).toBeUndefined();
    expect(service.getSnapshot().turns).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ content: 'Stale evidence.' })
    ]));
  });

  it('reset disposes all participants and returns to Jill while preserving the excerpt', () => {
    const excerpt = pin();
    service.selectPersona('theo');
    adoptReport('prose', 'tool-1', 'tool-conv');
    service.beginPersonaSynthesis('host-1', service.getSnapshot().turns.at(-1)!.id);
    service.completeRun('host-1', 'It needs a turn.', undefined, false, 'host-conv');
    service.setContextBrief('Temporary brief.');

    expect(service.reset().sort()).toEqual(['host-conv', 'tool-conv']);
    expect(service.getSnapshot()).toMatchObject({
      excerpt,
      turns: [],
      contextBrief: undefined,
      pendingHostUpdate: undefined,
      replacementCount: 0,
      participants: {
        host: { personaId: 'jill', hasConversation: false },
        toolSidecars: [],
        personaGuests: [],
        chatTarget: { kind: 'host' }
      }
    });
  });

  it('enforces guest identity/capacity rules and exposes honest guest liveness', () => {
    pin();
    service.beginPersonaMessage('host-1', 'The room is open.');
    service.completeRun('host-1', 'Let us begin.', undefined, false, 'host-conv');

    expect(() => service.adoptPersonaGuest('jill', 'jill-guest-conv')).toThrow(
      'The Workshop host is already in the room'
    );
    service.adoptPersonaGuest('margot', 'margot-conv');
    service.adoptPersonaGuest('quinn', 'quinn-conv');
    expect(() => service.adoptPersonaGuest('margot', 'duplicate-conv')).toThrow(
      'Margot is already in the room'
    );
    expect(() => service.adoptPersonaGuest('wren', 'wren-conv')).toThrow(
      'Workshop supports at most 2 live guests'
    );

    expect(service.getSnapshot().participants.personaGuests).toEqual([
      {
        personaId: 'margot',
        personaLabel: 'Margot',
        hasConversation: true,
        liveness: 'live',
        activeTarget: false
      },
      {
        personaId: 'quinn',
        personaLabel: 'Quinn',
        hasConversation: true,
        liveness: 'live',
        activeTarget: false
      }
    ]);
  });

  it('tracks guest cursors in both directions and stamps guest turns', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Host opening.');
    service.completeRun('host-1', 'Host reply.', undefined, false, 'host-conv');
    service.adoptPersonaGuest('margot', 'margot-conv');

    service.beginPersonaMessage('host-2', 'A later host question.');
    const hostReply = service.completeRun('host-2', 'A later host answer.')!;
    const missed = service.collectUnseenHostTurnsForGuest('margot');
    expect(missed.map((turn) => turn.content)).toEqual([
      'A later host question.',
      'A later host answer.'
    ]);
    service.commitGuestCatchUp('margot', [hostReply.id]);
    expect(service.collectUnseenHostTurnsForGuest('margot')).toEqual([]);

    expect(service.setChatTarget({ kind: 'personaGuest', personaId: 'margot' })).toBe(true);
    const guestMessage = service.beginPersonaGuestMessage(
      'margot',
      'guest-1',
      'What do you hear in the point of view?'
    );
    const guestReply = service.completeRun(
      'guest-1',
      'The distance slips in the second paragraph.',
      undefined,
      false,
      'margot-conv'
    )!;

    expect(guestMessage).toMatchObject({
      participant: 'writer',
      personaId: 'margot',
      personaLabel: 'Margot',
      artifact: 'persona_message'
    });
    expect(guestReply).toMatchObject({
      participant: 'guest',
      personaId: 'margot',
      personaLabel: 'Margot',
      artifact: 'persona_message'
    });

    const guestEvidence = service.collectUnseenGuestExchangesForHost();
    expect(guestEvidence.map((turn) => turn.id)).toEqual([guestMessage.id, guestReply.id]);
    service.commitHostGuestHandoff([guestMessage.id, guestReply.id]);
    expect(service.collectUnseenGuestExchangesForHost()).toEqual([]);

    expect(service.dismissPersonaGuest('margot')).toBe('margot-conv');
    expect(service.getChatTarget()).toEqual({ kind: 'host' });
    expect(service.getSnapshot().participants.personaGuests[0]).toMatchObject({
      personaId: 'margot',
      hasConversation: false,
      liveness: 'disposed'
    });
  });

  it('returns composer routing to the host when a tool run begins', () => {
    pin();
    service.adoptPersonaGuest('margot', 'margot-conv');
    expect(service.setChatTarget({ kind: 'personaGuest', personaId: 'margot' })).toBe(true);

    service.beginToolRun('prose', 'tool-run');

    expect(service.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('retains dismissed guest evidence, permits re-invitation, and unlocks host selection', () => {
    pin();
    service.adoptPersonaGuest('margot', 'margot-conv');
    const writerTurn = service.beginPersonaGuestMessage('margot', 'guest-1', 'What do you see?');
    const guestTurn = service.completeRun('guest-1', 'The narrative distance drifts.')!;

    expect(service.dismissPersonaGuest('margot')).toBe('margot-conv');
    expect(service.collectUnseenGuestExchangesForHost().map((turn) => turn.id)).toEqual([
      writerTurn.id,
      guestTurn.id
    ]);
    service.commitHostGuestHandoff([writerTurn.id, guestTurn.id]);
    expect(service.collectUnseenGuestExchangesForHost()).toEqual([]);

    service.beginPersonaGuestJoin('margot', 'guest-rejoin', 'Take another look.');
    service.completeRun('guest-rejoin', 'I see one more distance shift.', undefined, false, 'margot-conv-2');
    expect(service.getPersonaGuestConversationId('margot')).toBe('margot-conv-2');
    expect(service.dismissPersonaGuest('margot')).toBe('margot-conv-2');
    expect(() => service.selectPersona('theo')).not.toThrow();
    expect(service.getSelectedPersonaId()).toBe('theo');
  });

  it('interleaves two guests in thread order and advances each handoff cursor', () => {
    pin();
    service.adoptPersonaGuest('margot', 'margot-conv');
    service.adoptPersonaGuest('quinn', 'quinn-conv');

    const margotWriter = service.beginPersonaGuestMessage('margot', 'margot-1', 'Read the voice.');
    const margotReply = service.completeRun('margot-1', 'The voice pulls away here.')!;
    const quinnWriter = service.beginPersonaGuestMessage('quinn', 'quinn-1', 'Check the cup.');
    const quinnReply = service.completeRun('quinn-1', 'The cup changes hands twice.')!;

    const unseen = service.collectUnseenGuestExchangesForHost();
    expect(unseen.map((turn) => turn.id)).toEqual([
      margotWriter.id,
      margotReply.id,
      quinnWriter.id,
      quinnReply.id
    ]);
    const handoff = buildWorkshopGuestHandoff(unseen)!;
    expect(handoff.message).toContain('Margot:\nThe voice pulls away here.');
    expect(handoff.message).toContain('Quinn:\nThe cup changes hands twice.');

    service.commitHostGuestHandoff(handoff.deliveredTurnIds);

    expect(service.collectUnseenGuestExchangesForHost()).toEqual([]);
  });

  it('adopts a fresh guest only when its invitation run completes', () => {
    pin();
    service.beginPersonaMessage('host-1', 'Host opening.');
    service.completeRun('host-1', 'Host reply.', undefined, false, 'host-conv');

    const invitation = service.beginPersonaGuestJoin(
      'margot',
      'guest-join-1',
      'Read the room.'
    );
    expect(service.collectHostThreadTurns().map((turn) => turn.content)).toEqual([
      'Host opening.',
      'Host reply.'
    ]);
    expect(service.getSnapshot().participants.personaGuests).toEqual([]);

    const reply = service.completeRun(
      'guest-join-1',
      'Margot has joined.',
      undefined,
      false,
      'margot-conv'
    )!;

    expect(invitation.personaId).toBe('margot');
    expect(reply.participant).toBe('guest');
    expect(service.getPersonaGuestConversationId('margot')).toBe('margot-conv');
    expect(service.getChatTarget()).toEqual({ kind: 'host' });
  });

  it('refuses a late guest completion after dismissal', () => {
    pin();
    service.adoptPersonaGuest('margot', 'margot-conv');
    service.beginPersonaGuestMessage('margot', 'guest-run', 'Read this.');
    service.dismissPersonaGuest('margot');

    expect(service.completeRun('guest-run', 'Late guest response.', undefined, false, 'margot-conv'))
      .toBeUndefined();
    expect(service.getSnapshot().turns).toHaveLength(1);
  });

  it('bounds reload snapshots without leaking stored turn references', () => {
    pin();
    for (let index = 0; index < WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 2; index += 1) {
      service.beginToolRun('prose', `tool-${index}`);
      service.abandonRun(`tool-${index}`);
      service.beginPersonaMessage(`host-${index}`, `message ${index}`);
      service.completeRun(`host-${index}`, `reply ${index}`);
    }
    const snapshot = service.getSnapshot();
    expect(snapshot.turns).toHaveLength(WORKSHOP_SNAPSHOT_TURN_WINDOW);
    expect(snapshot.totalTurns).toBeGreaterThan(snapshot.turns.length);
    snapshot.turns[0].content = 'mutated';
    expect(service.getSnapshot().turns[0].content).not.toBe('mutated');
  });
});
