/**
 * The snapshot's model-slice seed (ADR 2026-11-03 D8). `modelsBeforeWindow`
 * holds, per scope, the last stamped requested model among the turns the
 * snapshot's window leaves out, and is present only when the window
 * truncates. Through the real aggregate, the window's slices seeded from it
 * equal the full ledger's slices as that window shows them.
 */

import type { ModelScope } from '@messages';
import {
  WORKSHOP_SNAPSHOT_TURN_WINDOW,
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import {
  deriveWorkshopModelSlices,
  workshopModelSlicesInWindow
} from '@shared/workshop/workshopModelSlices';

const A = 'vendor/model-a';
const B = 'vendor/model-b';
const C = 'vendor/model-c';

const stamp = (requestedModelId: string, scope: ModelScope = 'assistant') =>
  ({ scope, requestedModelId, servedModelIds: [requestedModelId] });

/** One writer message and its reply per entry; an undefined model leaves the reply unstamped. */
const roomOf = (models: ReadonlyArray<string | undefined>) => {
  let now = 1_000;
  const session = new WorkshopSessionService(() => ++now);
  session.setExcerpt({ text: 'She lifted the lantern.', source: { kind: 'manual' } });
  models.forEach((model, index) => {
    session.beginPersonaMessage(`request-${index}`, `Message ${index}`);
    session.completeRun(
      `request-${index}`, `Reply ${index}`, undefined, false, 'host-conversation',
      [], undefined, undefined, model ? stamp(model) : undefined
    );
  });
  return session;
};

const EXCHANGES_PAST_WINDOW = WORKSHOP_SNAPSHOT_TURN_WINDOW / 2 + 5;

describe('the snapshot’s modelsBeforeWindow', () => {
  it('is absent while the window holds every turn', () => {
    const snapshot = roomOf([A, B, C]).getSnapshot();
    expect(snapshot.truncatedTurns).toBe(0);
    expect('modelsBeforeWindow' in snapshot).toBe(false);
  });

  it('is absent when the window truncates but no omitted turn is stamped', () => {
    const snapshot = roomOf(Array.from({ length: EXCHANGES_PAST_WINDOW }, () => undefined)).getSnapshot();
    expect(snapshot.truncatedTurns).toBeGreaterThan(0);
    expect('modelsBeforeWindow' in snapshot).toBe(false);
  });

  it('holds the last stamped model before the window, and the window’s first reply slices from it', () => {
    const models = Array.from({ length: EXCHANGES_PAST_WINDOW }, (_, index) => (index < 8 ? A : B));
    // The turns the window omits end in model A; inside the window the room moves to B.
    const omittedExchanges = Math.ceil((EXCHANGES_PAST_WINDOW * 2 - WORKSHOP_SNAPSHOT_TURN_WINDOW) / 2);
    expect(omittedExchanges).toBeLessThan(8);
    const session = roomOf(models);
    const snapshot = session.getSnapshot();

    expect(snapshot.truncatedTurns).toBeGreaterThan(0);
    expect(snapshot.modelsBeforeWindow).toEqual({ assistant: A });

    const windowSlices = deriveWorkshopModelSlices(snapshot.turns, {
      modelsBeforeWindow: snapshot.modelsBeforeWindow
    });
    expect(windowSlices).toHaveLength(1);
    expect(windowSlices).toEqual(workshopModelSlicesInWindow(
      deriveWorkshopModelSlices(session.readRoomLedger()),
      snapshot.turns.map((turn) => turn.id)
    ));
    // Unseeded, the window would lose the switch from A to B.
    expect(deriveWorkshopModelSlices(snapshot.turns.slice(snapshot.turns.findIndex(
      (turn) => turn.model?.requestedModelId === B
    )))).toEqual([]);
  });

  it('keeps each scope’s own last value', () => {
    const session = roomOf([A]);
    session.beginPersonaMessage('request-dictionary', 'Look up a word');
    session.completeRun(
      'request-dictionary', 'A word.', undefined, false, 'host-conversation',
      [], undefined, undefined, stamp(C, 'dictionary')
    );
    for (let index = 0; index < EXCHANGES_PAST_WINDOW; index++) {
      session.beginPersonaMessage(`later-${index}`, `Later ${index}`);
      session.completeRun(`later-${index}`, `Later reply ${index}`, undefined, false, 'host-conversation');
    }
    expect(session.getSnapshot().modelsBeforeWindow).toEqual({ assistant: A, dictionary: C });
  });

  it('matches the full ledger’s slices as the window shows them, through switches on both sides of the cut', () => {
    const cycle = [A, A, undefined, B, B, C, undefined, A];
    const session = roomOf(Array.from({ length: EXCHANGES_PAST_WINDOW + 20 }, (_, index) => cycle[index % cycle.length]));
    const snapshot = session.getSnapshot();
    const seeded = deriveWorkshopModelSlices(snapshot.turns, { modelsBeforeWindow: snapshot.modelsBeforeWindow });

    expect(seeded.length).toBeGreaterThan(10);
    expect(seeded).toEqual(workshopModelSlicesInWindow(
      deriveWorkshopModelSlices(session.readRoomLedger()),
      snapshot.turns.map((turn) => turn.id)
    ));
  });
});
