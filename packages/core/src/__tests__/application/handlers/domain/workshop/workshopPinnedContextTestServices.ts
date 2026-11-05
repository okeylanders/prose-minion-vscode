/**
 * Pinned context for route tests that don't exercise it (Pinned Context
 * Slice 3): an empty, available list on posix, no first-room report, and
 * every write a no-op. Tests of the tab pass the real library instead.
 */

import type {
  WorkshopPinnedContextServices
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextPorts';

export function emptyPinnedContextServices(): WorkshopPinnedContextServices {
  const unchanged = async () => ({ kind: 'ok' as const, written: false });
  return {
    library: {
      platform: 'posix',
      describe: async () => ({ state: 'listed', revision: 'absent', rows: [], words: 0, absent: true }),
      readForSeed: async () => ({ state: 'nothing' }),
      pinResources: unchanged,
      pinPaths: unchanged,
      unpin: unchanged,
      move: unchanged,
      openTarget: async () => ({ kind: 'refused', words: 'Nothing to open.', category: 'absent' })
    },
    takeFirstRoomReport: () => undefined
  };
}
