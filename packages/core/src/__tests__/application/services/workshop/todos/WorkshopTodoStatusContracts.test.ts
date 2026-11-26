/**
 * The to-do status contracts around the commit (ADR 2026-11-19 D2, D4, D6,
 * D8, D9): the codec and its authentic before-fixture, the frame decoder's
 * faults, the snapshot's ids and bound, what the webview and the transcript
 * get, and the module boundaries (recall stays read-only; only the store
 * replaces a named file). *Alice*, made-up ids.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  decodeWorkshopPersistedSessionCheckpoint,
  parseWorkshopPersistedSession
} from '@/application/services/workshop/WorkshopPersistedSession';
import { buildWorkshopTodoEvidence } from '@/application/services/workshop/WorkshopPromptBuilder';
import { workshopTurnForWebview } from '@/application/services/workshop/fileEdits/WorkshopFileEditWebviewView';
import { projectWorkshopTranscript } from '@/application/services/workshop/transcript/WorkshopTranscript';
import { decodeWorkshopTodoStatus } from '@/utils/workshopReplyTodoStatus';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopTodoItem, WorkshopTurn } from '@messages';
import { replyWith, roomWithTodos, TODO_TEXT_SENTINEL, TITLE_SENTINEL, todoFrame } from './todoStatusFixtures';

const SRC = path.resolve(__dirname, '../../../../..');
const FIXTURE = JSON.stringify(require('../../../../fixtures/workshop-session-v2-before-todo-status.json'));

describe('the session codec (D9; ADR 2026-07-30)', () => {
  it('reads the authentic session from before the change byte for byte', () => {
    expect(FIXTURE).not.toContain('closedBy');
    expect(FIXTURE).not.toContain('todoStatusChanges');
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(FIXTURE)))).toBe(FIXTURE);
    const reopened = decodeWorkshopPersistedSessionCheckpoint(JSON.parse(FIXTURE));
    // The development checkpoint normalization this fixture's room needs is main's own, never a to-do change.
    expect(reopened.normalizations).not.toContain(expect.stringMatching(/todo/i));
    expect(reopened.session.workshop.todos.map((todo) => todo.status)).toEqual(['open', 'completed', 'dismissed']);
  });

  it('round-trips closedBy and the receipt rows, and refuses each malformed shape', () => {
    const base = JSON.parse(FIXTURE);
    const turn = base.workshop.turns.find((candidate: WorkshopTurn) => candidate.role === 'assistant');
    const closedBy = { personaId: 'jill', personaLabel: 'Jill', sessionId: 'room-alice', sessionTitle: 'Polish 6.11', turnId: turn.id, at: 1, operationId: 'op-1' };
    base.workshop.todos[1].closedBy = closedBy;
    turn.todoStatusChanges = [{
      session: 'current', sessionTitle: 'Polish 6.11', todoId: base.workshop.todos[1].id, todoText: 'Let the White Rabbit enter sooner.',
      status: 'completed', previous: 'open', state: 'applied', operationId: 'op-1'
    }, {
      session: 'alice-ch6', sessionTitle: 'Chapter 6', todoId: 'todo-1-1', todoText: 'Name the sister once.',
      status: 'dismissed', previous: 'open', state: 'unverified', operationId: 'op-2', roomSessionId: 'room-alice'
    }];
    const text = JSON.stringify(base);
    expect(JSON.stringify(parseWorkshopPersistedSession(JSON.parse(text)))).toBe(text);
    const broken: Array<(value: typeof base) => void> = [
      (value) => { delete value.workshop.todos[1].closedBy.operationId; },
      (value) => { value.workshop.todos[1].closedBy.extra = 1; },
      (value) => { value.workshop.turns.find((candidate: WorkshopTurn) => candidate.todoStatusChanges).todoStatusChanges[0].status = 'open'; },
      (value) => { value.workshop.turns.find((candidate: WorkshopTurn) => candidate.todoStatusChanges).todoStatusChanges[0].reason = 'session-changed'; },
      (value) => { value.workshop.turns.find((candidate: WorkshopTurn) => candidate.todoStatusChanges).todoStatusChanges[1].reason = 'session-changed'; },
      (value) => { value.workshop.turns.find((candidate: WorkshopTurn) => candidate.todoStatusChanges).todoStatusChanges = []; },
      (value) => { value.workshop.turns.find((candidate: WorkshopTurn) => candidate.todoStatusChanges).todoStatusChanges[0].elsewhere = true; }
    ];
    for (const breakIt of broken) {
      const value = JSON.parse(text);
      breakIt(value);
      expect(() => parseWorkshopPersistedSession(value)).toThrow();
    }
  });
});

describe('the frame decoder (D2)', () => {
  it.each([
    ['<session>current</session><todo>todo-1-1</todo><status>completed</status><session>x</session>', 'repeated-element'],
    ['<todo>todo-1-1</todo><status>completed</status>', 'missing-session'],
    ['<session>current</session><status>completed</status>', 'missing-todo'],
    ['<session>current</session><todo>todo 1</todo><status>completed</status>', 'invalid-todo'],
    ['<session>current</session><todo>todo-1-1</todo>', 'missing-status'],
    ['<session>current</session><todo>todo-1-1</todo><status>open</status>', 'unknown-status'],
    [`<session>current</session><todo>todo-1-1</todo><status>completed</status><note>${'x'.repeat(PROMPT_BUDGETS.workshopTodoStatus.noteCharacters + 1)}</note>`, 'invalid-note'],
    ['<session>current</session><todo>todo-1-1</todo><status>completed</status><why>no</why>', 'unknown-element']
  ])('%s is %s', (inner, fault) => {
    expect(decodeWorkshopTodoStatus(inner)).toEqual({ kind: 'rejected', fault });
  });
});

describe('the snapshot (D4)', () => {
  const todo = (index: number): WorkshopTodoItem => ({
    id: `todo-${index}-1763500000000`,
    text: 'x'.repeat(500),
    status: 'open',
    priority: 'high',
    source: { kind: 'host_turn', turnId: `turn-${index}-assistant-1763500000000`, participantLabel: 'Jill', personaId: 'jill', findingKey: `finding-${index}`, findingText: 'y'.repeat(500), excerptVersion: 1 },
    createdAt: 1,
    stale: false
  });

  it('shows each id first, and stays within its bound with the most a block can hold', () => {
    const evidence = buildWorkshopTodoEvidence(Array.from({ length: 12 }, (_, index) => todo(index + 1)))!;
    expect(evidence.message).toContain('<writer-owned-task>\nId: todo-1-1763500000000\nTask: ');
    expect(evidence.message.length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopTodos.characters);
    expect(evidence.message).toContain('you may mark it with a to-do status note');
  });
});

describe('what the webview and the transcript get (D5, D8)', () => {
  it('the webview gets the rows without roomSessionId, a saved row from another room marked elsewhere', () => {
    const { session, todos } = roomWithTodos(1);
    const turn = replyWith(session, todoFrame({ todo: todos[0].id }));
    const withSaved: WorkshopTurn = {
      ...turn,
      todoStatusChanges: [...turn.todoStatusChanges!, { ...turn.todoStatusChanges![0], session: 'alice-ch6', roomSessionId: 'room-alice', state: 'applied' }]
    };
    const room = { fileEditsOpen: false, runActive: false, ledger: () => [], authorPresent: () => true };
    const here = workshopTurnForWebview(withSaved, { ...room, liveSessionId: () => 'room-alice' }).todoStatusChanges!;
    expect(here.map((row) => [row.roomSessionId, row.elsewhere])).toEqual([[undefined, undefined], [undefined, undefined]]);
    const branch = workshopTurnForWebview(withSaved, { ...room, liveSessionId: () => 'room-branch' }).todoStatusChanges!;
    expect(branch.map((row) => row.elsewhere)).toEqual([undefined, true]);
  });

  it('the transcript shows a receipt as one event line of counts, never a to-do text or a title', () => {
    const { session, todos } = roomWithTodos(2);
    replyWith(session, `Done.\n\n${todoFrame({ todo: todos[0].id })}\n${todoFrame({ todo: todos[1].id, status: 'dismissed' })}`);
    const transcript = projectWorkshopTranscript(session.readRoomLedger(), { title: 'Polish', exportedAt: 1 });
    const events = transcript.entries.filter((entry) => entry.kind === 'event').map((entry) => (entry as { text: string }).text);
    expect(events).toContain('Marked 2 to-dos: 1 done, 1 dismissed');
    expect(JSON.stringify(transcript)).not.toContain(TODO_TEXT_SENTINEL);
    expect(JSON.stringify(transcript)).not.toContain(TITLE_SENTINEL);
  });
});

describe('boundaries (D6, D6a, D6b)', () => {
  const read = (dir: string): Array<[string, string]> => fs.readdirSync(path.join(SRC, dir))
    .filter((name) => name.endsWith('.ts'))
    .map((name) => [name, fs.readFileSync(path.join(SRC, dir, name), 'utf8')]);

  it('recall never imports the to-do write port, and the port imports nothing of recall', () => {
    for (const [name, text] of read('application/services/workshop/recall')) {
      expect([name, /workshop\/todos\//.test(text)]).toEqual([name, false]);
    }
    for (const [name, text] of read('application/services/workshop/todos')) {
      expect([name, /workshop\/recall\//.test(text)]).toEqual([name, false]);
    }
  });

  it('the store replaces a named file only under its lock, never by an overwriting rename', () => {
    const store = fs.readFileSync(path.join(SRC, 'infrastructure/storage/WorkshopSessionStore.ts'), 'utf8');
    const updateNamed = store.slice(store.indexOf('  async updateNamed('), store.indexOf('  async readNamed('));
    expect(updateNamed).toContain('this.named.replace(');
    expect(updateNamed).not.toMatch(/writeSnapshotWithSearchIndex|overwrite: true/);
    const deleteNamed = store.slice(store.indexOf('  async deleteNamed('), store.indexOf('  async resolveRevealPath('));
    expect(deleteNamed).toContain('this.named.remove(');
    const lock = fs.readFileSync(path.join(SRC, 'infrastructure/storage/WorkshopNamedSessionLock.ts'), 'utf8');
    // D6b: the publish renames from inside the lock, never over anything.
    expect(lock).toMatch(/rename\(staged, target\.filePath, \{ overwrite: false \}\)/);
    expect(lock).not.toMatch(/overwrite: true/);
    // Named creation may only allocate a new path. Rolling replacement additionally requires
    // a slot lock and exact observed revision, and initially absent files must be created exclusively.
    const writes = [...store.matchAll(/this\.writeSnapshotWithSearchIndex\(\s*([\s\S]*?)\s*\);/g)]
      .map(match => match[1].replace(/\s+/g, ' ').trim());
    expect(writes.sort()).toEqual([
      'paths, filePath, fileName, decoded, false',
      "paths, paths.currentPath, this.currentFileName, decoded, expected !== 'absent', verify, replace"
    ]);
    const rolling = store.slice(store.indexOf('  async writeCurrent('), store.indexOf('  private async readRollingRevision('));
    expect(rolling).toMatch(/withRollingLock\(paths\.currentPath[\s\S]+readRollingRevision\(paths\.currentPath\)[\s\S]+latest !== expected[\s\S]+throw new WorkshopRollingCheckpointConflictError[\s\S]+this\.writeSnapshotWithSearchIndex/);
  });
});
