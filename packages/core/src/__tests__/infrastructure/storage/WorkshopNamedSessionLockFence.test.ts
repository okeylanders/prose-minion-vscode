/**
 * The named-session lock fences a stalled writer by placement (ADR
 * 2026-11-19 D6b; PR #286 re-review, finding 1), with an injected clock and
 * held promises: writer A takes the lock, stages and claims, then pauses
 * just before its publish; the lease expires; writer B takes over
 * (restoring the file) and deletes the session; A resumes, and its publish
 * fails: its `stillHeld` is false and its rename finds no source. Nothing
 * is at the session's name. A second run has B update instead of delete;
 * B's content stands, byte for byte. *Alice*, made-up ids.
 */

import { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { WorkshopNamedSessionLock } from '@/infrastructure/storage/WorkshopNamedSessionLock';
import { STORED_FILE_CLAIM_LEASE_MS } from '@/infrastructure/storage/StoredFileClaims';
import { decodeWorkshopPersistedSessionCheckpoint, type WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { WorkshopSessionTimeService } from '@/application/services/workshop/WorkshopSessionTimeService';
import type { LogSink } from '@/platform';

const folder = '/workspace/novel/prose-minion/sessions';
const filePath = `${folder}/20261119-120000-polish.json`;
let clock = Date.parse('2026-11-19T12:00:00.000Z');
const now = () => new Date(clock);
const log = (): LogSink => ({ appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() });
const errors = { changed: () => new Error('changed'), missing: (id: string) => new Error(`missing ${id}`) };

function checkpoint(title: string): WorkshopPersistedSessionV2 {
  const session = new WorkshopSessionService(() => clock);
  session.setExcerpt({ text: 'Alice was beginning to get very tired.', source: { kind: 'manual' } });
  return {
    schemaVersion: 2, sessionId: 'alice-polish', title,
    createdAt: now().toISOString(), updatedAt: now().toISOString(),
    temporal: new WorkshopSessionTimeService({ now }).exportState(),
    summary: { hostPersonaId: 'jill', participantPersonaIds: ['jill'], turnCount: 0, excerptWordCount: 6 },
    workshop: session.exportCommittedState(), conversations: []
  };
}

async function setup() {
  const fs = new MemoryFileSystem();
  fs.listsFolders = true;
  const original = checkpoint('Polish 6.11');
  await fs.writeFile(filePath, new TextEncoder().encode(JSON.stringify(original, undefined, 2)));
  const readExact = async () => {
    const bytes = fs.files.get(filePath);
    return bytes ? decodeWorkshopPersistedSessionCheckpoint(JSON.parse(new TextDecoder().decode(bytes))) : undefined;
  };
  let resume!: () => void;
  let paused!: () => void;
  const atPublish = new Promise<void>((resolve) => { paused = resolve; });
  const stall = new Promise<void>((resolve) => { resume = resolve; });
  const stalled = new WorkshopNamedSessionLock(fs, log(), now, 1 << 24, errors, { beforePublish: async () => { paused(); await stall; } });
  const successor = new WorkshopNamedSessionLock(fs, log(), now, 1 << 24, errors);
  return { fs, original, readExact, atPublish, resume, stalled, successor };
}

describe('the named-session lock fences a stalled writer (D6b)', () => {
  it.each(['delete', 'update'] as const)('a writer paused past the lease cannot publish after a takeover and %s', async (successorWrites) => {
    const { fs, original, readExact, atPublish, resume, stalled, successor } = await setup();
    const renames = jest.spyOn(fs, 'rename');
    const writeA = stalled.replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original })
      .then(() => 'published', (error: Error) => error);
    await atPublish;
    // A holds the lock, its staged file inside it, the saved name empty.
    expect(fs.files.has(filePath)).toBe(false);
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    if (successorWrites === 'delete') {
      await successor.remove(filePath, 'alice-polish');
    } else {
      await successor.replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer B'), expected: original });
    }
    const afterB = fs.files.get(filePath);
    resume();
    expect(await writeA).toBeInstanceOf(Error);
    const publish = renames.mock.calls.filter(([from, to]) => from.includes('/next-') && to === filePath);
    // A's publish ran and found no source: its staged file went with the lock B took over.
    expect(publish.length).toBe(successorWrites === 'delete' ? 1 : 2);
    if (successorWrites === 'delete') {
      expect(fs.files.has(filePath)).toBe(false);
    } else {
      expect(fs.files.get(filePath)).toEqual(afterB);
      expect(JSON.parse(new TextDecoder().decode(fs.files.get(filePath)!)).title).toBe('Writer B');
    }
    expect([...fs.files.keys()].filter((name) => name.includes('.lock'))).toEqual([]);
  });

  it('a stalled writer\'s stillHeld is false once its lock is taken over', async () => {
    const { fs, original, readExact, atPublish, resume, stalled, successor } = await setup();
    const lockModule = await import('@/infrastructure/storage/WorkshopPinnedContextLock');
    const acquire = jest.spyOn(lockModule.WorkshopPinnedContextLock.prototype, 'acquire');
    const writeA = stalled.replace({ sessionId: 'alice-polish', filePath, readExact, session: checkpoint('Writer A'), expected: original }).catch(() => undefined);
    await atPublish;
    const held = await acquire.mock.results[0].value;
    clock += STORED_FILE_CLAIM_LEASE_MS + 1;
    await successor.remove(filePath, 'alice-polish');
    expect(await held.stillHeld()).toBe(false);
    resume();
    await writeA;
    expect(fs.files.has(filePath)).toBe(false);
    acquire.mockRestore();
  });
});
