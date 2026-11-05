/**
 * PR #210's corrections beyond Astra's promoted probes (Pinned Context
 * Slice 3): the source rule in `describe()` and the seed (F01), the
 * successful-Open interleaving (F02), Open's repair and refusal cases (F05),
 * and the one path bound (F07). *Alice*, with made-up paths and text.
 */
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopPinnedContextHandler } from '@handlers/domain/workshop/WorkshopPinnedContextHandler';
import { MessageType, type WorkshopPinnedContextPayload } from '@messages';
import { decodeWorkshopPinnedContext, encodeWorkshopPinnedContext } from '@/infrastructure/storage/WorkshopPinnedContextCodec';
import { WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION } from '@/infrastructure/storage/WorkshopPinnedContextStore';
import { WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS } from '@shared/types/workshopPinnedContext';
import { setupCoordinator, scriptedCheckpoint } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { FolderFileSystem, LIST_FILE, ROOT, seedHost } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { harness } from './workshopPinnedContextHandlerHost';

const NFC = 'Characters/café.md';
const NFD = 'Characters/café.md';

describe('F01: the exact file before a normalized catalog neighbour, in describe() and the seed', () => {
  const host = () => {
    const h = seedHost({ platform: 'posix', catalog: [{ group: 'characters', path: NFD }] });
    h.write(NFD, 'An unrelated decomposed file.');
    h.write(NFC, 'The exact file, five words.');
    h.pin(NFC);
    return h;
  };

  it('describes the exact file, read through the workspace door', async () => {
    const description = await host().library.describe();
    expect(description).toMatchObject({ state: 'listed', rows: [{ path: NFC, source: { kind: 'workspace' }, state: 'ready', words: 5 }] });
  });

  it('seeds the exact file', async () => {
    const h = host();
    const read = await h.library.readForSeed({ rootPath: ROOT, filePath: LIST_FILE });
    expect(read.state === 'listed' && read.files[0].state === 'ready' && read.files[0].input.content).toBe('The exact file, five words.');
  });

  it('still falls back to the one normalized catalog spelling when the exact file is absent', async () => {
    const h = seedHost({ platform: 'posix', catalog: [{ group: 'characters', path: NFD }] });
    h.write(NFD, 'The only café file.');
    h.pin(NFC);
    expect(await h.library.describe()).toMatchObject({ rows: [{ path: NFC, source: { kind: 'catalog', group: 'characters' }, state: 'ready' }] });
  });
});

describe('F05: Open opens the resolved source', () => {
  it('opens a source that can\'t be read, for repair', async () => {
    const h = harness();
    h.write('Characters/alice.md', '   ');
    h.pin('Characters/alice.md');
    await expect(h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, { entryPath: 'Characters/alice.md' })).resolves.toMatchObject({ ok: true });
    expect(h.shell.openFileInEditor).toHaveBeenCalledWith(`${ROOT}/Characters/alice.md`);
  });

  it('opens nothing for a pinned file that isn\'t there, and says so', async () => {
    const h = harness();
    h.pin('Characters/alice.md');
    await expect(h.send(MessageType.WORKSHOP_OPEN_PINNED_CONTEXT_FILE, { entryPath: 'Characters/alice.md' })).resolves.toMatchObject({
      ok: false, notice: { kind: 'refused', text: 'That file isn’t there any more, so it can’t be opened. Unpin it, or put the file back.' }
    });
    expect(h.shell.openFileInEditor).not.toHaveBeenCalled();
  });
});

