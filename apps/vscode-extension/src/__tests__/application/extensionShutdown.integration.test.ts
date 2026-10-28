/* eslint-disable no-restricted-imports -- this test drives the real Lightbox handlers, service, runner, store and library through core's lightboxBoardsHarness, which the host-side barrel does not export. */
/**
 * Deactivation waits for the Lightbox's owed saves (PR #183 F-03).
 *
 * A reading's group B lands while group C is still out; the store's next
 * read of the board's file is held, so the save the stopped run owes cannot
 * commit. `shutDownExtension`, the sequence `deactivate` runs, disposes the
 * tab (its handlers, as the panel's MessageHandler disposes them: the run
 * stops, and the save that landed B is queued) and must stay pending until
 * that save is on disk.
 *
 * The real Lightbox handlers, service, runner, store and library
 * (`lightboxBoardsHarness`); only the provider engine and the file system are
 * stand-ins. The chapter is ¶1–¶8 of "Alice's Adventures in Wonderland"
 * (1865, public domain). No provider is called.
 */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  default: () => async (fn: () => Promise<unknown>) => fn()
}));

import * as path from 'node:path';
import { shutDownExtension, type ExtensionShutdownParts } from '@app/application/extensionShutdown';
import { MessageType, type LightboxBoard, type LightboxReadingGroupId } from '@/shared/types/messages';
import { decodeLightboxBoardFile, lightboxBoardOfFile } from '@/infrastructure/storage/LightboxBoardCodec';
import type { ExecutionResult, InitialRunRequest } from '@orchestration/AgentRunContracts';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { groupOf, ok, opinionReplyFor } from '@/__tests__/application/handlers/domain/lightboxReadingHarness';
import { CHAPTER, CHAPTER_PATH, WORKSPACE, createLightboxBoardsHost, quiet } from '@/__tests__/application/handlers/domain/lightboxBoardsHarness';

/** The board's one file: its first save, measured, rewritten in place by each later save. */
const OWN = 'drafts-alice-1-md-9b099095/2026-10-22T14-05-09-123Z.board.json';

function savedBoard(host: ReturnType<typeof createLightboxBoardsHost>): LightboxBoard {
  const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN))));
  const held = decoded.kind === 'board' ? lightboxBoardOfFile(decoded.file) : undefined;
  if (held?.kind !== 'board') {
    throw new Error(`${OWN} does not read as a board`);
  }
  return held.board;
}

const group = (board: LightboxBoard | undefined, id: LightboxReadingGroupId) => board?.readings.find((entry) => entry.group === id);

/** A host with the chapter measured and saved, whose group C replies wait for `release`. */
async function boarded() {
  const groupC = deferred<void>();
  const host = createLightboxBoardsHost({
    respond: async (request: InitialRunRequest): Promise<ExecutionResult> => {
      if (groupOf(request) === 'C') {
        await groupC.promise;
      }
      return ok(groupOf(request), groupOf(request) === 'F' ? opinionReplyFor(request) : undefined);
    }
  });
  host.writeChapter(CHAPTER_PATH, CHAPTER);
  const tab = host.openTab();
  await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
  await tab.shelf(null);
  await tab.choose(CHAPTER_PATH);
  await quiet();
  expect(host.savedFiles()).toEqual([OWN]);
  return { host, tab, releaseC: () => groupC.resolve() };
}

const partsOf = (host: ReturnType<typeof createLightboxBoardsHost>, tab: { dispose(): void }): ExtensionShutdownParts => ({
  workshopPanel: undefined,
  lightboxPanel: { dispose: () => tab.dispose() },
  workshopSessions: { flush: async () => undefined },
  lightboxBoards: host.library
});

