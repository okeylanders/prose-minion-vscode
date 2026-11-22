/**
 * The one search a Workshop window runs, by operation (PR #296 re-review):
 * released by identity only, freed at a replacement, ended for good by
 * closing the window, and never busy for a room it did not begin in.
 */

import { WorkshopPassageSearchRunSlot } from '@handlers/domain/workshop/WorkshopPassageSearchRunSlot';

describe('the passage-search run slot', () => {
  const room = { revision: 5, instance: 1 };
  const slot = () => new WorkshopPassageSearchRunSlot({ readRoomRevision: () => room.revision, openRoomInstance: () => room.instance });

  beforeEach(() => {
    room.revision = 5;
    room.instance = 1;
  });

  it('mints each operation with its own id and the room it began in, and an older one releases nothing', () => {
    const runs = slot();
    const first = runs.take('turn-2', 'ps-1')!;
    runs.release(first);
    const second = runs.take('turn-4', 'ps-2')!;
    expect(second.id).toBe(first.id + 1);
    expect(second).toEqual(expect.objectContaining({ turnId: 'turn-4', requestId: 'ps-2', roomRevision: 5, roomInstance: 1 }));
    runs.release(first);
    expect(runs.live()).toBe(second);
    expect(runs.owns(first)).toBe(false);
    expect(runs.owns(second)).toBe(true);
  });

  it('a replacement stops the search and frees the slot at once', () => {
    const runs = slot();
    const old = runs.take('turn-2', 'ps-1')!;
    room.revision = 6;
    room.instance = 2;
    expect(runs.replaced()).toBe(old);
    expect(old.controller.signal.aborted).toBe(true);
    expect(runs.live()).toBeUndefined();
    const fresh = runs.take('turn-2', 'ps-2')!;
    runs.release(old);
    expect(runs.live()).toBe(fresh);
  });

  it.each([
    ['a Rewind (the same instance, another revision)', () => { room.revision = 6; }],
    ['another open room under the same revision number', () => { room.instance = 2; }]
  ])('a search whose room moved with no word is not busy: %s', (_name, move) => {
    const runs = slot();
    const old = runs.take('turn-2', 'ps-1')!;
    move();
    expect(runs.owns(old)).toBe(false);
    expect(runs.live()).toBeUndefined();
    expect(old.controller.signal.aborted).toBe(true);
  });

  it('closing the window ends the search, and no operation owns or takes anything after', () => {
    const runs = slot();
    const running = runs.take('turn-2', 'ps-1')!;
    runs.close();
    expect(running.controller.signal.aborted).toBe(true);
    expect(runs.owns(running)).toBe(false);
    expect(runs.isClosed()).toBe(true);
    expect(runs.take('turn-4', 'ps-2')).toBeUndefined();
    expect(runs.live()).toBeUndefined();
  });
});
