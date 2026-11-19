/**
 * Every named-session writer holds the file's lock (ADR 2026-11-19 D6a,
 * D6b): two stores over one folder (two windows), with held promises so
 * both writers have read and validated the same checkpoint before either
 * takes the lock. Exactly one commits; the other is refused in host words; the file
 * is the winner's, byte for byte. Run for an autosave against the persona's
 * write, and for a rename against an autosave. Also: a stale save after a
 * completed write is refused (the compare), and an abandoned lock is taken
 * back and the next write succeeds. *Alice*, made-up ids.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopNamedSessionChangedError, WorkshopSessionStore } from '@/infrastructure/storage/WorkshopSessionStore';
import { WorkshopNamedSessionBusyError, WORKSHOP_NAMED_SESSION_BUSY_WORDS } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import { WorkshopSavedSessionTodoStore } from '@/application/services/workshop/todos/WorkshopSavedSessionTodoStore';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { LogSink, Workspace } from '@/platform';

const root = '/workspace/novel';
const directory = `${root}/prose-minion/sessions`;
const now = () => new Date('2026-11-19T12:00:00.000Z');
const workspace: Workspace = { workspaceFolders: () => [{ name: 'novel', path: root }], extensionPath: '/extension', asRelativePath: (value) => value, findFiles: async () => [] };
const log = (): LogSink & { appendLine: jest.Mock } => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });

/** A folder whose lock renames wait until both writers reach theirs, and whose first publish waits for the test. */
class GatedFileSystem extends MemoryFileSystem {
  private arrived = 0;
  private open!: () => void;
  private readonly bothClaiming = new Promise<void>((resolve) => { this.open = resolve; });
  private commits = 0;
  releaseFirstCommit!: () => void;
  private readonly firstCommit = new Promise<void>((resolve) => { this.releaseFirstCommit = resolve; });
  gate = false;

  override async rename(fromPath: string, toPath: string, options?: { overwrite?: boolean }): Promise<void> {
    if (this.gate && fromPath.includes('.lock.staged-') && toPath.endsWith('.json.lock')) {
      this.arrived += 1;
      if (this.arrived === 2) {
        this.open();
      }
      await this.bothClaiming;
    } else if (this.gate && fromPath.endsWith('/next.json')) {
      this.commits += 1;
      if (this.commits === 1) {
        await this.firstCommit;
      }
    }
    return super.rename(fromPath, toPath, options);
  }
}

function aliceSession(): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => now().getTime());
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  session.beginPersonaMessage('seed', 'What should I fix?');
  const reply = session.completeRun('seed', 'Here is my read.', undefined, false, 'host-conv', [{ key: 'finding-1', text: 'Let the White Rabbit enter sooner.', ordinal: 1 }])!;
  session.addTodoFromFinding(reply.id, 'finding-1');
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title: 'Polish 6.11',
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 2, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

function persona(store: WorkshopSessionStore) {
  return new WorkshopSavedSessionTodoStore(store, {
    recallScope: () => ({ available: true, liveSessionId: 'room-other' }),
    openRoomIdentity: () => ({ sessionId: 'room-other', title: 'Polish' }),
    runSavedSessionOperation: (operation) => operation()
  }, log(), now);
}

async function setup() {
  const fs = new GatedFileSystem();
  const [left, right] = [new WorkshopSessionStore(fs, workspace, log(), now), new WorkshopSessionStore(fs, workspace, log(), now)];
  const saved = await left.saveNamed(aliceSession());
  const filePath = `${directory}/${saved.fileName}`;
  return { fs, left, right, saved, filePath };
}

const textOf = (fs: MemoryFileSystem, filePath: string): string => Buffer.from(fs.files.get(filePath)!).toString('utf8');