describe('deactivation and the Lightbox\'s owed saves (PR #183 F-03)', () => {
  it('stays pending until the save a stopped run owes is on disk, then holds the landed reading', async () => {
    const { host, tab, releaseC } = await boarded();
    await tab.read();
    await quiet();
    expect(group(host.service.currentBoard(), 'B')?.status).toBe('ok');
    expect(group(host.service.currentBoard(), 'C')?.status).toBe('running');
    expect(group(savedBoard(host), 'B')?.status).toBe('not-run');

    const read = host.holdBoardRead();
    let finished = false;
    const shutdown = shutDownExtension(partsOf(host, tab)).then(() => {
      finished = true;
    });
    await quiet();

    // Disposed and stopped, with the save queued behind the held read: still pending, nothing on disk yet.
    expect(host.runner.activeRun('board-1')).toBeUndefined();
    expect(finished).toBe(false);
    expect(group(savedBoard(host), 'B')?.status).toBe('not-run');

    read.release();
    await shutdown;
    const saved = savedBoard(host);
    expect(group(saved, 'B')?.status).toBe('ok');
    expect(group(saved, 'B')?.tiles.length).toBeGreaterThan(0);
    expect(group(saved, 'C')?.status).not.toBe('running');
    expect(host.savedFiles()).toEqual([OWN]);
    releaseC();
  });

  it('waits for a rename still going out, and one started while it waits', async () => {
    const { host, tab, releaseC } = await boarded();
    const read = host.holdBoardRead();
    void host.library.rename({ boardId: 'board-1', fileId: null, name: 'Down the rabbit hole' });
    let finished = false;
    const shutdown = shutDownExtension({ ...partsOf(host, tab), lightboxPanel: undefined }).then(() => {
      finished = true;
    });
    await quiet();
    expect(finished).toBe(false);

    // Started while the drain waits; it queues behind the held rename.
    void host.library.rename({ boardId: 'board-1', fileId: null, name: 'The pool of tears' });
    read.release();
    await shutdown;
    const decoded = decodeLightboxBoardFile(new TextDecoder().decode(host.fileSystem.files.get(path.posix.join(WORKSPACE, 'prose-minion', 'boards', OWN))));
    expect(decoded.kind === 'board' ? decoded.file.board.name : undefined).toBe('The pool of tears');
    tab.dispose();
    releaseC();
  });

  it('control: with nothing owed, it settles without touching the boards folder', async () => {
    const { host, tab, releaseC } = await boarded();
    const read = host.holdBoardRead();
    await expect(shutDownExtension(partsOf(host, tab))).resolves.toBeUndefined();
    expect(group(savedBoard(host), 'B')?.status).toBe('not-run');
    read.release();
    releaseC();
  });
});

describe('deactivation and a source still being read (PR #183 F-03 re-review)', () => {
  /** A tab that has asked for its board, with the chapter on disk and nothing saved yet. */
  async function opened() {
    const host = createLightboxBoardsHost();
    host.writeChapter(CHAPTER_PATH, CHAPTER);
    const tab = host.openTab();
    await tab.route(MessageType.LIGHTBOX_REQUEST_BOARD);
    await tab.shelf(null);
    // The source is chosen, its ticket taken, and its read held before it is measured.
    const read = host.holdRead(CHAPTER_PATH);
    const choosing = tab.choose(CHAPTER_PATH);
    await quiet();
    return { host, tab, read, choosing };
  }

  it('adopts nothing and starts no save once deactivation has begun, with no Workshop to wait for', async () => {
    const { host, tab, read, choosing } = await opened();
    await shutDownExtension({ ...partsOf(host, tab), workshopSessions: undefined });

    read.release();
    await choosing;
    await quiet();
    expect(host.service.currentBoard()).toBeUndefined();
    expect(host.savedFiles()).toEqual([]);
  });

  it('adopts nothing while the Workshop is still flushing, so no save outlives deactivation', async () => {
    const { host, tab, read, choosing } = await opened();
    const flushed = deferred<void>();
    let finished = false;
    const shutdown = shutDownExtension({ ...partsOf(host, tab), workshopSessions: { flush: () => flushed.promise } }).then(() => {
      finished = true;
    });

    read.release();
    await choosing;
    await quiet();
    expect(host.service.currentBoard()).toBeUndefined();
    expect(finished).toBe(false);

    flushed.resolve();
    await shutdown;
    await quiet();
    expect(host.savedFiles()).toEqual([]);
  });

  it('control: a tab\'s own close keeps the request, which lands, and saves, in the next tab', async () => {
    const { host, tab, read, choosing } = await opened();
    tab.dispose();
    const next = host.openTab();
    await next.route(MessageType.LIGHTBOX_REQUEST_BOARD);

    read.release();
    await choosing;
    await quiet();
    const board = host.service.currentBoard();
    expect(board).toBeDefined();
    expect(next.boards()[next.boards().length - 1]?.boardId).toBe(board?.boardId);
    expect(host.savedFiles()).toEqual([OWN]);
    next.dispose();
  });
});

describe('shutDownExtension\'s order', () => {
  it('stops both tabs before it waits, and waits for the Lightbox even when the Workshop\'s flush fails', async () => {
    const calls: string[] = [];
    const drained = deferred<void>();
    const shutdown = shutDownExtension({
      workshopPanel: { dispose: () => calls.push('workshop panel disposed') },
      lightboxPanel: { dispose: () => calls.push('lightbox panel disposed') },
      workshopSessions: {
        flush: async () => {
          calls.push('workshop flush');
          throw new Error('disk full');
        }
      },
      lightboxBoards: {
        shutDown: () => {
          calls.push('lightbox drain');
          return drained.promise.then(() => {
            calls.push('lightbox drained');
          });
        }
      }
    });
    await quiet();
    expect(calls).toEqual(['workshop panel disposed', 'lightbox panel disposed', 'lightbox drain', 'workshop flush']);

    drained.resolve();
    await expect(shutdown).rejects.toThrow('disk full');
    expect(calls[calls.length - 1]).toBe('lightbox drained');
  });
});
