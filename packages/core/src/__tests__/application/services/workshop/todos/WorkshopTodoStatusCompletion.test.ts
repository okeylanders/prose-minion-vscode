/**
 * A persona's to-do status changes, from the reply to the line it reads
 * next (ADR 2026-11-19 D2–D8), through the production extractor, completion,
 * session, outcome record and frame:
 *
 * - the open room's changes land in the reply's own commit, with `closedBy`;
 * - a saved session's rows commit `saving`, and the post-commit write
 *   settles them (here over a fake port: the saved-session write port's
 *   implementation waits for the revised D6);
 * - one case per drop reason, end to end: frame, record, phrase;
 * - bounds: the 21st change and the 11th saved session drop as `over-cap`;
 * - conservation: rows plus drops equal the frames found;
 * - logs, records and lines hold ids and counts, never a to-do's text, a
 *   note or a title.
 */

import { WorkshopTodoStatusWrites } from '@/application/services/workshop/todos/WorkshopTodoStatusWrites';
import { workshopTrailerOutcomesFrameFor } from '@/application/services/workshop/trailerOutcomes/WorkshopTrailerOutcomesFrame';
import { extractWorkshopReplyControls, stripWorkshopReplyTrailersForRetention } from '@/utils/workshopReplyControls';
import { WORKSHOP_TRAILER_DROP_REASON_WORDS, WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS } from '@shared/constants/workshopTrailerOutcomeWords';
import type { WorkshopTodoTrailerDropReason } from '@shared/types/workshopTrailerOutcomes';
import type { WorkshopTurn } from '@messages';
import {
  FakeSavedSessionTodos,
  NOTE_SENTINEL,
  replyWith,
  roomWithTodos,
  TITLE_SENTINEL,
  TODO_TEXT_SENTINEL,
  todoFrame
} from './todoStatusFixtures';

const HOST = { kind: 'host' } as const;
const phrase = (reason: WorkshopTodoTrailerDropReason, count = 1): string => `${count} dropped (${WORKSHOP_TRAILER_DROP_REASON_WORDS[reason]})`;

function writesFor(session: ReturnType<typeof roomWithTodos>['session'], port: FakeSavedSessionTodos, log = jest.fn()) {
  return new WorkshopTodoStatusWrites(session, port, { isSessionOperationPending: () => false, waitForSessionOperations: async () => undefined },
    { settleRoom: jest.fn(), log });
}

function conserved(turn: WorkshopTurn, frames: number): void {
  const todos = turn.trailerOutcomes?.todos;
  expect(todos).toBeDefined();
  expect(todos!.changes + todos!.dropped.reduce((sum, drop) => sum + drop.count, 0)).toBe(frames);
  expect(todos!.changes).toBe(turn.todoStatusChanges?.length ?? 0);
}

describe('the open room (D5)', () => {
  it('a reply with three frames lands three changes in its own commit, with closedBy', () => {
    const { session, todos } = roomWithTodos(3);
    const turn = replyWith(session, [
      'Both handled.',
      todoFrame({ todo: todos[0].id }),
      todoFrame({ todo: todos[1].id, status: 'dismissed', note: NOTE_SENTINEL }),
      todoFrame({ todo: todos[2].id, status: 'Completed' })
    ].join('\n\n'));
    const after = session.getSnapshot().todos;
    expect(after.map((todo) => todo.status)).toEqual(['completed', 'dismissed', 'completed']);
    expect(after[1].closedBy).toEqual({
      personaId: 'jill', personaLabel: 'Jill', sessionId: 'current', sessionTitle: 'This session',
      turnId: turn.id, at: turn.timestamp, operationId: turn.todoStatusChanges![1].operationId, note: NOTE_SENTINEL
    });
    // One operation for the open room's changes (D8a).
    expect(new Set(turn.todoStatusChanges!.map((row) => row.operationId)).size).toBe(1);
    expect(turn.content).toBe('Both handled.');
    expect(turn.todoStatusChanges?.map((row) => [row.session, row.status, row.state])).toEqual([
      ['current', 'completed', 'applied'], ['current', 'dismissed', 'applied'], ['current', 'completed', 'applied']
    ]);
    conserved(turn, 3);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain("Your last reply's to-do changes: 3 made.");
  });

  it('a reply of to-do changes alone keeps the host line, in the ledger and in retention', () => {
    const { session, todos } = roomWithTodos(1);
    const reply = todoFrame({ todo: todos[0].id });
    expect(replyWith(session, reply).content).toBe('Updated to-dos.');
    expect(stripWorkshopReplyTrailersForRetention(reply)).toBe('Updated to-dos.');
  });

  it("the writer's own toggle clears closedBy", () => {
    const { session, todos } = roomWithTodos(1);
    replyWith(session, todoFrame({ todo: todos[0].id }));
    expect(session.findTodo(todos[0].id)?.closedBy).toBeDefined();
    session.setTodoStatus(todos[0].id, 'open');
    expect(session.findTodo(todos[0].id)?.closedBy).toBeUndefined();
    session.setTodoStatus(todos[0].id, 'completed');
    expect(session.findTodo(todos[0].id)?.closedBy).toBeUndefined();
  });

  it('an id naming the open room reads as current', async () => {
    const { session, todos } = roomWithTodos(1);
    const port = new FakeSavedSessionTodos();
    const content = todoFrame({ session: port.openRoomId, todo: todos[0].id });
    const context = await writesFor(session, port).context(content);
    const turn = replyWith(session, content, { todoStatus: context });
    expect(turn.todoStatusChanges?.[0]).toMatchObject({ session: 'current', state: 'applied', sessionTitle: 'Polish 6.11' });
    expect(session.findTodo(todos[0].id)?.closedBy?.sessionId).toBe(port.openRoomId);
  });
});