describe('overlapping named-session writers (D6a)', () => {
  /** Run two writers; the first to settle is the loser (the winner's commit is held), then release it. */
  async function race(fs: GatedFileSystem, first: Promise<string | Error>, second: Promise<string | Error>) {
    const tagged = [first.then((value) => ({ at: 0, value })), second.then((value) => ({ at: 1, value }))];
    const loser = await Promise.race(tagged);
    fs.releaseFirstCommit();
    const winner = await tagged[1 - loser.at];
    return { loser: loser.value, winner: winner.value, winnerAt: winner.at };
  }

  const busy = (error: unknown): boolean => error instanceof WorkshopNamedSessionBusyError && error.message === WORKSHOP_NAMED_SESSION_BUSY_WORDS;

  it('an autosave against the persona write: exactly one commits, the other is refused as busy, the file is the winner\'s', async () => {
    const { fs, left, right, filePath } = await setup();
    const expected = (await left.readNamed('alice-polish'))!;
    const read = await persona(right).read('alice-polish');
    expect(read.kind).toBe('read');
    const autosaved = { ...expected, workshop: { ...expected.workshop, excerpt: { ...expected.workshop.excerpt!, text: 'Alice, in the autosave.' } } };
    fs.gate = true;
    const autosave = left.updateNamed('alice-polish', autosaved, expected).then(() => 'committed', (error: Error) => error);
    const personaWrite = persona(right).write(read as never, [{ todoId: expected.workshop.todos[0].id, status: 'completed' }])
      .then((result) => (result.kind === 'written' ? 'committed' : result.reason === 'session-busy' ? new WorkshopNamedSessionBusyError() : new Error(result.reason)));
    const { loser, winner, winnerAt } = await race(fs, autosave, personaWrite);
    expect(busy(loser)).toBe(true);
    expect(winner).toBe('committed');
    const after = JSON.parse(textOf(fs, filePath)) as WorkshopPersistedSessionV2;
    if (winnerAt === 0) {
      expect([after.workshop.excerpt?.text, after.workshop.todos[0].status]).toEqual(['Alice, in the autosave.', 'open']);
    } else {
      expect([after.workshop.excerpt?.text, after.workshop.todos[0].status]).toEqual(['Alice was beginning to get very tired.', 'completed']);
    }
    expect([...fs.files.keys()].filter((name) => /\.(lock|recovering-|retired-)/.test(name))).toEqual([]);
  });

  it('a rename against an autosave: one commits, the other is refused in host words', async () => {
    const { fs, left, right, filePath } = await setup();
    const expected = (await right.readNamed('alice-polish'))!;
    const autosaved = { ...expected, workshop: { ...expected.workshop, excerpt: { ...expected.workshop.excerpt!, text: 'Alice, in the autosave.' } } };
    fs.gate = true;
    const rename = left.renameNamed('alice-polish', 'Polish 6.12').then(() => 'committed', (error: Error) => error);
    const autosave = right.updateNamed('alice-polish', autosaved, expected).then(() => 'committed', (error: Error) => error);
    const { loser, winner, winnerAt } = await race(fs, rename, autosave);
    expect(busy(loser)).toBe(true);
    expect(winner).toBe('committed');
    const after = JSON.parse(textOf(fs, filePath)) as WorkshopPersistedSessionV2;
    expect(winnerAt === 0 ? after.title : after.workshop.excerpt?.text).toBe(winnerAt === 0 ? 'Polish 6.12' : 'Alice, in the autosave.');
  });

  it('a stale save after a completed write is refused by the compare', async () => {
    const { fs, left, right, filePath } = await setup();
    const stale = (await left.readNamed('alice-polish'))!;
    const read = await persona(right).read('alice-polish');
    expect(await persona(right).write(read as never, [{ todoId: stale.workshop.todos[0].id, status: 'completed' }])).toEqual({ kind: 'written' });
    const before = textOf(fs, filePath);
    await expect(left.updateNamed('alice-polish', { ...stale, title: 'Stale' }, stale)).rejects.toBeInstanceOf(WorkshopNamedSessionChangedError);
    expect(textOf(fs, filePath)).toBe(before);
  });

  it('an abandoned lock is taken over: its prior file restored, and the next write succeeds', async () => {
    const { fs, left, saved, filePath } = await setup();
    const expected = (await left.readNamed('alice-polish'))!;
    const bytes = fs.files.get(filePath)!;
    fs.files.delete(filePath);
    // A writer that died holding the file, long past the lease, mid-write.
    const lock = `${directory}/.${saved.fileName}.lock`;
    fs.files.set(`${lock}/owner.json`, new TextEncoder().encode(JSON.stringify({ token: 'dead-writer', at: 1_000_000_000_000 })));
    fs.files.set(`${lock}/dead-writer/prior.json`, bytes);
    fs.files.set(`${lock}/dead-writer/next.json`, new TextEncoder().encode('{"stale": true}'));
    fs.listsFolders = true;
    const fresh = new WorkshopSessionStore(fs, workspace, log(), now);
    await fresh.updateNamed('alice-polish', { ...expected, title: 'Polish, again' }, expected);
    expect((JSON.parse(textOf(fs, filePath)) as WorkshopPersistedSessionV2).title).toBe('Polish, again');
    expect([...fs.files.keys()].filter((name) => /\.(lock|recovering-|retired-)/.test(name))).toEqual([]);
  });

  it('a live lock with the name empty reads busy, never missing', async () => {
    const { fs, left, saved, filePath } = await setup();
    const bytes = fs.files.get(filePath)!;
    fs.files.delete(filePath);
    const lock = `${directory}/.${saved.fileName}.lock`;
    fs.files.set(`${lock}/owner.json`, new TextEncoder().encode(JSON.stringify({ token: 'live-writer', at: now().getTime() })));
    fs.files.set(`${lock}/live-writer/prior.json`, bytes);
    fs.listsFolders = true;
    await expect(left.readNamedWithRecovery('alice-polish')).rejects.toBeInstanceOf(WorkshopNamedSessionBusyError);
    expect(await persona(left).read('alice-polish')).toEqual({ kind: 'refused', reason: 'store-unavailable' });
  });
});