describe('F07: one path bound for the codec, every route and the tab\'s keys', () => {
  const atBound = `Notes/${'a'.repeat(WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS - 'Notes/'.length - 3)}.md`;

  it('reads a path at the bound and refuses one past it', () => {
    expect(atBound).toHaveLength(WORKSHOP_PINNED_CONTEXT_PATH_CHARACTERS);
    expect(decodeWorkshopPinnedContext(encodeWorkshopPinnedContext({ files: [{ path: atBound }] }), 'posix')).toMatchObject({ ok: true });
    expect(decodeWorkshopPinnedContext(JSON.stringify({ format: 1, files: [{ path: `${atBound}x` }] }), 'posix')).toMatchObject({ ok: false, reason: 'path' });
  });

  it('takes back a key at the bound for unpin', async () => {
    const h = harness();
    h.write(atBound, 'Alice.');
    h.pin(atBound);
    const { revision } = await h.send(MessageType.WORKSHOP_REQUEST_PINNED_CONTEXT, {});
    await expect(h.send(MessageType.WORKSHOP_UNPIN_CONTEXT, { revision, entryPath: atBound })).resolves.toMatchObject({ ok: true });
  });

  it('refuses to pin a path past the bound, in its own words', async () => {
    const h = harness();
    const id = h.attachFile(`${atBound}x`, false);
    await expect(h.send(MessageType.WORKSHOP_PIN_CONTEXT_ATTACHMENTS, { revision: WORKSHOP_PINNED_CONTEXT_ABSENT_REVISION, attachmentIds: [id] }))
      .resolves.toMatchObject({ ok: false, notice: { kind: 'refused', text: expect.stringContaining('its path is longer than pinned context can store (4,096 characters)') } });
  });
});

describe('F02: Attach missing and a successful Open, serialized in the room\'s operation queue', () => {
  it('lands the attach before Open captures its rollback, and Open then replaces the room', async () => {
    const fs = new FolderFileSystem();
    const c = setupCoordinator({ fileSystem: fs });
    await c.coordinator.initialize();
    await c.coordinator.flush();
    await c.store.saveNamed(scriptedCheckpoint('target-room'));
    const host = seedHost({ fileSystem: fs, scope: () => c.coordinator.recallScope() });
    host.pin('Characters/alice.md');
    host.write('Characters/alice.md', 'The pinned Alice context.');
    const held = deferred<void>();
    const reached = deferred<void>();
    const readForRoom = host.library.readForRoom.bind(host.library);
    jest.spyOn(host.library, 'readForRoom').mockImplementationOnce(async () => {
      const result = await readForRoom();
      reached.resolve();
      await held.promise;
      return result;
    });
    const events: string[] = [];
    const posted: WorkshopPinnedContextPayload[] = [];
    const handler = new WorkshopPinnedContextHandler(
      { library: host.library, takeFirstRoomReport: () => undefined },
      c.session,
      { openFileInEditor: jest.fn(), pickFile: jest.fn() } as never,
      (async (message: { type: MessageType; payload: unknown }) => {
        if (message.type === MessageType.WORKSHOP_PINNED_CONTEXT) {
          posted.push(message.payload as WorkshopPinnedContextPayload);
        }
      }) as never,
      host.log,
      {
        postSessionState: jest.fn(),
        postTurn: jest.fn(),
        markDirty: (reason) => {
          events.push('attached');
          c.coordinator.markDirty(reason);
        },
        sendStatus: jest.fn(),
        activeRunLabel: () => undefined,
        roomReady: () => c.coordinator.initialize(),
        runRoomOperation: (work) => c.coordinator.runContextRefresh(work)
      }
    );
    const router = new MessageRouter();
    handler.registerRoutes(router, (type, handle) => router.register(type, async (message) => handle(message as never)));

    const attaching = router.route({ type: MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, source: 'webview.workshop', timestamp: 0, payload: { requestId: 'attach' } } as never);
    await reached.promise;
    const importArchive = c.assistant.importWorkshopConversationArchive.getMockImplementation();
    c.assistant.importWorkshopConversationArchive.mockImplementation(async (targets) => {
      events.push('open imported');
      return importArchive ? importArchive(targets) : [];
    });
    const opening = c.coordinator.openNamed('target-room');
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(events).toEqual([]);
    held.resolve();
    await attaching;
    await opening;

    expect(posted[0]).toMatchObject({ action: 'attach-missing', ok: true });
    expect(events[0]).toBe('attached');
    expect(events).toContain('open imported');
    expect(events.indexOf('attached')).toBeLessThan(events.indexOf('open imported'));
  });
});
