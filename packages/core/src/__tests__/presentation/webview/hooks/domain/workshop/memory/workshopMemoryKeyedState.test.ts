/**
 * The memory hook's keyed feedback as pure updates: a key added or removed,
 * an entry set or removed, and an update that changes nothing returning the
 * collection it was given.
 */

import { withWorkshopMemoryEntry, withWorkshopMemoryKey } from '@hooks/domain/workshop/memory/workshopMemoryKeyedState';

describe('withWorkshopMemoryKey', () => {
  it('adds and removes a key, never changing the set it was given', () => {
    const empty: ReadonlySet<string> = new Set();
    const busy = withWorkshopMemoryKey(empty, 'turn-4#0', true);
    expect([...busy]).toEqual(['turn-4#0']);
    expect(empty.size).toBe(0);
    expect([...withWorkshopMemoryKey(busy, 'turn-4#0', false)]).toEqual([]);
    expect(busy.has('turn-4#0')).toBe(true);
  });

  it('returns the same set when nothing changes', () => {
    const busy: ReadonlySet<string> = new Set(['turn-4#0']);
    expect(withWorkshopMemoryKey(busy, 'turn-4#0', true)).toBe(busy);
    expect(withWorkshopMemoryKey(busy, 'turn-9#1', false)).toBe(busy);
  });
});

describe('withWorkshopMemoryEntry', () => {
  it('sets and removes an entry, never changing the map it was given', () => {
    const empty: ReadonlyMap<string, string> = new Map();
    const refused = withWorkshopMemoryEntry(empty, 'turn-4#0', 'No folder.');
    expect([...refused]).toEqual([['turn-4#0', 'No folder.']]);
    expect(empty.size).toBe(0);
    expect([...withWorkshopMemoryEntry(refused, 'turn-4#0', 'Busy.')]).toEqual([['turn-4#0', 'Busy.']]);
    expect([...withWorkshopMemoryEntry(refused, 'turn-4#0', undefined)]).toEqual([]);
  });

  it('returns the same map when nothing changes', () => {
    const error = { action: 'forget' as const, error: 'No folder.' };
    const refused: ReadonlyMap<string, typeof error> = new Map([['receipt-1', error]]);
    expect(withWorkshopMemoryEntry(refused, 'receipt-1', error)).toBe(refused);
    expect(withWorkshopMemoryEntry(refused, 'receipt-2', undefined)).toBe(refused);
  });
});
