/**
 * The coordinator's Rewind operation (ADR 2026-09-30 §6; Sprint 02
 * kickoff decisions 2 and 5) over real collaborators: the live room is
 * exported, cut by the pure transform, installed through Open's promotion
 * core, and written before the operation reports success.
 */

import * as rewindModule from '@/application/services/workshop/session/WorkshopSessionRewind';
import {
  WorkshopRewindRefusedError
} from '@/application/services/workshop/session/WorkshopSessionRewind';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import type {
  WorkshopConversationLogicalKey
} from '@/application/services/workshop/WorkshopSessionStateV1';
import type { WorkshopSessionSaveStatus } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopPersonaConversationKey } from '@/application/services/workshop/WorkshopSessionTimeService';
import { clonePersistedJson } from '@/application/services/workshop/persistedJson';
import { WorkshopSessionStoreUnavailableError } from '@/infrastructure/storage/WorkshopSessionStore';
import type { ConversationArchiveEntryV1 } from '@orchestration/ConversationManager';
import { DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR } from '@messages';
import { WorkshopRoomDeliveryService } from '@/application/services/workshop/WorkshopRoomDeliveryService';
import { runCanonicalScriptedRoom, ScriptedRestPoint, ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { HARNESS_ROOT, scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const after = (turnId: string): WorkshopRewindCut => ({ kind: 'afterTurn', turnId });
const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const restPoint = (room: ScriptedWorkshopRoom, label: string): ScriptedRestPoint =>
  room.restPoints.find((point) => point.label === label)!;

const CURRENT_PATH = `${HARNESS_ROOT}/prose-minion/sessions/current.json`;

/** The canonical room, saved as a named session and opened as the live room. */
async function openCanonicalRoom() {
  const harness = setupCoordinator();
  const room = runCanonicalScriptedRoom();
  const checkpoint = scriptedCheckpoint('scripted', room);
  await harness.store.saveNamed(checkpoint);
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('scripted');
  return { ...harness, room, checkpoint };
}

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

describe('WorkshopSessionPersistenceCoordinator.rewindTo (ADR 2026-09-30 §6)', () => {
  it('rewinds a named room, writes its file before succeeding, and retires only the superseded conversations', async () => {
    const { coordinator, session, manager, store, room, checkpoint, log } = await openCanonicalRoom();
    const point = restPoint(room, 'context added: Continuity note');
    const priorHost = session.getHostConversationId()!;
    const priorGuest = session.getPersonaGuestConversationId('margot')!;
    const expected = rewindModule.rewindWorkshopSession({
      workshop: checkpoint.workshop,
      conversations: checkpoint.conversations,
      cut: after(point.headTurnId)
    });

    const outcome = await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });

    expect(outcome).toEqual({
      summary: expected.summary,
      composerRestore: undefined,
      degradedConversationKeys: [],
      degradedConversations: []
    });
    expect(clonePersistedJson(session.exportCommittedState())).toEqual(expected.workshop);
    // The superseded conversations are gone; the cut histories replace them.
    expect(manager.hasConversation(priorHost)).toBe(false);
    expect(manager.hasConversation(priorGuest)).toBe(false);
    const host = session.getHostConversationId()!;
    expect(manager.getMessages(host).slice(1))
      .toEqual(expected.conversations.find((entry) => entry.key === 'host')!.messages);
    expect(session.getPersonaGuestConversationId('margot')).toBeUndefined();
    expect(manager.getActiveConversationCount()).toBe(1);
    // Durable before success: the named file, then its rolling mirror.
    const named = await store.readNamed('scripted');
    expect(named?.workshop).toEqual(clonePersistedJson(session.exportCommittedState()));
    expect(named?.conversations).toEqual(expected.conversations);
    expect((await store.readCurrent())?.workshop.turns).toHaveLength(point.workshop.turns.length);
    expect(coordinator.hasPendingWrite()).toBe(false);
    // One diagnostic line: counts and keys, never message content.
    const lines = (log.appendLine as jest.Mock).mock.calls.map(([line]) => String(line));
    const rewound = lines.filter((line) => line.includes('Room rewound'));
    expect(rewound).toHaveLength(1);
    expect(rewound[0]).toContain(`keptThrough=${point.headTurnId}`);
    expect(rewound[0]).toContain('dropped=guest:margot');
    expect(rewound[0]).toMatch(/host \d+→\d+/);
    expect(lines.join('\n')).not.toContain('Host reply to');
  });

  it('rewinds an unnamed room by writing current.json, and saves nothing by name', async () => {
    const { store, coordinator, session } = setupCoordinator();
    const room = runCanonicalScriptedRoom();
    await store.writeCurrent(scriptedCheckpoint('rolling', room));
    await coordinator.initialize();
    const point = restPoint(room, 'prose report');

    await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });

    const current = await store.readCurrent();
    expect(current?.workshop).toEqual(clonePersistedJson(session.exportCommittedState()));
    expect(current?.workshop.turns.at(-1)?.id).toBe(point.headTurnId);
    expect((await coordinator.list()).sessions).toEqual([]);
  });

  describe('rollback (ADR §6: any failure restores the prior room)', () => {
    it.each<[string, (harness: Awaited<ReturnType<typeof openCanonicalRoom>>) => void]>([
      ['the transform', () => {
        jest.spyOn(rewindModule, 'rewindWorkshopSession').mockImplementationOnce(() => {
          throw new Error('transform failed');
        });
      }],
      ['the import', ({ assistant }) => {
        assistant.importWorkshopConversationArchive.mockRejectedValueOnce(new Error('import failed'));
      }],
      ['the hydration', ({ session }) => {
        jest.spyOn(session, 'hydrateCommittedState').mockImplementationOnce(() => {
          throw new Error('hydrate failed');
        });
      }],
      ['the write', ({ store }) => {
        jest.spyOn(store, 'updateNamed').mockRejectedValueOnce(new Error('write failed'));
      }]
    ])('leaves the prior room and its conversations intact when %s fails', async (stage, inject) => {
      const harness = await openCanonicalRoom();
      const { coordinator, session, manager, store, room } = harness;
      const point = restPoint(room, 'host reply: gesture directions');
      const roomBefore = session.exportCommittedState();
      const bindings = {
        host: session.getHostConversationId(),
        guest: session.getPersonaGuestConversationId('margot')
      };
      const historiesBefore = {
        host: manager.getMessages(bindings.host!),
        guest: manager.getMessages(bindings.guest!)
      };
      const conversationCount = manager.getActiveConversationCount();
      const namedBefore = JSON.stringify(await store.readNamed('scripted'));
      const currentBefore = JSON.stringify(await store.readCurrent());
      inject(harness);

      const failure = await refusalOf(
        coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' })
      );

      expect(String(failure)).toContain(`${stage.replace('the ', '').replace('hydration', 'hydrate')} failed`);
      expect(session.exportCommittedState()).toEqual(roomBefore);
      expect({
        host: session.getHostConversationId(),
        guest: session.getPersonaGuestConversationId('margot')
      }).toEqual(bindings);
      expect(manager.getMessages(bindings.host!)).toEqual(historiesBefore.host);
      expect(manager.getMessages(bindings.guest!)).toEqual(historiesBefore.guest);
      // Conversations the failed installation imported are retired with it.
      expect(manager.getActiveConversationCount()).toBe(conversationCount);
      expect(JSON.stringify(await store.readNamed('scripted'))).toBe(namedBefore);
      expect(JSON.stringify(await store.readCurrent())).toBe(currentBefore);
      expect(coordinator.getDegradedConversationKeys()).toEqual([]);

      // A failed rewind never poisons the operation queue.
      await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });
      expect(session.exportCommittedState().turns.at(-1)?.id).toBe(point.headTurnId);
    });
  });

  describe('refusals (the host re-checks; webview gating is advisory)', () => {
    it('refuses while a run is active', async () => {
      const { coordinator, session, room } = await openCanonicalRoom();
      const point = restPoint(room, 'prose report');
      session.beginPersonaMessage('in-flight', 'Still thinking…');

      const refusal = await refusalOf(coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' }));

      expect(refusal).toBeInstanceOf(WorkshopRewindRefusedError);
      expect((refusal as WorkshopRewindRefusedError).reason).toBe('busy');
    });

    it('refuses while another session operation is pending', async () => {
      const { coordinator, room } = await openCanonicalRoom();
      const point = restPoint(room, 'prose report');
      const saving = coordinator.saveNamed('Another title');

      const refusal = await refusalOf(coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' }));

      expect((refusal as WorkshopRewindRefusedError).reason).toBe('busy');
      await saving;
    });

    it.each<[string, (room: ScriptedWorkshopRoom) => WorkshopRewindCut, string]>([
      ['a position inside a run', (room) =>
        after(room.session.readRoomLedger().find((turn) => turn.capability !== undefined)!.id),
      'not-a-rest-point'],
      ['a point across the directive change', (room) =>
        after(restPoint(room, 'start').headTurnId),
      'before-directive-change']
    ])('refuses %s without touching the room or its files', async (_label, cutFor, reason) => {
      const { coordinator, session, store, room } = await openCanonicalRoom();
      const roomBefore = session.exportCommittedState();
      const updateNamed = jest.spyOn(store, 'updateNamed');

      const refusal = await refusalOf(coordinator.rewindTo(cutFor(room), { origin: 'writer' }));

      expect((refusal as WorkshopRewindRefusedError).reason).toBe(reason);
      expect(session.exportCommittedState()).toEqual(roomBefore);
      expect(updateNamed).not.toHaveBeenCalled();
    });

    it('follows New-session availability: no workspace, no rewind', async () => {
      const { coordinator, session } = setupCoordinator({ workspace: 'none' });
      await coordinator.initialize();
      const head = session.readRoomLedger().at(-1)!.id;

      const refusal = await refusalOf(coordinator.rewindTo(after(head), { origin: 'writer' }));

      expect(refusal).toBeInstanceOf(WorkshopSessionStoreUnavailableError);
    });
  });

  it('keeps the rewound room in memory while current.json is protected, and never overwrites it', async () => {
    const { fs, coordinator, session, manager } = setupCoordinator();
    await fs.writeFile(CURRENT_PATH, new TextEncoder().encode('{ not a session'));
    await coordinator.initialize();
    expect(coordinator.isCurrentCheckpointProtected()).toBe(true);
    // A room built in memory after the failed restore.
    const room = runCanonicalScriptedRoom();
    const archive = room.archive() as ConversationArchiveEntryV1<WorkshopConversationLogicalKey>[];
    const bindings: Partial<Record<WorkshopConversationLogicalKey, string>> = {};
    for (const outcome of manager.importConversations(
      archive.map((entry) => ({ entry, systemMessage: `${entry.toolName} system` }))
    )) {
      if (outcome.status === 'imported') {
        bindings[outcome.key] = outcome.conversationId;
      }
    }
    session.hydrateCommittedState(
      room.session.exportCommittedState(),
      bindings,
      DEFAULT_WORKSHOP_CONVERSATION_BEHAVIOR
    );
    const statuses: WorkshopSessionSaveStatus[] = [];
    coordinator.addSessionSaveStatusListener((status) => statuses.push(status));
    const point = restPoint(room, 'prose report');

    await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });

    expect(session.exportCommittedState().turns.at(-1)?.id).toBe(point.headTurnId);
    expect(new TextDecoder().decode(await fs.readFile(CURRENT_PATH))).toBe('{ not a session');
    expect(statuses.at(-1)).toMatchObject({ status: 'error' });
  });

  describe('origins and generic cuts (Side Quests foundation)', () => {
    it('cuts at a divider and at the idle head for a Side Quest end, never re-seeding the composer', async () => {
      const { coordinator, session, room } = await openCanonicalRoom();
      const total = session.readRoomLedger().length;
      const head = session.readRoomLedger().at(-1)!.id;

      const atHead = await coordinator.rewindTo(after(head), { origin: 'sideQuestEnd' });
      expect(atHead.summary).toEqual({
        keptThroughTurnId: head,
        removedTurnCount: 0,
        droppedConversationKeys: [],
        removedTodoCount: 0,
        releasedWidgetConfigIds: []
      });

      const divider = restPoint(room, 'excerpt revised to v2');
      expect(session.readRoomLedger().find((turn) => turn.id === divider.headTurnId)?.artifact)
        .toBe('excerpt_revision');
      const atDivider = await coordinator.rewindTo(after(divider.headTurnId), { origin: 'sideQuestEnd' });
      expect(atDivider.composerRestore).toBeUndefined();
      expect(atDivider.summary.removedTurnCount).toBe(total - divider.workshop.turns.length);
      expect(session.readRoomLedger()).toHaveLength(divider.workshop.turns.length);
    });

    it('returns the composer edit only to the writer origin', async () => {
      const writerCut = (room: ScriptedWorkshopRoom) => {
        const ledger = room.session.readRoomLedger();
        return before(ledger.find((turn) =>
          turn.participant === 'writer' && turn.content === 'Does the revision land?')!.id);
      };

      const writer = await openCanonicalRoom();
      const outcome = await writer.coordinator.rewindTo(writerCut(writer.room), { origin: 'writer' });
      expect(outcome.composerRestore).toEqual({
        text: 'Does the revision land?',
        attachmentIds: [expect.stringMatching(/^ta-\d+$/)],
        unrestoredAttachmentLabels: []
      });
      expect(writer.session.collectMessageAttachments()).toEqual([
        expect.objectContaining({
          id: outcome.composerRestore!.attachmentIds[0],
          label: 'beat-sheet.md',
          content: 'Beat one: the cup. Beat two: the sill.'
        })
      ]);

      const quest = await openCanonicalRoom();
      const questOutcome = await quest.coordinator.rewindTo(writerCut(quest.room), { origin: 'sideQuestEnd' });
      expect(questOutcome.composerRestore).toBeUndefined();
    });

    it('reopens a widget message\'s released config for the writer origin only (Sprint 03 kickoff decision 3)', async () => {
      const widgetMessage = (room: ScriptedWorkshopRoom) =>
        room.session.readRoomLedger().find((turn) => turn.widgetCommit?.rail === 'thread-artifact')!;

      const writer = await openCanonicalRoom();
      const message = widgetMessage(writer.room);
      const configId = message.widgetCommit!.widgetConfigId;
      const outcome = await writer.coordinator.rewindTo(before(message.id), { origin: 'writer' });

      expect(outcome.widgetRestore).toEqual({ widgetConfigId: configId });
      expect(outcome.composerRestore).toBeUndefined();
      expect(outcome.summary.releasedWidgetConfigIds).toEqual([configId]);
      // The retry token is held host-side, draft and all, ready to reopen.
      const released = writer.session.getWidgetConfig(configId)!;
      expect(released.committedTurnId).toBeUndefined();
      expect(released.draft).toEqual(writer.room.session.getWidgetConfig(configId)!.draft);

      const quest = await openCanonicalRoom();
      const questOutcome = await quest.coordinator.rewindTo(
        before(widgetMessage(quest.room).id),
        { origin: 'sideQuestEnd' }
      );
      expect(questOutcome.widgetRestore).toBeUndefined();
    });

    it('sends a reopened widget message back to the host it addressed, not a later chat target (PR #120 review F-02)', async () => {
      const harness = setupCoordinator();
      const room = new ScriptedWorkshopRoom().start();
      room.hostMessage('Opening?');
      room.inviteGuest('margot', 'Margot, read this with us.');
      room.hostWidgetCommit();
      room.guestMessage('margot', 'How does the voice sound?');
      await harness.store.saveNamed(scriptedCheckpoint('widget-then-guest', room));
      await harness.coordinator.initialize();
      await harness.coordinator.openNamed('widget-then-guest');
      expect(harness.session.getChatTarget()).toEqual({ kind: 'personaGuest', personaId: 'margot' });
      const message = room.session.readRoomLedger()
        .find((turn) => turn.widgetCommit?.rail === 'thread-artifact')!;

      const outcome = await harness.coordinator.rewindTo(before(message.id), { origin: 'writer' });

      expect(outcome.widgetRestore).toEqual({ widgetConfigId: message.widgetCommit!.widgetConfigId });
      // Margot is still in the room; a recommit from the reopened sheet goes to the host.
      expect(harness.session.getPersonaGuestConversationId('margot')).toBeDefined();
      expect(harness.session.getChatTarget()).toEqual({ kind: 'host' });
    });
  });

  it('hands a host removed by the cut the whole kept room as catch-up on its first run', async () => {
    const harness = setupCoordinator();
    // A writer-requested report before the host ever spoke: its synthesis is
    // the host's first reply.
    const room = new ScriptedWorkshopRoom().start();
    const { report } = room.toolRun('prose');
    await harness.store.saveNamed(scriptedCheckpoint('pre-host', room));
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('pre-host');

    const outcome = await harness.coordinator.rewindTo(after(report.id), { origin: 'writer' });

    expect(outcome.summary.droppedConversationKeys).toEqual(['host']);
    expect(harness.session.hasHostConversation()).toBe(false);
    const catchUp = new WorkshopRoomDeliveryService(harness.session).prepare({ kind: 'host' });
    expect(catchUp.deliveredTurnIds).toContain(report.id);
    expect(catchUp.hasConversationalCatchUp).toBe(true);
  });

  describe('temporal state (Sprint 02 kickoff decision 2, as amended at Sprint 03 kickoff)', () => {
    it('stays current for a surviving persona and ends with a dropped one', async () => {
      const { coordinator, time, room, store } = await openCanonicalRoom();
      // Opening queued one resume marker; the first interaction consumes it.
      expect(coordinator.beginInteraction()).toBeDefined();
      // Both retained personas have been handed their frames since the open.
      time.commitNotice(time.prepareNotice('host')!);
      time.commitNotice(time.prepareNotice('guest:margot')!);
      const hostNotice = time.exportState().personaNotices
        .find((notice) => notice.conversationKey === 'host');
      const point = restPoint(room, 'prose report');

      const outcome = await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });

      expect(outcome.summary.droppedConversationKeys).toEqual(['guest:margot']);
      // No resume marker and no resume frame: the surviving host's hour stands.
      expect(coordinator.beginInteraction()).toBeUndefined();
      expect(time.prepareNotice('host')).toBeUndefined();
      expect(time.exportRuntimeState()).toEqual({
        temporal: expect.objectContaining({ personaNotices: [hostNotice] }),
        pendingResumeKeys: []
      });
      // Margot's conversation ended with the cut, and the written room agrees.
      expect(time.prepareNotice('guest:margot')).toMatchObject({ reason: 'session_start' });
      expect((await store.readNamed('scripted'))?.temporal.personaNotices).toEqual([hostNotice]);
    });

    it('gives the fresh host a session-start frame, and rollback restores the old notice', async () => {
      const { coordinator, time, room, store } = await openCanonicalRoom();
      time.commitNotice(time.prepareNotice('host')!);
      // Before the host's first reply: the cut removes the host's conversation.
      const point = restPoint(room, 'standing directive installed');
      const before = time.exportRuntimeState();
      jest.spyOn(store, 'updateNamed').mockRejectedValueOnce(new Error('write failed'));

      await expect(coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' }))
        .rejects.toThrow('write failed');

      expect(time.exportRuntimeState()).toEqual(before);
      expect(time.prepareNotice('host')).toBeUndefined();

      const outcome = await coordinator.rewindTo(after(point.headTurnId), { origin: 'writer' });

      expect(outcome.summary.droppedConversationKeys).toContain('host');
      expect(time.prepareNotice('host')).toMatchObject({ reason: 'session_start' });
      expect((await store.readNamed('scripted'))?.temporal.personaNotices).toEqual([]);
    });

    describe('a persona whose history fails to import (PR #120 review F-03)', () => {
      type Harness = ReturnType<typeof setupCoordinator>;

      /** Import every history but `key`'s, as when its current prompt cannot be rebuilt. */
      const degradeImportOf = ({ assistant, manager }: Harness, key: WorkshopPersonaConversationKey) => {
        const importArchive = assistant.importWorkshopConversationArchive.getMockImplementation()!;
        assistant.importWorkshopConversationArchive.mockImplementationOnce(async (targets) =>
          (await importArchive(targets)).map((outcome) => {
            if (outcome.key !== key || outcome.status !== 'imported') {
              return outcome;
            }
            manager.deleteConversation(outcome.conversationId);
            return { key: outcome.key, status: 'degraded' as const, reason: 'Current system prompt could not be rebuilt.' };
          }));
      };

      /** A saved host-and-Margot room, both handed their frames since it opened. */
      async function openWithNotices() {
        const harness = setupCoordinator();
        const room = new ScriptedWorkshopRoom().start();
        room.hostMessage('Opening?');
        room.inviteGuest('margot', 'Margot, read this with us.');
        room.hostWidgetCommit();
        room.guestMessage('margot', 'How does the voice sound?');
        room.hostMessage('Anything else?');
        await harness.store.saveNamed(scriptedCheckpoint('scripted', room));
        await harness.coordinator.initialize();
        await harness.coordinator.openNamed('scripted');
        expect(harness.coordinator.beginInteraction()).toBeDefined();
        harness.time.commitNotice(harness.time.prepareNotice('host')!);
        harness.time.commitNotice(harness.time.prepareNotice('guest:margot')!);
        // Both personas survive a cut after the widget reply.
        const cut = after(restPoint(room, 'host reply: gesture directions').headTurnId);
        return { ...harness, cut };
      }

      it.each<[WorkshopPersonaConversationKey, WorkshopPersonaConversationKey]>([
        ['host', 'guest:margot'],
        ['guest:margot', 'host']
      ])('ends %s\'s notice with its conversation and keeps %s\'s', async (degraded, imported) => {
        const harness = await openWithNotices();
        const { coordinator, time, store, cut } = harness;
        const kept = time.exportState().personaNotices
          .filter((notice) => notice.conversationKey === imported);
        degradeImportOf(harness, degraded);

        const outcome = await coordinator.rewindTo(cut, { origin: 'writer' });

        expect(outcome.summary.droppedConversationKeys).not.toContain(degraded);
        expect(outcome.degradedConversationKeys).toEqual([degraded]);
        expect(time.prepareNotice(degraded)).toMatchObject({ reason: 'session_start' });
        expect(time.prepareNotice(imported)).toBeUndefined();
        expect(time.exportState().personaNotices).toEqual(kept);
        expect((await store.readNamed('scripted'))?.temporal.personaNotices).toEqual(kept);
      });

      it('restores the notice when the rewound room fails to write', async () => {
        const harness = await openWithNotices();
        const { coordinator, time, store, cut } = harness;
        const before = time.exportRuntimeState();
        degradeImportOf(harness, 'host');
        jest.spyOn(store, 'updateNamed').mockRejectedValueOnce(new Error('write failed'));

        await expect(coordinator.rewindTo(cut, { origin: 'writer' })).rejects.toThrow('write failed');

        expect(time.exportRuntimeState()).toEqual(before);
        expect(time.prepareNotice('host')).toBeUndefined();
      });

      it('needs no forgetting on Open, which queues every retained persona a resume frame', async () => {
        const harness = setupCoordinator();
        const checkpoint = scriptedCheckpoint('scripted', runCanonicalScriptedRoom());
        checkpoint.temporal = {
          ...checkpoint.temporal,
          personaNotices: [{ conversationKey: 'host', notifiedAt: checkpoint.temporal.startedAt }]
        };
        await harness.store.saveNamed(checkpoint);
        await harness.coordinator.initialize();
        degradeImportOf(harness, 'host');

        const opened = await harness.coordinator.openNamed('scripted');

        // The fresh host still gets its time frame on its first turn.
        expect(opened.degradedConversationKeys).toEqual(['host']);
        expect(harness.time.prepareNotice('host')).toMatchObject({ reason: 'session_resume' });
      });
    });
  });
});
