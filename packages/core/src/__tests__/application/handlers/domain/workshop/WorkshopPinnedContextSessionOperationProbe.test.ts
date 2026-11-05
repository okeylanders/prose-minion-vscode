/**
 * Astra's PR #210 probe (`docs/pr-reviews/probes/pr-210-session-operation.test.ts.txt`), promoted as a
 * regression for F02. The only change is one line of wiring: the handler's effects gained `runRoomOperation` (the fix: Attach missing runs in the coordinator's session-operation queue), so the probe passes it, bound to the real coordinator's `runContextRefresh`. Its behavior and assertions are as
 * Astra wrote them.
 */
import { MessageRouter } from '@handlers/MessageRouter';
import { WorkshopPinnedContextHandler } from '@handlers/domain/workshop/WorkshopPinnedContextHandler';
import { MessageType, type WorkshopPinnedContextPayload } from '@messages';
import { setupCoordinator, scriptedCheckpoint } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { seedHost, FolderFileSystem } from '@/__tests__/application/services/workshop/pinnedContext/pinnedContextSeedHost';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';

it('does not report a successful attach that is then erased by a failed session replacement rollback', async () => {
  const fs = new FolderFileSystem();
  const c = setupCoordinator({fileSystem: fs});
  await c.coordinator.initialize();
  await c.coordinator.flush();
  await c.store.saveNamed(scriptedCheckpoint('target-room'));
  const host = seedHost({fileSystem: fs, scope: () => c.coordinator.recallScope()});
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
  const posted: WorkshopPinnedContextPayload[] = [];
  const handler = new WorkshopPinnedContextHandler({library: host.library, takeFirstRoomReport: () => undefined},
    c.session, {openFileInEditor: jest.fn(), pickFile: jest.fn()} as never,
    (async (m: {type: MessageType, payload: unknown}) => {if(m.type === MessageType.WORKSHOP_PINNED_CONTEXT) {posted.push(m.payload as WorkshopPinnedContextPayload);}}) as never,
    host.log, {postSessionState: jest.fn(), postTurn: jest.fn(), markDirty: r => c.coordinator.markDirty(r),
      sendStatus: jest.fn(), activeRunLabel: () => undefined, roomReady: () => c.coordinator.initialize(),
      runRoomOperation: work => c.coordinator.runContextRefresh(work)});
  const router = new MessageRouter();
  handler.registerRoutes(router, (type, handle, _action, onBlocked) => {
    router.register(type, async message => {
      if (c.coordinator.isSessionOperationPending()) {
        onBlocked?.('A session operation is pending.', message as never);
        return;
      }
      await handle(message as never);
    });
  });
  expect(c.coordinator.isSessionOperationPending()).toBe(false);
  const attaching = router.route({type:MessageType.WORKSHOP_ATTACH_PINNED_CONTEXT, source:'webview.workshop', timestamp:0, payload:{requestId:'attach-before-open'}});
  await reached.promise;
  const importing = deferred<void>();
  const importReached = deferred<void>();
  c.assistant.importWorkshopConversationArchive.mockImplementationOnce(async () => {
    importReached.resolve();
    await importing.promise;
    throw new Error('controlled import failure');
  });
  const opening = c.coordinator.openNamed('target-room').catch(error => error);
  // A corrected serialized attach may keep Open queued until its read settles.
  await Promise.race([importReached.promise, new Promise(resolve => setTimeout(resolve, 10))]);
  expect(c.coordinator.isSessionOperationPending()).toBe(true);
  held.resolve();
  await attaching;
  await importReached.promise;
  const beforeRollback = c.session.getContextAttachments();
  importing.resolve();
  const failure = await opening;
  await c.coordinator.flush();
  console.log({posted, beforeRollback, afterRollback:c.session.getContextAttachments(), failure: String(failure)});
  // Either refuse the interleaving, or preserve a successful attach across rollback.
  expect(posted[0].ok === true && c.session.getContextAttachments().length === 0).toBe(false);
});
