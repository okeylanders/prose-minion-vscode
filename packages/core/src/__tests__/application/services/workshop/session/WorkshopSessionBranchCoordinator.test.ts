/**
 * The coordinator's Branch operation (ADR 2026-09-30 §7) over real
 * collaborators: the saved room is cut by the pure transform, saved as a new
 * named session, and opened by a separate room's named-session promotion.
 *
 * The key proof branches the canonical scripted room at every rest point and
 * holds the branch file to the room the Rewind equivalence oracle expects
 * there, with only the envelope new.
 */

import * as rewindModule from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  WorkshopRewindRefusedError
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import {
  WorkshopBranchNotOpenedError,
  WorkshopBranchRefusedError
} from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopPersistedSessionV2 } from '@/application/services/workshop/WorkshopPersistedSession';
import type { WorkshopSessionStateV1 } from '@/application/services/workshop/WorkshopSessionStateV1';
import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import { WorkshopSessionStoreUnavailableError } from '@/infrastructure/storage/WorkshopSessionStore';
import type { MemoryFileSystem } from '@/__tests__/mocks/MemoryFileSystem';
import { runCanonicalScriptedRoom, ScriptedRestPoint, ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { HARNESS_ROOT, harnessNow, scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';
import { expectedRewoundRoom } from './WorkshopRewindOracle';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const restPoint = (room: ScriptedWorkshopRoom, label: string): ScriptedRestPoint =>
  room.restPoints.find((point) => point.label === label)!;

const SESSIONS_DIRECTORY = `${HARNESS_ROOT}/prose-minion/sessions`;
const NOW = harnessNow().toISOString();
const BRANCH_SLOT = 'd64789b9-8bd4-4a2a-8096-14bceef444be';
/** The source was saved on an earlier day, so every fresh branch field shows. */
const SOURCE_TIME = '2026-09-01T09:00:00.000Z';
const SOURCE_TIMEZONE = 'America/Chicago';

/** The canonical room as a named session saved earlier, in its own timezone. */
function sourceCheckpoint(room: ScriptedWorkshopRoom): WorkshopPersistedSessionV2 {
  const checkpoint = scriptedCheckpoint('scripted', room);
  return {
    ...checkpoint,
    createdAt: SOURCE_TIME,
    updatedAt: SOURCE_TIME,
    savedAt: SOURCE_TIME,
    temporal: {
      ...checkpoint.temporal,
      startedAt: SOURCE_TIME,
      lastActivityAt: SOURCE_TIME,
      timezone: SOURCE_TIMEZONE,
      personaNotices: [{ conversationKey: 'host', notifiedAt: SOURCE_TIME }]
    }
  };
}

/** The canonical room, saved as a named session and opened as the live room. */
async function openCanonicalSession(room: ScriptedWorkshopRoom = runCanonicalScriptedRoom()) {
  const harness = setupCoordinator();
  const checkpoint = sourceCheckpoint(room);
  await harness.store.saveNamed(checkpoint);
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('scripted');
  const sourcePath = await harness.store.resolveRevealPath('scripted');
  return { ...harness, room, checkpoint, sourcePath };
}

const textOf = async (fs: MemoryFileSystem, filePath: string): Promise<string> =>
  new TextDecoder().decode(await fs.readFile(filePath));

/** Every file in the sessions directory, by name, with its exact contents. */
async function sessionFiles(fs: MemoryFileSystem): Promise<Record<string, string>> {
  const entries = await fs.readDirectory(SESSIONS_DIRECTORY);
  const files: Record<string, string> = {};
  for (const [name] of entries) {
    files[name] = await textOf(fs, `${SESSIONS_DIRECTORY}/${name}`);
  }
  return files;
}

/** The browser preview rule: the latest non-session turn with content. */
const previewOf = (workshop: WorkshopSessionStateV1): string | undefined =>
  [...workshop.turns].reverse()
    .find((turn) => turn.participant !== 'session' && turn.content.trim().length > 0)
    ?.content.replace(/\s+/g, ' ').trim().slice(0, 180);

const refusalOf = async (operation: Promise<unknown>): Promise<unknown> => {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the operation to be refused');
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('the Branch key proof over the canonical scripted room (ADR 2026-09-30 §7)', () => {
  const room = runCanonicalScriptedRoom();
  const final = room.restPoints.at(-1)!;
  const floor = final.workshop.turns.findIndex((turn) => turn.artifact === 'standing_directive_change');
  const points = room.restPoints.filter((point) =>
    final.workshop.turns.findIndex((turn) => turn.id === point.headTurnId) >= floor);

  it('covers every rest point but the start, which precedes the directive floor', () => {
    expect(points).toHaveLength(room.restPoints.length - 1);
    expect(points.length).toBeGreaterThanOrEqual(17);
  });

  it.each(points.map((point, index) => [`${index + 1}: ${point.label}`, point] as const))(
    'branches at rest point %s into the oracle\'s room, the source byte-identical',
    async (_label, point) => {
      const harness = await openCanonicalSession(room);
      const sourceBefore = await textOf(harness.fs, harness.sourcePath);
      const sourceRoom = clonePersistedJson(harness.session.exportCommittedState());
      const expected = expectedRewoundRoom(point, final);

      const outcome = await harness.coordinator.branchFrom(after(point.headTurnId));

      const branch = (await harness.store.readNamed(outcome.branch.sessionId))!;
      // The cut room is exactly the one a rewind to this point produces.
      expect({ workshop: branch.workshop, conversations: branch.conversations })
        .toEqual({ workshop: expected.workshop, conversations: expected.archive });
      // Only the envelope is new: identity, times, temporal start, title and summary.
      expect(branch).toEqual({
        schemaVersion: 2,
        sessionId: outcome.branch.sessionId,
        title: 'Scripted room — branch',
        createdAt: NOW,
        updatedAt: NOW,
        savedAt: NOW,
        temporal: {
          schemaVersion: 1,
          startedAt: NOW,
          timezone: SOURCE_TIMEZONE,
          lastActivityAt: NOW,
          personaNotices: []
        },
        summary: branch.summary,
        workshop: branch.workshop,
        conversations: branch.conversations
      });
      // The browser row describes the cut room, not the source.
      expect(branch.summary.turnCount).toBe(expected.workshop.turns.length);
      expect(branch.summary.preview).toBe(previewOf(expected.workshop));
      expect(outcome.branch.sessionId).not.toBe('scripted');
      expect(outcome.summary).toEqual({
        keptThroughTurnId: point.headTurnId,
        removedTurnCount: final.workshop.turns.length - point.workshop.turns.length,
        droppedConversationKeys: expected.droppedConversationKeys,
        removedTodoCount: 0,
        releasedWidgetConfigIds: expected.releasedWidgetConfigIds
      });
      // The source session's file is untouched, byte for byte.
      expect(await textOf(harness.fs, harness.sourcePath)).toBe(sourceBefore);
      expect(clonePersistedJson(harness.session.exportCommittedState())).toEqual(sourceRoom);
      expect(harness.coordinator.openRoomIdentity().namedSessionId).toBe('scripted');
    }
  );
});

describe('WorkshopSessionPersistenceCoordinator.branchFrom (ADR 2026-09-30 §7)', () => {
  it('names both sessions, lists both, and logs counts but never content', async () => {
    const { coordinator, room, log } = await openCanonicalSession();
    const point = restPoint(room, 'host reply: gesture directions');

    const outcome = await coordinator.branchFrom(after(point.headTurnId));

    expect(outcome.source).toEqual({ sessionId: 'scripted', title: 'Scripted room' });
    expect(outcome.branch).toMatchObject({ title: 'Scripted room — branch' });
    expect(outcome.composerRestore).toBeUndefined();
    expect(outcome.widgetRestore).toBeUndefined();
    const listed = await coordinator.list();
    expect(listed.sessions.map((session) => session.title).sort())
      .toEqual(['Scripted room', 'Scripted room — branch']);
    const lines = (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    const branched = lines.filter((line) => line.includes('Room branched'));
    expect(branched).toHaveLength(1);
    expect(branched[0]).toContain(`source=scripted, branch=${outcome.branch.sessionId}`);
    expect(branched[0]).toContain(`keptThrough=${point.headTurnId}`);
    expect(branched[0]).toMatch(/host \d+→\d+/);
    expect(lines.join('\n')).not.toContain('Where should the chapter end?');
    expect(branched[0]).not.toContain(outcome.branch.fileName);
  });

  it('opens the branch as Open would: a resume frame for retained personas, then a resume marker', async () => {
    const { coordinator, time, room, fs } = await openCanonicalSession();
    // The source room already handed its host a frame and spent its marker.
    expect(coordinator.beginInteraction()).toBeDefined();
    time.commitNotice(time.prepareNotice('host')!);

    const outcome = await coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId));
    const destination = setupCoordinator({ fileSystem: fs, roomId: BRANCH_SLOT });
    await destination.coordinator.initialize();
    await destination.coordinator.openNamed(outcome.branch.sessionId);
    expect(coordinator.openRoomIdentity().namedSessionId).toBe('scripted');
    expect(coordinator.beginInteraction()).toBeUndefined();

    expect(destination.time.exportState()).toEqual({
      schemaVersion: 1,
      startedAt: NOW,
      timezone: SOURCE_TIMEZONE,
      lastActivityAt: NOW,
      personaNotices: []
    });
    expect(destination.time.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
    expect(destination.coordinator.beginInteraction()?.content).toMatch(/^Session resumed /);
  });

  it('describes the cut room in the browser and its search, never the source', async () => {
    const { coordinator, room } = await openCanonicalSession();
    const point = restPoint(room, 'prose report');

    const outcome = await coordinator.branchFrom(after(point.headTurnId));

    const row = (await coordinator.list()).sessions
      .find((session) => session.sessionId === outcome.branch.sessionId)!;
    expect(row).toMatchObject({
      title: 'Scripted room — branch',
      turnCount: point.workshop.turns.length,
      preview: previewOf(point.workshop)
    });
    // The final question was asked after the cut: only the source holds it.
    const searched = await coordinator.list('Where should the chapter end');
    expect(searched.sessions.map((session) => session.sessionId)).toEqual(['scripted']);
  });

  it('takes a writer-chosen title and keeps a long default one within the limit', async () => {
    const titled = await openCanonicalSession();
    const point = restPoint(titled.room, 'prose report');
    const outcome = await titled.coordinator.branchFrom(after(point.headTurnId), { title: '  Felix, take two  ' });
    expect(outcome.branch.title).toBe('Felix, take two');

    const room = runCanonicalScriptedRoom();
    const harness = setupCoordinator();
    await harness.store.saveNamed({ ...sourceCheckpoint(room), title: 'L'.repeat(160) });
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('scripted');
    const long = await harness.coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId));
    expect(long.branch.title).toBe(`${'L'.repeat(151)} — branch`);
    expect(long.branch.title).toHaveLength(160);
  });

  it('saves nested branches with incremented titles and preserves each source', async () => {
    const { coordinator, store, fs, room } = await openCanonicalSession();
    const cut = after(restPoint(room, 'prose report').headTurnId);
    let sourceId = 'scripted';
    let sourceTitle = 'Scripted room';

    for (const title of ['Scripted room — branch', 'Scripted room — branch 2', 'Scripted room — branch 3']) {
      const sourcePath = await store.resolveRevealPath(sourceId);
      const sourceBefore = await textOf(fs, sourcePath);

      const outcome = await coordinator.branchFrom(cut);

      expect(outcome.source).toEqual({ sessionId: sourceId, title: sourceTitle });
      expect(outcome.branch.title).toBe(title);
      expect((await store.readNamed(outcome.branch.sessionId))?.title).toBe(title);
      expect(await textOf(fs, sourcePath)).toBe(sourceBefore);
      await coordinator.openNamed(outcome.branch.sessionId);
      sourceId = outcome.branch.sessionId;
      sourceTitle = title;
    }

    expect((await coordinator.list()).sessions.map((session) => session.title).sort())
      .toEqual(['Scripted room', 'Scripted room — branch', 'Scripted room — branch 2', 'Scripted room — branch 3']);
  });

  describe('a writer-message branch is an edit in the branch', () => {
    it('re-seeds the composer and restages the message attachments under their ids', async () => {
      const { coordinator, session, store, room } = await openCanonicalSession();
      const message = room.session.readRoomLedger().find((turn) =>
        turn.participant === 'writer' && turn.content === 'Does the revision land?')!;

      const outcome = await coordinator.branchFrom(before(message.id));

      expect(outcome.composerRestore).toEqual({
        text: 'Does the revision land?',
        attachmentIds: [expect.stringMatching(/^ta-\d+$/)],
        unrestoredAttachmentLabels: []
      });
      const [restagedId] = outcome.composerRestore!.attachmentIds;
      const branch = (await store.readNamed(outcome.branch.sessionId))!;
      expect(branch.workshop.pendingMessageAttachments).toEqual([
        expect.objectContaining({ id: restagedId, label: 'beat-sheet.md' })
      ]);
      expect(branch.workshop.pendingMessageAttachments?.[0].content).toBe('Beat one: the cup. Beat two: the sill.');
      expect(session.collectMessageAttachments().map(item => item.id)).not.toContain(restagedId);
      // The source still holds the message as it was sent.
      expect((await store.readNamed('scripted'))!.workshop.turns.some((turn) => turn.id === message.id))
        .toBe(true);
    });

    it('reopens a widget message\'s released config (Sprint 03 kickoff decision 3)', async () => {
      const { coordinator, room } = await openCanonicalSession();
      const message = room.session.readRoomLedger()
        .find((turn) => turn.widgetCommit?.rail === 'thread-artifact')!;

      const outcome = await coordinator.branchFrom(before(message.id));

      expect(outcome.widgetRestore).toEqual({ widgetConfigId: message.widgetCommit!.widgetConfigId });
      expect(outcome.composerRestore).toBeUndefined();
    });

    it('sends a reopened widget message back to the host it addressed, not a later chat target (PR #120 review F-02)', async () => {
      const room = new ScriptedWorkshopRoom().start();
      room.hostMessage('Opening?');
      room.inviteGuest('margot', 'Margot, read this with us.');
      room.hostWidgetCommit();
      room.guestMessage('margot', 'How does the voice sound?');
      const { coordinator, session, store } = await openCanonicalSession(room);
      expect(session.getChatTarget()).toEqual({ kind: 'personaGuest', personaId: 'margot' });
      const message = room.session.readRoomLedger()
        .find((turn) => turn.widgetCommit?.rail === 'thread-artifact')!;

      const outcome = await coordinator.branchFrom(before(message.id));

      expect(outcome.widgetRestore).toEqual({ widgetConfigId: message.widgetCommit!.widgetConfigId });
      // Margot is still in the branch; a recommit from the reopened sheet goes to the host.
      expect(session.getPersonaGuestConversationId('margot')).toBeDefined();
      expect(session.getChatTarget()).toEqual({ kind: 'personaGuest', personaId: 'margot' });
      expect((await store.readNamed(outcome.branch.sessionId))!.workshop.participants.chatTarget)
        .toEqual({ kind: 'host' });
    });
  });

  describe('an unnamed room (D2: save first)', () => {
    async function openUnnamedRoom() {
      const harness = setupCoordinator();
      const room = runCanonicalScriptedRoom();
      await harness.store.writeCurrent(scriptedCheckpoint('rolling', room));
      await harness.coordinator.initialize();
      return { ...harness, room };
    }

    it('is refused, leaving the room, current.json and every named file unchanged', async () => {
      const { coordinator, session, fs, room } = await openUnnamedRoom();
      const roomBefore = session.exportCommittedState();
      const filesBefore = await sessionFiles(fs);

      const refusal = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect(refusal).toBeInstanceOf(WorkshopBranchRefusedError);
      expect((refusal as WorkshopBranchRefusedError).reason).toBe('unsaved-session');
      expect(session.exportCommittedState()).toEqual(roomBefore);
      expect(await sessionFiles(fs)).toEqual(filesBefore);
      expect((await coordinator.list()).sessions).toEqual([]);
    });

    it('branches once the writer saves it, and never writes the saved source', async () => {
      const { coordinator, store, fs, room } = await openUnnamedRoom();
      const saved = await coordinator.saveNamed('Chapter 3 — Felix');
      const sourcePath = await store.resolveRevealPath(saved.sessionId);
      const sourceBefore = await textOf(fs, sourcePath);

      const outcome = await coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId));

      expect(outcome.source).toEqual({ sessionId: saved.sessionId, title: 'Chapter 3 — Felix' });
      expect(outcome.branch.title).toBe('Chapter 3 — Felix — branch');
      expect(await textOf(fs, sourcePath)).toBe(sourceBefore);
      const listed = await coordinator.list();
      expect(listed.sessions.map((session) => session.title).sort())
        .toEqual(['Chapter 3 — Felix', 'Chapter 3 — Felix — branch']);
      expect(listed.current?.sessionId).toBe(saved.sessionId);
    });
  });

  describe('refusals (the host re-checks; webview gating is advisory)', () => {
    it('refuses while a run is active', async () => {
      const { coordinator, session, room } = await openCanonicalSession();
      session.beginPersonaMessage('in-flight', 'Still thinking…');

      const refusal = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
      expect((refusal as WorkshopRewindRefusedError).reason).toBe('busy');
    });

    it('refuses while another session operation is pending', async () => {
      const { coordinator, room } = await openCanonicalSession();
      const saving = coordinator.saveNamed('Another title', 'scripted');

      const refusal = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect((refusal as WorkshopRewindRefusedError).reason).toBe('busy');
      await saving;
    });

    it('follows New-session availability: no workspace, no branch', async () => {
      const { coordinator, session } = setupCoordinator({ workspace: 'none' });
      await coordinator.initialize();

      const refusal = await refusalOf(coordinator.branchFrom(after(session.readRoomLedger().at(-1)!.id)));

      expect(refusal).toBeInstanceOf(WorkshopSessionStoreUnavailableError);
    });

    it.each<[string, (room: ScriptedWorkshopRoom) => WorkshopRewindCut, string]>([
      ['a position inside a run', (room) =>
        after(room.session.readRoomLedger().find((turn) => turn.capability !== undefined)!.id),
      'not-a-rest-point'],
      ['a point across the directive change', (room) =>
        after(restPoint(room, 'start').headTurnId),
      'before-directive-change']
    ])('refuses %s without writing anything', async (_label, cutFor, reason) => {
      const { coordinator, session, fs, room } = await openCanonicalSession();
      const roomBefore = session.exportCommittedState();
      const filesBefore = await sessionFiles(fs);

      const refusal = await refusalOf(coordinator.branchFrom(cutFor(room)));

      expect((refusal as WorkshopRewindRefusedError).reason).toBe(reason);
      expect(session.exportCommittedState()).toEqual(roomBefore);
      expect(await sessionFiles(fs)).toEqual(filesBefore);
    });

    it('refuses a named room whose latest changes did not save, and writes nothing itself', async () => {
      const { coordinator, store, fs, room, sourcePath } = await openCanonicalSession();
      const sourceBefore = await textOf(fs, sourcePath);
      jest.spyOn(store, 'updateNamed').mockRejectedValueOnce(new Error('disk full'));
      const saveNamed = jest.spyOn(store, 'saveNamed');
      coordinator.markDirty('chat target changed');

      const refusal = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect(refusal).toBeInstanceOf(WorkshopBranchRefusedError);
      expect((refusal as WorkshopBranchRefusedError).reason).toBe('unsaved-changes');
      expect(saveNamed).not.toHaveBeenCalled();
      expect(await textOf(fs, sourcePath)).toBe(sourceBefore);
      expect(Object.keys(await sessionFiles(fs)).filter((name) => name.includes('branch'))).toEqual([]);
    });
  });

  describe('failures (the source survives every one)', () => {
    it.each<[string, (harness: Awaited<ReturnType<typeof openCanonicalSession>>) => void]>([
      ['the transform', () => {
        jest.spyOn(rewindModule, 'rewindWorkshopSession').mockImplementationOnce(() => {
          throw new Error('transform failed');
        });
      }],
      ['the branch write', ({ fs }) => {
        // The atomic rename of the new file: its temporary file is removed.
        jest.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('branch write failed'));
      }]
    ])('leaves the room, the source and no branch file when %s fails', async (stage, inject) => {
      const harness = await openCanonicalSession();
      const { coordinator, session, manager, fs, room } = harness;
      const roomBefore = session.exportCommittedState();
      const conversationCount = manager.getActiveConversationCount();
      const filesBefore = await sessionFiles(fs);
      inject(harness);

      const failure = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect(String(failure)).toContain(`${stage.replace('the ', '')} failed`);
      expect(failure).not.toBeInstanceOf(WorkshopBranchNotOpenedError);
      expect(session.exportCommittedState()).toEqual(roomBefore);
      expect(manager.getActiveConversationCount()).toBe(conversationCount);
      // No branch file and no temporary file: the directory is exactly as it was.
      expect(await sessionFiles(fs)).toEqual(filesBefore);

      // A failed branch never poisons the operation queue.
      await coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId));
      expect((await coordinator.list()).sessions).toHaveLength(2);
    });

    it.each(['import', 'hydrate', 'mirror'] as const)(
      'a destination %s failure keeps the source live and the saved branch openable',
      async stage => {
        const { coordinator, session, store, fs, room, sourcePath } = await openCanonicalSession();
        const before = session.exportCommittedState();
        const sourceBytes = await textOf(fs, sourcePath);
        const rollingBytes = await textOf(fs, `${SESSIONS_DIRECTORY}/current.json`);
        const outcome = await coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId));
        const target = setupCoordinator({ fileSystem: fs, roomId: BRANCH_SLOT });
        await target.coordinator.initialize();
        await target.coordinator.flush();
        const error = new Error('destination failed');
        if (stage === 'import') {
          target.assistant.importWorkshopConversationArchive.mockRejectedValueOnce(error);
        } else if (stage === 'hydrate') {
          jest.spyOn(target.session, 'hydrateCommittedState').mockImplementationOnce(() => { throw error; });
        } else {
          jest.spyOn(target.store, 'writeCurrent').mockRejectedValueOnce(error);
        }
        await expect(target.coordinator.openNamed(outcome.branch.sessionId)).rejects.toThrow();
        expect(coordinator.openRoomIdentity().namedSessionId).toBe('scripted');
        expect(session.exportCommittedState()).toEqual(before);
        expect(await textOf(fs, sourcePath)).toBe(sourceBytes);
        expect(await textOf(fs, `${SESSIONS_DIRECTORY}/current.json`)).toBe(rollingBytes);
        const branch = await store.readNamed(outcome.branch.sessionId);
        await target.coordinator.openNamed(outcome.branch.sessionId);
        expect(clonePersistedJson(target.session.exportCommittedState())).toEqual(branch?.workshop);
        expect((await coordinator.list()).sessions.map(entry => entry.sessionId).sort()).toEqual([outcome.branch.sessionId, 'scripted'].sort());
      }
    );
  });

  describe('a source file changed on disk (PR #120 review F-01)', () => {
    type OpenSession = Awaited<ReturnType<typeof openCanonicalSession>>;

    /** An earlier, valid save of the same session: what a Git checkout could restore. */
    const earlierSave = (): WorkshopPersistedSessionV2 => {
      const earlier = new ScriptedWorkshopRoom().start();
      earlier.hostMessage('What is this scene doing?');
      return sourceCheckpoint(earlier);
    };

    const externalChanges: Array<[string, (harness: OpenSession) => Promise<void>]> = [
      ['deleted', ({ fs, sourcePath }) => fs.delete(sourcePath)],
      ['corrupted', ({ fs, sourcePath }) =>
        fs.writeFile(sourcePath, new TextEncoder().encode('{"schemaVersion":2,"sessionId":'))],
      ['replaced by an earlier save', async ({ fs, sourcePath }) => fs.setJson(sourcePath, earlierSave())]
    ];

    /** The live room, its runtime histories and its rolling copy, exactly. */
    async function roomState({ session, manager, fs }: OpenSession) {
      const host = session.getHostConversationId()!;
      return {
        room: session.exportCommittedState(),
        bindings: { host, guest: session.getPersonaGuestConversationId('margot') },
        hostHistory: manager.getMessages(host),
        conversationCount: manager.getActiveConversationCount(),
        current: await textOf(fs, `${SESSIONS_DIRECTORY}/current.json`)
      };
    }

    it.each(externalChanges)('refuses a source that was %s, writing nothing and keeping the room', async (_change, change) => {
      const harness = await openCanonicalSession();
      const { coordinator, store, fs, room } = harness;
      const cut = after(restPoint(room, 'prose report').headTurnId);
      await change(harness);
      const before = await roomState(harness);
      const filesBefore = await sessionFiles(fs);
      const saveNamed = jest.spyOn(store, 'saveNamed');

      const refusal = await refusalOf(coordinator.branchFrom(cut));

      expect(refusal).toBeInstanceOf(WorkshopBranchRefusedError);
      expect((refusal as WorkshopBranchRefusedError).reason).toBe('source-changed');
      expect(saveNamed).not.toHaveBeenCalled();
      expect(await roomState(harness)).toEqual(before);
      expect(await sessionFiles(fs)).toEqual(filesBefore);

      // The way out the refusal names: keep this room as a new session.
      saveNamed.mockRestore();
      const kept = await coordinator.saveNamed('Scripted room, kept');
      const outcome = await coordinator.branchFrom(cut);
      expect(outcome.source).toEqual({ sessionId: kept.sessionId, title: 'Scripted room, kept' });
      expect(outcome.summary.removedTurnCount).toBeGreaterThan(0);
    });

    it('keeps the room when the source is deleted during the save, and reports the saved branch', async () => {
      const harness = await openCanonicalSession();
      const { coordinator, store, fs, room, sourcePath } = harness;
      const before = await roomState(harness);
      const save = store.saveNamed.bind(store);
      jest.spyOn(store, 'saveNamed').mockImplementationOnce(async checkpoint => {
        const saved = await save(checkpoint);
        await fs.delete(sourcePath);
        return saved;
      });

      const failure = await refusalOf(coordinator.branchFrom(after(restPoint(room, 'prose report').headTurnId)));

      expect(failure).toBeInstanceOf(WorkshopBranchNotOpenedError);
      const { branch, refusal } = failure as WorkshopBranchNotOpenedError;
      expect(refusal).toBe('source-changed');
      // current.json still holds the whole room, over its live histories.
      expect(await roomState(harness)).toEqual(before);
      // The branch was saved before the change showed, so it stays openable;
      // no temporary rolling file is left behind.
      expect((await coordinator.list()).sessions.map((session) => session.sessionId))
        .toEqual([branch.sessionId]);
      expect(Object.keys(await sessionFiles(fs)).filter((name) => name.includes('.tmp-'))).toEqual([]);
    });
  });
});