describe('one case per drop reason, end to end (D7)', () => {
  const cases: ReadonlyArray<readonly [WorkshopTodoTrailerDropReason, (ids: string[]) => string, (port: FakeSavedSessionTodos) => void]> = [
    ['malformed', () => todoFrame({ todo: 'todo 1', status: 'completed' }), () => undefined],
    ['misplaced', (ids) => `${todoFrame({ todo: ids[0] })}\n\nAnd one more thought.`, () => undefined],
    ['duplicate', (ids) => `${todoFrame({ todo: ids[0] })}\n${todoFrame({ todo: ids[0], status: 'dismissed' })}`, () => undefined],
    ['todo-not-found', () => todoFrame({ todo: 'todo-99-1' }), () => undefined],
    ['todo-not-open', () => todoFrame({ session: 'alice-saved', todo: 'todo-2-1' }), (port) => port.addSession('alice-saved', [['todo-2-1', 'completed']])],
    ['session-not-found', () => todoFrame({ session: 'alice-gone', todo: 'todo-1-1' }), () => undefined],
    ['session-unreadable', () => todoFrame({ session: 'alice-bad', todo: 'todo-1-1' }), (port) => port.refusals.set('alice-bad', 'session-needs-recovery')],
    ['sessions-unavailable', () => todoFrame({ session: 'alice-away', todo: 'todo-1-1' }), (port) => port.refusals.set('alice-away', 'workspace-changed')]
  ];

  it.each(cases)('%s: one drop, no row, and its phrase in the next message', async (reason, frame, arrange) => {
    const { session, todos } = roomWithTodos(1);
    const port = new FakeSavedSessionTodos();
    arrange(port);
    const content = frame(todos.map((todo) => todo.id));
    const log = jest.fn();
    const turn = replyWith(session, content, { todoStatus: await writesFor(session, port).context(content), log });
    const frames = extractWorkshopReplyControls(content, { memoryOpen: false }).todoStatus!;
    const total = frames.changes.length + frames.rejections.length;
    conserved(turn, total);
    expect(turn.trailerOutcomes?.todos?.dropped.find((drop) => drop.reason === reason)?.count).toBe(1);
    const next = workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)!;
    expect(next).toContain(phrase(reason));
    const text = `${JSON.stringify(turn.trailerOutcomes)}\n${next}\n${log.mock.calls.flat().join('\n')}`;
    for (const forbidden of [TODO_TEXT_SENTINEL, NOTE_SENTINEL, TITLE_SENTINEL]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('a saved change with no resolved context is not available now, and the open room still lands', () => {
    const { session, todos } = roomWithTodos(1);
    const turn = replyWith(session, `${todoFrame({ todo: todos[0].id })}\n${todoFrame({ session: 'alice-saved', todo: 'todo-1-1' })}`);
    expect(turn.todoStatusChanges).toHaveLength(1);
    expect(turn.trailerOutcomes?.todos?.dropped).toEqual([{ reason: 'sessions-unavailable', count: 1 }]);
  });
});

describe('bounds (D3)', () => {
  it('the 21st change drops as over-cap', () => {
    const { session, todos } = roomWithTodos(21);
    const turn = replyWith(session, todos.map((todo) => todoFrame({ todo: todo.id })).join('\n'));
    expect(turn.todoStatusChanges).toHaveLength(20);
    expect(turn.trailerOutcomes?.todos?.dropped).toEqual([{ reason: 'over-cap', count: 1 }]);
    expect(session.findTodo(todos[20].id)?.status).toBe('open');
  });

  it('a frame naming an 11th saved session drops as over-cap, before anything reads it', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    const read = jest.spyOn(port, 'read');
    for (let index = 1; index <= 11; index += 1) {
      port.addSession(`alice-${index}`, [[`todo-${index}-1`, 'open']]);
    }
    const content = Array.from({ length: 11 }, (_, index) => todoFrame({ session: `alice-${index + 1}`, todo: `todo-${index + 1}-1` })).join('\n');
    const turn = replyWith(session, content, { todoStatus: await writesFor(session, port).context(content) });
    expect(read).toHaveBeenCalledTimes(10);
    expect(turn.todoStatusChanges).toHaveLength(10);
    expect(turn.trailerOutcomes?.todos?.dropped).toEqual([{ reason: 'over-cap', count: 1 }]);
  });
});

describe('a saved session (D5): rows commit saving, then settle', () => {
  it('commits saving, writes once per session with every row, and settles applied', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open'], ['todo-2-1', 'open']]);
    const content = `${todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' })}\n${todoFrame({ session: 'alice-ch6', todo: 'todo-2-1', status: 'dismissed' })}`;
    const context = (await writesFor(session, port).context(content))!;
    const turn = replyWith(session, content, { todoStatus: context });
    expect(turn.todoStatusChanges?.map((row) => row.state)).toEqual(['saving', 'saving']);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain('2 being saved');
    await context.settled?.();
    expect(port.writes).toHaveLength(1);
    expect(port.writes[0].changes.map((change) => change.closedBy?.turnId)).toEqual([turn.id, turn.id]);
    expect(port.writes[0].changes.map((change) => change.closedBy?.operationId)).toEqual(turn.todoStatusChanges!.map((row) => row.operationId));
    expect(port.sessions.get('alice-ch6')!.todos.map((todo) => todo.status)).toEqual(['completed', 'dismissed']);
    const settled = session.readRoomLedger().find((candidate) => candidate.id === turn.id)!;
    expect(settled.todoStatusChanges?.map((row) => row.state)).toEqual(['applied', 'applied']);
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain('2 made');
  });

  it('a file changed between settlement and write: refused, nothing overwritten, and the next message says so', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open']]);
    const content = todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' });
    const context = (await writesFor(session, port).context(content))!;
    port.touch('alice-ch6');
    const turn = replyWith(session, content, { todoStatus: context });
    await context.settled?.();
    expect(port.sessions.get('alice-ch6')!.todos[0].status).toBe('open');
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges?.[0])
      .toMatchObject({ state: 'refused', reason: 'session-changed' });
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST))
      .toContain(`1 not written (${WORKSHOP_TODO_STATUS_WRITE_REFUSAL_WORDS['session-changed']})`);
  });

  it('a reply that never commits writes nothing', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open']]);
    const content = todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' });
    const context = (await writesFor(session, port).context(content))!;
    session.beginPersonaMessage('stopped', 'Go.');
    session.abandonRun('stopped');
    expect(context.settled?.()).toBeUndefined();
    expect(port.writes).toEqual([]);
  });

  it('a Rewind (the reply gone) before the post-commit write leaves the rows unwritten', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open']]);
    const content = todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' });
    const log = jest.fn();
    const writes = writesFor(session, port, log);
    const context = (await writes.context(content))!;
    const turn = replyWith(session, content, { todoStatus: { ...context, afterCommit: undefined } });
    jest.spyOn(session, 'readRoomLedger').mockReturnValue([]);
    await writes.write(turn.id, [{ read: (await port.read('alice-ch6')) as never, indexes: [0] }], context.openRoom);
    expect(port.writes).toEqual([]);
    expect(log.mock.calls.flat().join('\n')).toContain('reason=room-changed');
  });
});

