/**
 * A Selected Text send across a room replacement (ADR 2026-11-14 D11, D14;
 * PR #259's clarification). The snapshot cache is the window's and survives
 * every replacement, so what binds a pill to the room it was shown in is the
 * send's `roomRevision`, checked by the room handler inside the send's own
 * mutation before the snapshot is looked up.
 *
 * One aggregate is shared by the real persistence coordinator (which runs
 * New, Open, Rewind and Branch for real, over session files in memory) and
 * the real composed Workshop routes (which take the delayed send). The pill
 * is shown, the replacement lands, and then the send arrives naming the old
 * room: each is refused whole, with the snapshot still held, and the new
 * room gains no turn and no attachment. The selection is from "Alice's
 * Adventures in Wonderland" (1865, public domain).
 */

import { MessageType, WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE } from '@messages';
import { EditorSelectionSnapshots } from '@/application/services/workshop/selection/EditorSelectionSnapshots';
import type { WorkshopSessionPersistenceCoordinator } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import {
  ALICE_TEXT,
  FakeEditorSelection,
  aliceSelection,
  recordingLog
} from '@/__tests__/application/services/workshop/selection/selectedTextFixtures';
import { ScriptedWorkshopRoom } from '@/__tests__/application/services/workshop/session/ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from '@/__tests__/application/services/workshop/session/WorkshopCoordinatorHarness';
import { createWorkshopRouteTestHarness, message } from './WorkshopRouteTestHarness';

const DRAFT = 'Is the silence doing enough here?';

async function roomWithAPillShown() {
  const scripted = new ScriptedWorkshopRoom().start();
  scripted.hostMessage('Does the opening hold?');
  scripted.hostMessage('And the second beat?');
  const other = new ScriptedWorkshopRoom().start('A different passage entirely.');
  other.hostMessage('Somewhere else.');

  const real = setupCoordinator();
  await real.store.saveNamed(scriptedCheckpoint('caterpillar', scripted));
  await real.store.saveNamed(scriptedCheckpoint('elsewhere', other));
  await real.coordinator.initialize();
  await real.coordinator.openNamed('caterpillar');

  const editor = new FakeEditorSelection();
  let minted = 0;
  const snapshots = new EditorSelectionSnapshots(editor, recordingLog(), { mintId: () => `snap-${++minted}` });
  const routes = createWorkshopRouteTestHarness({ session: real.session, selectedText: snapshots });

  // The pill is drawn: the toggle is on, and the webview holds this snapshot and this room.
  editor.select(aliceSelection());
  await routes.router.route(message(MessageType.WORKSHOP_SELECTED_TEXT_WATCH, { on: true }) as never);
  const [shown] = routes.posted(MessageType.WORKSHOP_SELECTED_TEXT_CURRENT).map((entry) => entry.payload.selection);
  const shownIn = real.session.readRoomRevision();
  const ledger = real.session.readRoomLedger();
  const writerTurns = ledger.filter((turn) => turn.participant === 'writer');
  return { real, routes, snapshots, shown, shownIn, writerTurns };
}

type Shown = Awaited<ReturnType<typeof roomWithAPillShown>>;

const REPLACEMENTS: Array<[string, (coordinator: WorkshopSessionPersistenceCoordinator, shown: Shown) => Promise<unknown>]> = [
  ['New', (coordinator) => coordinator.resetSession({ start: 'carry' })],
  ['Open', (coordinator) => coordinator.openNamed('elsewhere')],
  ['Rewind', (coordinator, { writerTurns }) =>
    coordinator.rewindTo({ kind: 'beforeTurn', turnId: writerTurns[1].id }, { origin: 'writer' })],
  ['Branch', (coordinator, { writerTurns }) =>
    coordinator.branchFrom({ kind: 'beforeTurn', turnId: writerTurns[1].id })]
];

const roomFacts = (session: WorkshopSessionService) => ({
  turns: session.readRoomLedger().map((turn) => turn.id),
  pending: session.collectMessageAttachments().map((attachment) => attachment.selectedText?.snapshotId ?? attachment.label)
});

describe('a Selected Text send that lands after its room was replaced', () => {
  it.each(REPLACEMENTS)('%s: the delayed send is refused on its room, with the snapshot still held', async (_name, replace) => {
    const shown = await roomWithAPillShown();
    const { real, routes, snapshots } = shown;
    expect(shown.shown).toMatchObject({ snapshotId: 'snap-1' });

    await replace(real.coordinator, shown);

    // Another room now, by the aggregate's own word.
    expect(real.session.readRoomRevision()).not.toBe(shown.shownIn);
    const before = roomFacts(real.session);
    // The cache is the window's: the replacement emptied nothing.
    expect(snapshots.find('snap-1')?.text).toBe(ALICE_TEXT);

    await routes.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, {
      text: DRAFT,
      selectedTextSnapshotId: 'snap-1',
      roomRevision: shown.shownIn
    }) as never);

    // The whole send is refused: no model call, no turn, no attachment, and the draft goes back.
    expect(routes.service.startWorkshopPersonaConversation).not.toHaveBeenCalled();
    expect(routes.service.continueConversation).not.toHaveBeenCalled();
    expect(roomFacts(real.session)).toEqual(before);
    expect(real.session.readRoomLedger().some((turn) => turn.content === DRAFT)).toBe(false);
    expect(before.pending).not.toContain('snap-1');
    expect(routes.posted(MessageType.ERROR).map((entry) => entry.payload.message)).toEqual([WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE]);
    expect(routes.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED).map((entry) => entry.payload.text)).toEqual([DRAFT]);
    const refusal = (routes.log.appendLine as jest.Mock).mock.calls.map(([line]) => line as string)
      .find((line) => line.includes('Send refused whole'));
    expect(refusal).toContain('room-changed');
    expect(snapshots.find('snap-1')).toBeDefined();
  });

  it('the same send, in the room it was shown in, stages the selection', async () => {
    const shown = await roomWithAPillShown();
    const { real, routes } = shown;
    await routes.router.route(message(MessageType.WORKSHOP_SEND_MESSAGE, {
      text: DRAFT,
      selectedTextSnapshotId: 'snap-1',
      roomRevision: shown.shownIn
    }) as never);
    // Not refused: the selection was staged for this send and the room took the writer's turn.
    expect(routes.posted(MessageType.ERROR).map((entry) => entry.payload.message)).not.toContain(WORKSHOP_SELECTED_TEXT_CHANGED_MESSAGE);
    expect(routes.posted(MessageType.WORKSHOP_COMPOSER_DRAFT_RESTORED)).toEqual([]);
    const sent = real.session.readRoomLedger().find((turn) => turn.content === DRAFT);
    const carried = sent?.messageAttachments ?? real.session.collectMessageAttachments();
    expect(carried.map((attachment) => attachment.selectedText?.snapshotId)).toContain('snap-1');
  });
});
