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
    source: { kind: 'file', sourceUri: 'file:///chapter-one.md', relativePath: 'chapters/one.md' }
  });

  it('reports no pending host updates before an excerpt exists', () => {
    expect(service.collectPendingHostUpdates()).toBeUndefined();
  });

  it('stamps provenance verbatim for all three source kinds (Sprint 12)', () => {
    expect(service.setExcerpt({ text: 'Typed.', source: { kind: 'manual' } }).source)
      .toEqual({ kind: 'manual' });

    const selection = {
      kind: 'editor-selection' as const,
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      startLine: 143,
      endLine: 151
    };
    expect(service.replaceExcerpt({ text: 'Pasted from editor.', source: selection }).excerpt.source)
      .toEqual(selection);

    const file = {
      kind: 'file' as const,
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'chapters' as const, path: 'chapters/05.md' }
    };
    expect(service.replaceExcerpt({ text: 'Read from file.', source: file }).excerpt.source)
      .toEqual(file);
  });

  it('isolates stamped provenance from caller mutation', () => {
    const input = {
      kind: 'file' as const,
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'chapters' as const, path: 'chapters/05.md' }
    };
    service.setExcerpt({ text: 'Read from file.', source: input });
    input.configuredResource.path = 'mutated.md';
    (input as { relativePath: string }).relativePath = 'mutated.md';

    const stored = service.getExcerpt()!;
    expect(stored.source).toEqual({
      kind: 'file',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'chapters', path: 'chapters/05.md' }
    });
  });

  it('names the source path in the revision divider, falling back for manual text', () => {
    pin();
    const sourced = service.replaceExcerpt({
      text: 'Revision two.',
      source: { kind: 'file', sourceUri: 'file:///chapters/two.md', relativePath: 'chapters/two.md' }
    });
    expect(sourced.dividerTurn?.content).toContain('chapters/two.md');

    const manual = service.replaceExcerpt({ text: 'Revision three.', source: { kind: 'manual' } });
    expect(manual.dividerTurn?.content).toContain('Pasted excerpt');
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

  it('owns a defensive room behavior object and stamps persona turns, not tool turns', () => {
    expect(service.getConversationBehavior()).toEqual({
      interactionMode: 'balanced',
      expressionLevel: 'full',
      relationalDepth: 'attuned',
      carryCuesThroughSession: true
    });
    pin();

    const opening = service.beginPersonaMessage('host-open', 'Start here.');
    expect(opening.behavior).toEqual(service.getConversationBehavior());
    expect(opening.behaviorTransition).toBeUndefined();
    const openingReply = service.completeRun(
      'host-open',
      'Ready.',
      undefined,
      false,
      'host-conv'
    )!;
    expect(openingReply.behavior).toEqual(service.getConversationBehavior());

    const selected = {
      interactionMode: 'conversational' as const,
      expressionLevel: 'subtle' as const,
      relationalDepth: 'reserved' as const,
      carryCuesThroughSession: false
    };
    service.setConversationBehavior(selected);
    selected.interactionMode = 'analysis' as never;
    expect(service.getConversationBehavior().interactionMode).toBe('conversational');

    const writerTurn = service.beginPersonaMessage('host-next', 'Keep it brief.');
    expect(writerTurn).toMatchObject({
      behavior: {
        interactionMode: 'conversational',
        expressionLevel: 'subtle',
        relationalDepth: 'reserved'
      },
      behaviorTransition: {
        from: {
          interactionMode: 'balanced',
          expressionLevel: 'full',
          relationalDepth: 'attuned'
        },
        to: {
          interactionMode: 'conversational',
          expressionLevel: 'subtle',
          relationalDepth: 'reserved'
        },
        reason: 'writer-selected'
      }
    });
    writerTurn.behaviorTransition!.from.interactionMode = 'analysis';
    const storedTransition = service.getSnapshot().turns.at(-1)!.behaviorTransition!;
    expect(storedTransition.from.interactionMode).toBe('balanced');
    storedTransition.to.interactionMode = 'analysis';
    expect(service.getSnapshot().turns.at(-1)!.behaviorTransition!.to.interactionMode)
      .toBe('conversational');
    const reply = service.completeRun('host-next', 'Yes.')!;
    expect(reply.behavior).toMatchObject({ interactionMode: 'conversational' });

    const toolTurn = service.beginToolRun('prose', 'tool-run');
    expect(toolTurn.behavior).toBeUndefined();
    expect(toolTurn.behaviorTransition).toBeUndefined();
  });

  it('starts from a validated remembered preference and preserves it across a new room reset', () => {
    const remembered = new WorkshopSessionService(() => 1, {
      interactionMode: 'analysis',
      expressionLevel: 'subtle',
      relationalDepth: 'reserved',
      carryCuesThroughSession: false
    });

    expect(remembered.getConversationBehavior()).toMatchObject({
      interactionMode: 'analysis',
      expressionLevel: 'subtle'
    });
    remembered.reset();
    expect(remembered.getConversationBehavior()).toMatchObject({
      interactionMode: 'analysis',
      expressionLevel: 'subtle'
    });
  });

  it('coalesces mode selection against the last committed persona reply', () => {
    pin();
    service.beginPersonaMessage('host-open', 'Start.');
    service.completeRun('host-open', 'Balanced reply.', undefined, false, 'host-conv');

    service.setConversationBehavior({
      ...service.getConversationBehavior(),
      interactionMode: 'analysis'
    });
    service.setConversationBehavior({
      ...service.getConversationBehavior(),
      interactionMode: 'conversational'
    });

    expect(service.beginPersonaMessage('host-next', 'Final choice.').behaviorTransition).toEqual({
      from: {
        interactionMode: 'balanced',
        expressionLevel: 'full',
        relationalDepth: 'attuned'
      },
      to: {
        interactionMode: 'conversational',
        expressionLevel: 'full',
        relationalDepth: 'attuned'
      },
      reason: 'writer-selected'
    });
  });

  it('records an expression-only transition against the last committed persona reply', () => {
    pin();
    service.beginPersonaMessage('host-open', 'Start.');
    service.completeRun('host-open', 'Full reply.', undefined, false, 'host-conv');

    service.setConversationBehavior({
      ...service.getConversationBehavior(),
      expressionLevel: 'amplified'
    });

    expect(service.beginPersonaMessage('host-next', 'Turn it up.').behaviorTransition).toEqual({
      from: {
        interactionMode: 'balanced',
        expressionLevel: 'full',
        relationalDepth: 'attuned'
      },
      to: {
        interactionMode: 'balanced',
        expressionLevel: 'amplified',
        relationalDepth: 'attuned'
      },
      reason: 'writer-selected'
    });
  });

  it('records a relational-depth-only transition against the last committed reply', () => {
    pin();
    service.beginPersonaMessage('host-open', 'Start.');
    service.completeRun('host-open', 'Attuned reply.', undefined, false, 'host-conv');

    service.setConversationBehavior({
      ...service.getConversationBehavior(),
      relationalDepth: 'reflective'
    });

    expect(service.beginPersonaMessage('host-next', 'Go deeper.').behaviorTransition).toEqual({
      from: {
        interactionMode: 'balanced',
        expressionLevel: 'full',
        relationalDepth: 'attuned'
      },
      to: {
        interactionMode: 'balanced',
        expressionLevel: 'full',
        relationalDepth: 'reflective'
      },
      reason: 'writer-selected'
    });
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
    service.replaceExcerpt({ text: 'A new excerpt.', source: { kind: 'manual' } });

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
      source: { kind: 'file', sourceUri: 'file:///chapter-two.md', relativePath: 'chapters/two.md' }
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

    service.replaceExcerpt({ text: 'Only the newest draft should ship.', source: { kind: 'manual' } });
    expect(service.collectPendingHostUpdates()?.excerpt).toMatchObject({
      version: 3,
      text: 'Only the newest draft should ship.'
    });
    expect(service.getSnapshot()).toMatchObject({
      excerptVersion: 3,
      replacementCount: 2,
      pendingHostUpdate: { excerptVersion: 3, context: false }
    });
  });

  const textAttachment = (label: string, words = 10, content = 'A context note.') =>
    service.addContextAttachment({ kind: 'text', origin: 'writer', label, words, content });

  it('keeps attachments across excerpt revisions and commits only the delivered generation', () => {
    pin();
    expect(textAttachment('Pre-conversation note\u2026').ok).toBe(true);
    // Pre-conversation adds are visible immediately — nothing pending, no event turn.
    expect(service.collectPendingHostUpdates()).toBeUndefined();
    service.beginPersonaMessage('host-1', 'Begin.');
    service.completeRun('host-1', 'Ready.', undefined, false, 'host-conv');

    expect(textAttachment('First change\u2026').ok).toBe(true);
    const firstDelivery = service.collectPendingHostUpdates()!;
    expect(textAttachment('Second change\u2026').ok).toBe(true);
    service.commitPendingHostUpdates(firstDelivery);
    // The newer generation stays pending and ships the FULL current list.
    expect(service.collectPendingHostUpdates()?.contextAttachments?.attachments).toHaveLength(3);

    service.replaceExcerpt({ text: 'Revised text.', source: { kind: 'manual' } });
    expect(service.getContextAttachments()).toHaveLength(3);
    const combinedDelivery = service.collectPendingHostUpdates()!;
    expect(combinedDelivery.excerpt?.version).toBe(2);
    expect(combinedDelivery.contextAttachments?.attachments).toHaveLength(3);
    service.commitPendingHostUpdates(combinedDelivery);
    expect(service.collectPendingHostUpdates()).toBeUndefined();
  });

  it('enforces the aggregate budget and the duplicate-file guard (Sprint 12)', () => {
    pin();
    const file = (sourceUri: string, words: number) => service.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'chapter.md', words,
      content: 'x', sourceUri, relativePath: 'chapters/chapter.md'
    });

    const budget = PROMPT_BUDGETS.contextAttachments.words;
    expect(file('file:///a.md', budget - 4_000).ok).toBe(true);
    expect(file('file:///a.md', 100)).toMatchObject({ ok: false, reason: 'duplicate' });
    expect(file('file:///b.md', 5_000)).toMatchObject({
      ok: false, reason: 'over-budget', remainingWords: 4_000
    });
    expect(file('file:///b.md', 4_000).ok).toBe(true);
    expect(service.contextWordsUsed()).toBe(budget);
  });

  it('posts event turns for mid-session changes only, and removal drops the entry', () => {
    pin();
    const before = textAttachment('Quiet add\u2026');
    expect(before.ok && before.eventTurn).toBeFalsy();

    service.beginPersonaMessage('host-1', 'Begin.');
    service.completeRun('host-1', 'Ready.', undefined, false, 'host-conv');

    const added = textAttachment('Loud add\u2026', 412);
    expect(added.ok && added.eventTurn?.content).toContain('Added context: Loud add\u2026 · 412 words');
    expect(added.ok && added.eventTurn?.artifact).toBe('context_change');

    const id = service.getContextAttachments().at(-1)!.id;
    const { removed, eventTurn } = service.removeContextAttachment(id);
    expect(removed?.label).toBe('Loud add\u2026');
    expect(eventTurn?.content).toContain('Removed context: Loud add\u2026');
    expect(service.getContextAttachments().map((entry) => entry.label)).toEqual(['Quiet add\u2026']);
    expect(service.removeContextAttachment('ctx-nope')).toEqual({});
  });

  it('keeps content and every host-private sourceUri out of the webview snapshot', () => {
    pin();
    service.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'chapter.md', words: 10,
      content: 'Secret body.', sourceUri: 'file:///a.md', relativePath: 'chapters/chapter.md'
    });

    const [snapshot] = service.getSnapshot().contextAttachments;
    expect(snapshot).toMatchObject({ kind: 'file', label: 'chapter.md', words: 10 });
    expect(snapshot).not.toHaveProperty('content');
    expect(snapshot).not.toHaveProperty('sourceUri');
    expect(service.getSnapshot().excerpt?.source).not.toHaveProperty('sourceUri');
  });

  it('ships text-note content in the snapshot — the pill is the note\u2019s only home', () => {
    pin();
    service.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Note\u2026', words: 3, content: 'Prom happens Friday.'
    });

    const [snapshot] = service.getSnapshot().contextAttachments;
    expect(snapshot).toMatchObject({ kind: 'text', content: 'Prom happens Friday.' });
    expect(snapshot).not.toHaveProperty('sourceUri');
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
    service.setExcerpt({ text: 'A revised excerpt.', source: { kind: 'manual' } });
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

  it('reset disposes all participants and returns to Jill while preserving the working set', () => {
    const excerpt = pin();
    service.selectPersona('theo');
    adoptReport('prose', 'tool-1', 'tool-conv');
    service.beginPersonaSynthesis('host-1', service.getSnapshot().turns.at(-1)!.id);
    service.completeRun('host-1', 'It needs a turn.', undefined, false, 'host-conv');
    service.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Temporary\u2026', words: 2, content: 'Temporary note.'
    });

    expect(service.reset().sort()).toEqual(['host-conv', 'tool-conv']);
    expect(service.getSnapshot()).toMatchObject({
      excerpt: {
        text: excerpt.text,
        version: excerpt.version,
        source: { kind: 'file', relativePath: 'chapters/one.md' }
      },
      turns: [],
      contextAttachments: [{
        id: 'ctx-1',
        kind: 'text',
        origin: 'writer',
        label: 'Temporary\u2026',
        words: 2
      }],
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

describe('message attachments — one-shot thread-artifacts (Phase 6B)', () => {
  const attachment = (path: string, overrides: Record<string, unknown> = {}) => ({
    label: path.split('/').pop()!,
    content: `Content of ${path}`,
    words: 3,
    relativePath: path,
    configuredResource: { group: 'chapters' as const, path },
    ...overrides
  });

  it('mints monotonic ta-N ids, guards duplicates before the cap, and enforces the item cap', () => {
    const session = new WorkshopSessionService(() => 1);

    expect(session.addMessageAttachment(attachment('chapters/a.md'))).toMatchObject({
      ok: true, attachment: { id: 'ta-1' }
    });
    expect(session.addMessageAttachment(attachment('chapters/b.md'))).toMatchObject({
      ok: true, attachment: { id: 'ta-2' }
    });
    expect(session.addMessageAttachment(attachment('chapters/a.md'))).toEqual({
      ok: false, reason: 'duplicate'
    });
    expect(session.addMessageAttachment(attachment('chapters/c.md'))).toMatchObject({
      ok: true, attachment: { id: 'ta-3' }
    });
    expect(session.addMessageAttachment(attachment('chapters/d.md'))).toEqual({
      ok: false, reason: 'limit'
    });
    // Removal frees a slot, and the freed id is never reused.
    expect(session.removeMessageAttachment('ta-2')?.id).toBe('ta-2');
    expect(session.addMessageAttachment(attachment('chapters/d.md'))).toMatchObject({
      ok: true, attachment: { id: 'ta-4' }
    });
  });

  it('commits only the shipped ids and clears everything on reset', () => {
    const session = new WorkshopSessionService(() => 1);
    session.addMessageAttachment(attachment('chapters/a.md'));
    session.addMessageAttachment(attachment('chapters/b.md'));

    session.commitMessageAttachments(['ta-1']);
    expect(session.getSnapshot().pendingMessageAttachments.map((a) => a.id)).toEqual(['ta-2']);

    session.reset();
    expect(session.getSnapshot().pendingMessageAttachments).toEqual([]);
  });

  it('stamps display-safe refs on the writer turn and strips content/sourceUri from snapshots', () => {
    const session = new WorkshopSessionService(() => 1);
    session.setExcerpt({ text: 'The cup moves.', source: { kind: 'manual' } });
    session.addMessageAttachment(attachment('chapters/a.md', { sourceUri: 'file:///ws/chapters/a.md' }));
    const refs = session.getSnapshot().pendingMessageAttachments;
    expect(refs[0]).not.toHaveProperty('content');
    expect(refs[0]).not.toHaveProperty('sourceUri');

    const turn = session.beginPersonaMessage('req-1', 'Look at this chapter.', refs);
    expect(turn.messageAttachments).toEqual([
      expect.objectContaining({ id: 'ta-1', label: 'a.md', relativePath: 'chapters/a.md' })
    ]);
    // The staged list is untouched by beginMessage — only commit clears it.
    expect(session.getSnapshot().pendingMessageAttachments).toHaveLength(1);
  });
});

describe('writer-origin context sources (Phase 7)', () => {
  const pinned = (session: WorkshopSessionService) => session.setExcerpt({
    text: 'The cup moves.',
    source: {
      kind: 'file',
      sourceUri: 'file:///ws/chapters/ch-04.md',
      relativePath: 'chapters/ch-04.md',
      configuredResource: { group: 'chapters', path: 'chapters/ch-04.md' }
    }
  });

  it('stamps the host pin at first adoption and derives live standing attachments', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Mara note\u2026', words: 5,
      content: 'Mara cannot see the cup.'
    });

    // Before any host conversation, nothing writer-stamped is carried yet
    // except the live attachment derivation for the (future) host.
    session.beginPersonaMessage('req-1', 'Hello');
    session.completeRun('req-1', 'Hi.', undefined, undefined, 'host-conv');

    const sources = session.collectWriterSources({ kind: 'host' });
    expect(sources[0]).toMatchObject({
      kind: 'pin',
      origin: 'writer',
      label: 'chapters/ch-04.md',
      configuredResource: { group: 'chapters', path: 'chapters/ch-04.md' },
      excerptVersion: 1
    });
    expect(sources[1]).toMatchObject({ kind: 'attachment', label: 'Mara note\u2026' });
    // A second successful host turn does not duplicate the pin row.
    session.beginPersonaMessage('req-2', 'Again');
    session.completeRun('req-2', 'Sure.', undefined, undefined, 'host-conv');
    expect(session.collectWriterSources({ kind: 'host' }).filter((s) => s.kind === 'pin')).toHaveLength(1);
  });

  it('marks prior pin rows stale only when the revision frame actually ships', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.beginPersonaMessage('req-1', 'Hello');
    session.completeRun('req-1', 'Hi.', undefined, undefined, 'host-conv');

    session.replaceExcerpt({ text: 'The cup vanishes.', source: { kind: 'manual' } });
    // Not delivered yet: the old pin is still the honest live row.
    const livePins = session.collectWriterSources({ kind: 'host' }).filter((s) => s.kind === 'pin');
    expect(livePins).toEqual([expect.objectContaining({ excerptVersion: 1 })]);
    expect(livePins[0].stale).toBeUndefined();

    const pending = session.collectPendingHostUpdates()!;
    session.commitPendingHostUpdates(pending);
    const pins = session.collectWriterSources({ kind: 'host' }).filter((s) => s.kind === 'pin');
    expect(pins).toEqual([
      expect.objectContaining({ excerptVersion: 1, stale: true }),
      expect.objectContaining({ excerptVersion: 2, label: 'Pasted excerpt' })
    ]);
  });

  it('keeps only the latest delivered host pin live across successive revisions', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.beginPersonaMessage('req-1', 'Hello');
    session.completeRun('req-1', 'Hi.', undefined, undefined, 'host-conv');

    for (const text of ['Revision two.', 'Revision three.']) {
      session.replaceExcerpt({ text, source: { kind: 'manual' } });
      session.commitPendingHostUpdates(session.collectPendingHostUpdates()!);
    }

    const pins = session.collectWriterSources({ kind: 'host' }).filter((source) => source.kind === 'pin');
    expect(pins).toEqual([
      expect.objectContaining({ excerptVersion: 1, stale: true }),
      expect.objectContaining({ excerptVersion: 2, stale: true }),
      expect.objectContaining({ excerptVersion: 3 })
    ]);
    expect(pins[2].stale).toBeUndefined();
  });

  it('snapshots tool manifests at adoption, replaces them on re-adoption, and retires them on revision', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Note\u2026', words: 2, content: 'A note.'
    });

    session.beginToolRun('prose', 'run-1');
    session.completeToolReport('run-1', 'Report.', 'tool-conv-1');
    const toolSources = session.collectWriterSources({ kind: 'tool', toolId: 'prose' });
    expect(toolSources.map((s) => s.kind)).toEqual(['pin', 'attachment']);

    // Standing-list changes after adoption never reach a retained sidecar.
    session.addContextAttachment({
      kind: 'text', origin: 'writer', label: 'Late note\u2026', words: 2, content: 'Too late.'
    });
    expect(session.collectWriterSources({ kind: 'tool', toolId: 'prose' })).toHaveLength(2);
    // ...but the host derivation sees the live list.
    expect(session.collectWriterSources({ kind: 'host' }).filter((s) => s.kind === 'attachment')).toHaveLength(2);

    session.replaceExcerpt({ text: 'Revised.', source: { kind: 'manual' } });
    expect(session.collectWriterSources({ kind: 'tool', toolId: 'prose' })).toEqual([]);
  });

  it('stamps guests at join, clears them on dismissal, and routes shipped message attachments by target', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.adoptPersonaGuest('margot', 'guest-conv');
    expect(session.collectWriterSources({ kind: 'personaGuest', personaId: 'margot' })).toEqual([
      expect.objectContaining({ kind: 'pin', excerptVersion: 1 })
    ]);

    session.addMessageAttachment({
      label: 'raven.md', content: 'Raven keeps the token.', words: 4,
      relativePath: 'Characters/raven.md',
      configuredResource: { group: 'characters', path: 'Characters/raven.md' }
    });
    session.commitMessageAttachments(['ta-1'], { kind: 'personaGuest', personaId: 'margot' });
    expect(session.collectWriterSources({ kind: 'personaGuest', personaId: 'margot' })).toEqual([
      expect.objectContaining({ kind: 'pin' }),
      expect.objectContaining({
        kind: 'message-attachment',
        origin: 'writer',
        label: 'raven.md',
        sizeChars: 'Raven keeps the token.'.length
      })
    ]);
    expect(session.getSnapshot().pendingMessageAttachments).toEqual([]);

    session.dismissPersonaGuest('margot');
    expect(session.collectWriterSources({ kind: 'personaGuest', personaId: 'margot' })).toEqual([]);
  });

  it('clears every writer-origin manifest with the conversations on reset', () => {
    const session = new WorkshopSessionService(() => 7);
    pinned(session);
    session.beginPersonaMessage('req-1', 'Hello');
    session.completeRun('req-1', 'Hi.', undefined, undefined, 'host-conv');
    expect(session.collectWriterSources({ kind: 'host' })).not.toEqual([]);

    session.reset();
    expect(session.collectWriterSources({ kind: 'host' })).toEqual([]);
  });
});