describe('Undo (D8)', () => {
  it('reopens an open-room change while the to-do still holds it, and refuses one changed since', async () => {
    const { session, todos } = roomWithTodos(2);
    const port = new FakeSavedSessionTodos();
    const turn = replyWith(session, `${todoFrame({ todo: todos[0].id })}\n${todoFrame({ todo: todos[1].id })}`);
    const writes = writesFor(session, port);
    const revision = session.readRoomRevision();
    expect(await writes.undo(turn.id, 0, revision)).toEqual({ ok: true });
    expect(session.findTodo(todos[0].id)).toMatchObject({ status: 'open' });
    expect(session.findTodo(todos[0].id)?.closedBy).toBeUndefined();
    expect(await writes.undo(turn.id, 0, revision)).toEqual({ ok: false, reason: 'not-undoable' });
    session.setTodoStatus(todos[1].id, 'completed');
    expect(await writes.undo(turn.id, 1, revision)).toEqual({ ok: false, reason: 'todo-changed' });
    expect(await writes.undo(turn.id, 1, revision + 1)).toEqual({ ok: false, reason: 'room-changed' });
    expect(await writes.undo(turn.id, 7, revision)).toEqual({ ok: false, reason: 'no-row' });
  });

  it('undoes a saved change through the port, and offers none from another room', async () => {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open']]);
    const content = todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' });
    const writes = writesFor(session, port);
    const context = (await writes.context(content))!;
    const turn = replyWith(session, content, { todoStatus: context });
    await context.settled?.();
    port.openRoomId = 'room-branch';
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: false, reason: 'elsewhere' });
    port.openRoomId = 'room-alice';
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: true });
    expect(port.sessions.get('alice-ch6')!.todos[0]).toMatchObject({ status: 'open' });
    expect(port.sessions.get('alice-ch6')!.todos[0].closedBy).toBeUndefined();
  });
});

