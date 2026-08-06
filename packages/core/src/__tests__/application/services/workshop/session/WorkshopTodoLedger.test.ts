import {
  WorkshopTodoLedger
} from '@/application/services/workshop/session/WorkshopTodoLedger';
import { WORKSHOP_TODO_BOUNDS } from '@/application/services/workshop/WorkshopSessionLimits';
import { WorkshopActionableFinding, WorkshopTurn } from '@messages';

const finding = (
  key: string,
  text = `Task for ${key}.`,
  priority?: WorkshopActionableFinding['priority']
): WorkshopActionableFinding => ({
  key,
  text,
  ordinal: 1,
  priority
});

const turn = (overrides: Partial<WorkshopTurn> = {}): WorkshopTurn => ({
  id: 'turn-1-assistant-1',
  role: 'assistant',
  kind: 'tool_run',
  participant: 'tool',
  artifact: 'tool_report',
  toolId: 'prose',
  excerptVersion: 3,
  actionableFindings: [finding('finding-1', 'Tighten the opening.', 'high')],
  content: 'Report.',
  timestamp: 1,
  ...overrides
});

describe('WorkshopTodoLedger', () => {
  it('adds each turn/finding pair once with immutable tool provenance', () => {
    let now = 100;
    const ledger = new WorkshopTodoLedger(() => ++now);
    const sourceTurn = turn();

    const added = ledger.addFromFinding(sourceTurn, 'finding-1', 3);
    const duplicate = ledger.addFromFinding(sourceTurn, 'finding-1', 3);

    expect(added).toEqual({
      id: 'todo-1-101',
      text: 'Tighten the opening.',
      status: 'open',
      priority: 'high',
      source: {
        kind: 'tool_report',
        turnId: sourceTurn.id,
        participantLabel: 'Prose',
        toolId: 'prose',
        findingKey: 'finding-1',
        findingText: 'Tighten the opening.',
        excerptVersion: 3
      },
      createdAt: 102,
      stale: false
    });
    expect(duplicate.id).toBe(added.id);
    expect(ledger.list(3)).toHaveLength(1);
  });

  it('preserves host and guest finding provenance with catalog labels', () => {
    const ledger = new WorkshopTodoLedger(() => 10);
    const hostTurn = turn({
      id: 'turn-host',
      kind: 'message',
      participant: 'host',
      artifact: 'persona_message',
      toolId: undefined,
      personaId: 'jill',
      reportTurnId: 'turn-report',
      actionableFindings: [finding('host-finding', 'Keep the question open.')]
    });
    const guestTurn = turn({
      id: 'turn-guest',
      kind: 'message',
      participant: 'guest',
      artifact: 'persona_message',
      toolId: undefined,
      personaId: 'felix',
      actionableFindings: [finding('guest-finding', 'Restore the breath.')]
    });

    expect(ledger.addFromFinding(hostTurn, 'host-finding', 3).source).toEqual({
      kind: 'host_turn',
      turnId: 'turn-host',
      participantLabel: 'Jill',
      personaId: 'jill',
      upstreamReportTurnId: 'turn-report',
      findingKey: 'host-finding',
      findingText: 'Keep the question open.',
      excerptVersion: 3
    });
    expect(ledger.addFromFinding(guestTurn, 'guest-finding', 3).source).toEqual({
      kind: 'guest_turn',
      turnId: 'turn-guest',
      participantLabel: 'Felix',
      personaId: 'felix',
      upstreamReportTurnId: undefined,
      findingKey: 'guest-finding',
      findingText: 'Restore the breath.',
      excerptVersion: 3
    });
  });

  it('rejects unknown findings, ineligible turns, and stale source turns', () => {
    const ledger = new WorkshopTodoLedger(() => 1);

    expect(() => ledger.addFromFinding(undefined, 'finding-1', 3))
      .toThrow('Cannot add a task from an unknown actionable finding');
    expect(() => ledger.addFromFinding(turn({
      participant: 'writer',
      artifact: 'persona_message',
      toolId: undefined
    }), 'finding-1', 3)).toThrow('Cannot add a task from an unknown actionable finding');
    expect(() => ledger.addFromFinding(turn(), 'missing', 3))
      .toThrow('Cannot add a task from an unknown actionable finding');
    expect(() => ledger.addFromFinding(turn(), 'finding-1', 4))
      .toThrow('Cannot add a task from a stale excerpt turn');
  });

  it('enforces list and edit bounds while preserving the first source text', () => {
    let now = 0;
    const ledger = new WorkshopTodoLedger(() => ++now);
    const findings = Array.from(
      { length: WORKSHOP_TODO_BOUNDS.items + 1 },
      (_, index) => finding(`finding-${index}`)
    );
    const sourceTurn = turn({ actionableFindings: findings });

    for (let index = 0; index < WORKSHOP_TODO_BOUNDS.items; index += 1) {
      ledger.addFromFinding(sourceTurn, `finding-${index}`, 3);
    }

    expect(ledger.addFromFinding(sourceTurn, 'finding-0', 3).id).toMatch(/^todo-1-/);
    expect(() => ledger.addFromFinding(
      sourceTurn,
      `finding-${WORKSHOP_TODO_BOUNDS.items}`,
      3
    )).toThrow(`Workshop task list is limited to ${WORKSHOP_TODO_BOUNDS.items} items`);

    const first = ledger.list(3)[0];
    expect(() => ledger.edit(first.id, '   ', 3)).toThrow(
      `Task text must contain 1–${WORKSHOP_TODO_BOUNDS.textCharacters} characters`
    );
    expect(() => ledger.edit(
      first.id,
      'x'.repeat(WORKSHOP_TODO_BOUNDS.textCharacters + 1),
      3
    )).toThrow(`Task text must contain 1–${WORKSHOP_TODO_BOUNDS.textCharacters} characters`);

    const edited = ledger.edit(first.id, '  Revised task.  ', 3);
    ledger.edit(first.id, 'Revised again.', 3);
    expect(edited.text).toBe('Revised task.');
    expect(ledger.list(3)[0].writerEdit?.originalText).toBe(first.source.findingText);
  });

  it('reorders tasks and collects only current open work', () => {
    const ledger = new WorkshopTodoLedger(() => 1);
    const sourceTurn = turn({
      actionableFindings: [finding('first'), finding('second'), finding('third')]
    });
    const first = ledger.addFromFinding(sourceTurn, 'first', 3);
    const second = ledger.addFromFinding(sourceTurn, 'second', 3);
    const third = ledger.addFromFinding(sourceTurn, 'third', 3);

    ledger.reorder(first.id, 'up');
    ledger.reorder(second.id, 'up');
    expect(ledger.list(3).map((todo) => todo.id)).toEqual([second.id, first.id, third.id]);

    ledger.setStatus(first.id, 'completed', 3);
    ledger.setStatus(third.id, 'dismissed', 3);
    expect(ledger.collectOpen(3).map((todo) => todo.id)).toEqual([second.id]);
    expect(ledger.collectOpen(4)).toEqual([]);
    expect(() => ledger.reorder('todo-missing', 'down')).toThrow('Unknown Workshop task');
    expect(() => ledger.edit('todo-missing', 'No.', 3)).toThrow('Unknown Workshop task');
    expect(() => ledger.setStatus('todo-missing', 'open', 3)).toThrow('Unknown Workshop task');
  });

  it('derives staleness from the supplied version without mutating ledger state', () => {
    const ledger = new WorkshopTodoLedger(() => 1);
    ledger.addFromFinding(turn(), 'finding-1', 3);
    const before = ledger.exportState();

    expect(ledger.list(3)[0].stale).toBe(false);
    expect(ledger.list(4)[0].stale).toBe(true);
    expect(ledger.collectOpen(4)).toEqual([]);
    expect(ledger.exportState()).toEqual(before);
  });

  it('exports, prepares, installs, and resets without leaking references or reusing ids', () => {
    const source = new WorkshopTodoLedger(() => 1);
    const added = source.addFromFinding(turn(), 'finding-1', 3);
    source.edit(added.id, 'Edited task.', 3);

    const exported = source.exportState();
    exported.todos[0].source.findingText = 'Mutated export.';
    exported.todos[0].writerEdit!.originalText = 'Mutated edit.';
    expect(source.list(3)[0]).toEqual(expect.objectContaining({
      source: expect.objectContaining({ findingText: 'Tighten the opening.' }),
      writerEdit: expect.objectContaining({ originalText: 'Tighten the opening.' })
    }));

    const hydrationInput = source.exportState();
    const restored = new WorkshopTodoLedger(() => 5);
    const prepared = restored.prepareState(hydrationInput);
    hydrationInput.todos[0].source.findingText = 'Mutated hydration input.';
    hydrationInput.todos[0].writerEdit!.originalText = 'Mutated hydration edit.';
    restored.installPreparedState(prepared);

    expect(restored.list(3)[0]).toEqual(expect.objectContaining({
      source: expect.objectContaining({ findingText: 'Tighten the opening.' }),
      writerEdit: expect.objectContaining({ originalText: 'Tighten the opening.' })
    }));

    restored.reset();
    expect(restored.exportState()).toEqual({ counter: 1, todos: [] });
    expect(restored.addFromFinding(turn({ id: 'turn-2' }), 'finding-1', 3).id)
      .toBe('todo-2-5');
  });
});
