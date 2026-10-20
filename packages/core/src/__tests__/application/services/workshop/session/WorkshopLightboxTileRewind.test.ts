/**
 * A Lightbox tile across Rewind (PR #151 F-01; ADR 2026-10-19 D11, ADR
 * 2026-09-30 §1). A tile's identity is its board and tile ids, and every
 * path that puts an attachment above the composer honors it: staging, the
 * rewind that restages a sent message's attachments, and the hydration every
 * whole-room operation ends in. The room is the scripted room (the production
 * session and completion boundary) saved as a named session and opened by
 * the real coordinator. The reading is of "Alice's Adventures in Wonderland"
 * (1865, public domain).
 */

import type { WorkshopLightboxTile } from '@messages';
import { workshopLightboxTileAttachmentInput } from '@/application/services/workshop/WorkshopLightboxTileAttachment';
import { workshopLightboxTray } from '@/application/services/workshop/WorkshopLightboxTray';
import { buildWorkshopThreadArtifactFrame } from '@/application/services/workshop/WorkshopThreadArtifactFrame';
import type { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import type { WorkshopRewindCut } from '@/application/services/workshop/session/WorkshopRewindPolicy';
import { workshopMessageAttachmentKind } from '@shared/constants/workshopThreadArtifactKinds';
import { ScriptedWorkshopRoom } from './ScriptedWorkshopRoom';
import { scriptedCheckpoint, setupCoordinator } from './WorkshopCoordinatorHarness';

const before = (turnId: string): WorkshopRewindCut => ({ kind: 'beforeTurn', turnId });

const TILE_A: WorkshopLightboxTile = {
  origin: 'lightbox',
  boardId: 'board-1',
  tileId: 'tile-c-spark-1',
  kindLabel: 'Open door',
  lensLabel: 'Spark',
  title: 'The empty jar',
  claim: 'What if the jar came back, full this time, when Alice least needs it?',
  points: [],
  quotes: [{ paragraph: 5, text: 'she took down a jar from one of the shelves as she passed' }],
  sourceLabel: 'Drafts/alice-chapter-1.md'
};
const A_KEY = 'lightbox-tile:board-1:tile-c-spark-1';
const MESSAGE = 'What do you make of the jar?';

/** A room that sent tile A with a writer message, and, when asked, brought A again for the next one. */
async function roomThatSentA(options: { pendingAgain: boolean }) {
  const room = new ScriptedWorkshopRoom().start();
  const sent = workshopLightboxTileAttachmentInput(TILE_A);
  room.hostMessage(MESSAGE, { attachment: { label: sent.label, content: sent.content, input: sent } });
  if (options.pendingAgain) {
    // Permitted: the send cleared the tray.
    expect(room.session.addMessageAttachment(workshopLightboxTileAttachmentInput(TILE_A)).ok).toBe(true);
  }
  const harness = setupCoordinator();
  await harness.store.saveNamed(scriptedCheckpoint('tiles', room));
  await harness.coordinator.initialize();
  await harness.coordinator.openNamed('tiles');
  const writerTurn = harness.session.readRoomLedger().find((turn) => turn.participant === 'writer' && turn.content === MESSAGE)!;
  expect(writerTurn.messageAttachments).toEqual([expect.objectContaining({ lightboxTile: expect.objectContaining({ tileId: TILE_A.tileId }) })]);
  return { ...harness, writerTurn };
}

const trayOf = (session: WorkshopSessionService) => workshopLightboxTray(session).read();
const bringA = (session: WorkshopSessionService) => session.addMessageAttachment(workshopLightboxTileAttachmentInput(TILE_A));
/** The frames the next send would carry, as the room handler builds them from the pending list. */
const sendFramesOf = (session: WorkshopSessionService) => session.collectMessageAttachments().map((attachment) => {
  const kind = workshopMessageAttachmentKind(attachment);
  return buildWorkshopThreadArtifactFrame({
    id: attachment.id,
    ...(kind ? { kind } : {}),
    name: attachment.label,
    sourcePath: attachment.relativePath,
    content: attachment.content
  });
});

describe('a Lightbox tile across Rewind (PR #151 F-01)', () => {
  it('keeps one A when the rewound message carried A and A already waits again, and the next send frames it once', async () => {
    const { coordinator, session, writerTurn } = await roomThatSentA({ pendingAgain: true });
    const waiting = session.collectMessageAttachments();
    expect(waiting).toHaveLength(1);

    const outcome = await coordinator.rewindTo(before(writerTurn.id), { origin: 'writer' });

    expect(outcome.composerRestore).toEqual({ text: MESSAGE, attachmentIds: [], unrestoredAttachmentLabels: [] });
    expect(trayOf(session)).toEqual([{ boardId: TILE_A.boardId, tileId: TILE_A.tileId, label: waiting[0].label }]);
    expect(session.collectMessageAttachments()).toEqual([expect.objectContaining({ id: waiting[0].id, sourceUri: A_KEY })]);
    const frames = sendFramesOf(session);
    expect(frames).toHaveLength(1);
    expect(frames[0]).toContain('kind="lightbox-tile"');
    expect(bringA(session)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('restores A with its identity when nothing waits, so A cannot be staged twice', async () => {
    const { coordinator, session, writerTurn } = await roomThatSentA({ pendingAgain: false });
    const [ref] = writerTurn.messageAttachments!;

    const outcome = await coordinator.rewindTo(before(writerTurn.id), { origin: 'writer' });

    expect(outcome.composerRestore).toEqual({ text: MESSAGE, attachmentIds: [ref.id], unrestoredAttachmentLabels: [] });
    expect(session.collectMessageAttachments()).toEqual([expect.objectContaining({
      id: ref.id,
      sourceUri: A_KEY,
      lightboxTile: ref.lightboxTile
    })]);
    expect(bringA(session)).toEqual({ ok: false, reason: 'duplicate' });
    expect(trayOf(session)).toHaveLength(1);
    expect(sendFramesOf(session)).toEqual([expect.stringContaining('kind="lightbox-tile"')]);
  });

  it('removes and brings A again after a rewind without A ever waiting twice', async () => {
    const { coordinator, session, writerTurn } = await roomThatSentA({ pendingAgain: true });
    await coordinator.rewindTo(before(writerTurn.id), { origin: 'writer' });

    const keyed = session.collectMessageAttachments().find((attachment) => attachment.sourceUri === A_KEY)!;
    session.removeMessageAttachment(keyed.id);
    expect(bringA(session).ok).toBe(true);
    expect(trayOf(session)).toHaveLength(1);
    expect(bringA(session)).toEqual({ ok: false, reason: 'duplicate' });
    expect(sendFramesOf(session)).toHaveLength(1);
  });

  it('repairs a development checkpoint that holds A twice, once without its key, on open, and logs the repair', async () => {
    const room = new ScriptedWorkshopRoom().start();
    room.hostMessage('Opening?');
    expect(bringA(room.session).ok).toBe(true);
    const checkpoint = scriptedCheckpoint('twice', room);
    // What an earlier rewind left: the waiting copy, then a restaged one with no key.
    const [waiting] = checkpoint.workshop.pendingMessageAttachments;
    const { sourceUri: _key, ...unkeyed } = waiting;
    const restagedId = `ta-${checkpoint.workshop.counters.threadArtifact + 1}`;
    checkpoint.workshop.counters.threadArtifact += 1;
    checkpoint.workshop.pendingMessageAttachments.push({ ...unkeyed, id: restagedId });
    const lone = JSON.parse(JSON.stringify(checkpoint));
    lone.sessionId = 'lone';
    lone.workshop.pendingMessageAttachments = [{ ...unkeyed, id: restagedId }];

    const harness = setupCoordinator();
    await harness.store.saveNamed(checkpoint);
    await harness.store.saveNamed(lone);
    await harness.coordinator.initialize();
    await harness.coordinator.openNamed('twice');
    expect(harness.session.collectMessageAttachments()).toEqual([expect.objectContaining({ id: waiting.id, sourceUri: A_KEY })]);
    expect(harness.log.appendLine).toHaveBeenCalledWith(expect.stringContaining('dropped-duplicate-pending-lightbox-tiles'));

    await harness.coordinator.openNamed('lone');
    expect(harness.session.collectMessageAttachments()).toEqual([expect.objectContaining({ id: restagedId, sourceUri: A_KEY })]);
    expect(harness.log.appendLine).toHaveBeenCalledWith(expect.stringContaining('restored-lightbox-tile-source-keys'));
    expect(bringA(harness.session)).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('holds another tile from the same board apart from A', async () => {
    const { coordinator, session, writerTurn } = await roomThatSentA({ pendingAgain: false });
    await coordinator.rewindTo(before(writerTurn.id), { origin: 'writer' });
    expect(session.addMessageAttachment(workshopLightboxTileAttachmentInput({ ...TILE_A, tileId: 'tile-c-spark-2' })).ok).toBe(true);
    expect(trayOf(session).map((tile) => tile.tileId)).toEqual([TILE_A.tileId, 'tile-c-spark-2']);
  });
});