describe('a row left saving across a restart (D8a)', () => {
  async function savingRow(stamped: boolean) {
    const { session } = roomWithTodos(0);
    const port = new FakeSavedSessionTodos();
    port.addSession('alice-ch6', [['todo-1-1', 'open']]);
    const content = todoFrame({ session: 'alice-ch6', todo: 'todo-1-1' });
    const before = writesFor(session, port);
    const context = (await before.context(content))!;
    // The window closes after the commit, before (or after) the write lands: no write runs here.
    const turn = replyWith(session, content, { todoStatus: { ...context, afterCommit: undefined } });
    const row = turn.todoStatusChanges![0];
    if (stamped) {
      const read = await port.read('alice-ch6');
      await port.write(read as never, [{ todoId: 'todo-1-1', status: 'completed', closedBy: {
        personaId: 'jill', personaLabel: 'Jill', sessionId: 'room-alice', sessionTitle: 'Polish 6.11', turnId: turn.id, at: 1, operationId: row.operationId
      } }]);
    }
    port.writes.length = 0;
    return { session, port, turn, writes: writesFor(session, port) };
  }

  it('with no stamp in the file reads interrupted, and is never retried', async () => {
    const { session, port, turn, writes } = await savingRow(false);
    await writes.reconcile();
    const row = session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges![0];
    expect(row).toMatchObject({ state: 'interrupted' });
    expect(row.reason).toBeUndefined();
    expect(port.writes).toEqual([]);
    expect(port.sessions.get('alice-ch6')!.todos[0].status).toBe('open');
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain('1 not written (Prose Minion closed before it was saved)');
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: false, reason: 'not-undoable' });
  });

  it('with its stamp reads applied, and Undo works on it', async () => {
    const { session, port, turn, writes } = await savingRow(true);
    await writes.reconcile();
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges![0].state).toBe('applied');
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: true });
    expect(port.sessions.get('alice-ch6')!.todos[0].status).toBe('open');
  });

  it('a to-do the writer reopened after the write is left open, and Undo says it changed since', async () => {
    const { session, port, turn, writes } = await savingRow(true);
    const stored = port.sessions.get('alice-ch6')!;
    stored.todos = stored.todos.map(({ closedBy: _gone, ...todo }) => ({ ...todo, status: 'open' }));
    stored.version += 1;
    await writes.reconcile();
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges![0].state).toBe('interrupted');
    expect(port.writes).toEqual([]);
    expect(stored.todos[0].status).toBe('open');
  });

  it('a session that cannot be read reads unverified, not yet confirmed, and offers no Undo', async () => {
    const { session, port, turn, writes } = await savingRow(false);
    port.refusals.set('alice-ch6', 'store-unavailable');
    await writes.reconcile();
    expect(session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges![0]).toMatchObject({ state: 'unverified' });
    expect(workshopTrailerOutcomesFrameFor(session.readRoomLedger(), HOST)).toContain('1 not yet confirmed');
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: false, reason: 'not-undoable' });
  });

  it('unverified is not final (D8b): busy, then readable with the stamp, gives applied with Undo, and no second write', async () => {
    const { session, port, turn, writes } = await savingRow(true);
    const write = jest.spyOn(port, 'write');
    port.refusals.set('alice-ch6', 'store-unavailable');
    await writes.reconcile();
    const row = () => session.readRoomLedger().find((candidate) => candidate.id === turn.id)!.todoStatusChanges![0];
    expect(row().state).toBe('unverified');
    port.refusals.delete('alice-ch6');
    await writes.reconcile();
    expect(row().state).toBe('applied');
    expect(write).not.toHaveBeenCalled();
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: true });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][1]).toEqual([{ todoId: 'todo-1-1', status: 'open' }]);
  });

  it('Undo on an unverified row re-checks first, read-only', async () => {
    const { session, port, turn, writes } = await savingRow(true);
    port.refusals.set('alice-ch6', 'store-unavailable');
    await writes.reconcile();
    port.refusals.delete('alice-ch6');
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: true });
  });

  it('Undo on a row still saving reconciles first', async () => {
    const { session, turn, writes } = await savingRow(true);
    expect(await writes.undo(turn.id, 0, session.readRoomRevision())).toEqual({ ok: true });
  });
});
