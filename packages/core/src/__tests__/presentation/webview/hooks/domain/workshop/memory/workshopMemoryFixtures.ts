/**
 * Made-up memories (Alice) and estimates for the Memory tab and manager
 * tests: the design canvas's examples, as the host would hand them in.
 */

import type {
  WorkshopMemoryEntry,
  WorkshopMemoryFrameEstimate,
  WorkshopMemoryLibrary
} from '@hooks/domain/workshop/memory/workshopMemoryViewInputs';

let next = 0;

export function memoryEntry(overrides: Partial<WorkshopMemoryEntry> = {}): WorkshopMemoryEntry {
  next += 1;
  const hex = next.toString(16).padStart(6, '0');
  return {
    entryKey: `key-${hex}`,
    id: `mem-${hex}`,
    title: `Memory ${next}`,
    kind: 'canon',
    summary: 'A line of summary.',
    status: 'active',
    pinned: false,
    created: '2026-10-20T10:00:00Z',
    updated: '2026-10-20T10:00:00Z',
    origin: 'writer',
    source: { kind: 'none' },
    superseded: false,
    supersededBy: [],
    busy: false,
    fullLoad: null,
    ...overrides
  };
}

/** The canvas's in-budget figures: 12 memories, 2 in full, all 10 fit. */
export const IN_BUDGET: WorkshopMemoryFrameEstimate = {
  memories: 12,
  pinned: 2,
  pinnedLoaded: 2,
  pinnedTokens: 1_104,
  pinnedOver: false,
  catalogTokens: 698,
  frameTokens: 1_812,
  pinnedLoadedTokens: 1_104,
  catalogEntries: 10
};

/** The list over its budget: 100 memories, 3 in full, 75 of 97 fit. */
export const LIST_OVER: WorkshopMemoryFrameEstimate = {
  memories: 100,
  pinned: 3,
  pinnedLoaded: 3,
  pinnedTokens: 2_390,
  pinnedOver: false,
  catalogTokens: 5_996,
  frameTokens: 8_410,
  pinnedLoadedTokens: 2_390,
  catalogEntries: 75
};

/** Set to load in full past 5,000: 4 set, 3 loaded, about 5,600 requested. */
export const FULL_OVER: WorkshopMemoryFrameEstimate = {
  memories: 12,
  pinned: 4,
  pinnedLoaded: 3,
  pinnedTokens: 5_570,
  pinnedOver: true,
  catalogTokens: 798,
  frameTokens: 5_230,
  pinnedLoadedTokens: 4_410,
  catalogEntries: 9
};

/** The manager's canvas: six active, one superseded, one archived, three files that need attention. */
export function managerLibrary(over = false): WorkshopMemoryLibrary {
  const watch = memoryEntry({
    entryKey: 'key-watch',
    id: 'mem-7f3c21',
    title: 'The Rabbit’s watch runs backward',
    kind: 'canon',
    origin: 'proposed',
    proposedByLabel: 'Jill',
    source: { kind: 'session', title: 'Tea-party pacing' },
    updated: '2026-11-03T12:00:00Z',
    summary: 'From chapter 3 on, the White Rabbit’s watch runs backward.'
  });
  return {
    memories: [
      memoryEntry({ entryKey: 'key-structure', id: 'mem-1a0001', title: 'Critique structure before line edits', kind: 'preference', pinned: true, fullLoad: 'loaded', updated: '2026-10-28T09:00:00Z' }),
      memoryEntry({ entryKey: 'key-kitchen', id: 'mem-1a0002', title: 'Keep the Duchess’s kitchen offstage', kind: 'decision', pinned: true, fullLoad: 'loaded', origin: 'proposed', proposedByLabel: 'Cliff', source: { kind: 'session', title: 'Chapter 6 pass' }, updated: '2026-11-02T09:00:00Z' }),
      memoryEntry({ entryKey: 'key-song', id: 'mem-1a0003', title: 'We cut the Mock Turtle’s second song', kind: 'decision', pinned: true, fullLoad: 'loaded', updated: '2026-11-01T09:00:00Z' }),
      watch,
      memoryEntry({
        entryKey: 'key-cat',
        id: 'mem-1a0005',
        title: 'The Cheshire Cat is never seen arriving',
        kind: 'canon',
        pinned: true,
        // Created last, and the frame builder loaded it last: whether it fits is its result alone.
        fullLoad: over ? 'doesnt-fit' : 'loaded',
        residency: over ? 'listed' : 'full',
        origin: 'auto',
        proposedByLabel: 'Jill',
        source: { kind: 'unnamed' },
        updated: '2026-11-03T08:00:00Z'
      }),
      memoryEntry({ entryKey: 'key-tarts', id: 'mem-1a0006', title: 'Does the Queen know the tarts were moved?', kind: 'open-thread', updated: '2026-10-30T09:00:00Z' }),
      memoryEntry({ entryKey: 'key-stops', id: 'mem-1a0007', title: 'The Rabbit’s watch stops at six', kind: 'canon', superseded: true, supersededBy: ['mem-7f3c21'], updated: '2026-10-22T09:00:00Z' }),
      memoryEntry({ entryKey: 'key-tense', id: 'mem-1a0008', title: 'Alice narrates in present tense', kind: 'decision', status: 'archived', origin: 'auto', proposedByLabel: 'Cliff', updated: '2026-10-19T09:00:00Z' })
    ],
    unreadable: [{ entryKey: 'key-seating', fileName: 'tea-party-seating-1a9e04.md', reason: 'invalid-value', key: 'kind' }],
    conflicts: [{
      id: 'mem-7f3c2a',
      files: [
        { entryKey: 'key-copy-a', fileName: 'rabbit-watch-runs-backward-7f3c2a.md' },
        { entryKey: 'key-copy-b', fileName: 'rabbit-watch-copy-7f3c2a.md' }
      ]
    }]
  };
}
