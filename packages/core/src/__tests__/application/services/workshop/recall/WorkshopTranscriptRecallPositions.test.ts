/**
 * `positionsOf` (ADR 2026-11-04 D3): project memory's one question of
 * session recall, answered from the same documents and cache as a read,
 * over the real store and coordinator. A position is a per-read address;
 * a turn the record no longer holds is left out, never guessed.
 */
import { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { saveRecallRoom } from '@/__tests__/application/services/workshop/recall/workshopRecallFixtures';

describe('positionsOf', () => {
  it('finds a saved session\'s turns by id, in position order, and reports the live room and unknown sessions', async () => {
    const room = await saveRecallRoom('Chapter 3 tea party', (session, advance) => {
      session.setSessionScope('open');
      session.beginPersonaMessage('r1', 'Does the watch run backward?');
      advance(1_000);
      session.completeRun('r1', 'It does, from chapter 3 on.', undefined, false, 'runtime-host');
      advance(1_000);
      session.beginPersonaMessage('r2', 'And nobody remarks on it?');
      advance(1_000);
      session.completeRun('r2', 'Nobody does.', undefined, false, 'runtime-host');
    });
    const saved = await room.store.readNamed(room.savedSessionId);
    const ids = saved!.workshop.turns.map((turn) => turn.id);
    const recall = new WorkshopTranscriptRecallService(room.store, room.coordinator, room.log);

    const found = await recall.positionsOf(room.savedSessionId, [ids[3], ids[1], 'turn-999-user-1730643725000']);
    expect(found).toEqual({ kind: 'positions', sessionId: room.savedSessionId, title: 'Chapter 3 tea party', positions: [2, 4] });

    const scope = room.coordinator.recallScope();
    expect(scope.available).toBe(true);
    expect(await recall.positionsOf((scope as { liveSessionId: string }).liveSessionId, ids)).toEqual({ kind: 'live-session' });
    expect(await recall.positionsOf('never-named-room', ids)).toEqual({ kind: 'unknown-session' });
  });

  it('reports recall unavailable when the coordinator refuses its scope', async () => {
    const room = await saveRecallRoom('Chapter 3', () => undefined);
    const recall = new WorkshopTranscriptRecallService(room.store, { recallScope: () => ({ available: false, reason: 'workspace-changed' }) }, room.log);
    expect(await recall.positionsOf(room.savedSessionId, [])).toEqual({ kind: 'unavailable', available: false, reason: 'workspace-changed' });
  });
});
