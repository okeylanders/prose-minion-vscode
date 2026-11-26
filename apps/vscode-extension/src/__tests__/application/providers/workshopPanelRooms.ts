import type { CoreServices } from '@prose-minion/core';
import type { WorkshopPanelRooms } from '@app/application/providers/WorkshopPanelProvider';

/** The registry seam for adapter-only tests. Domain integration tests provide their own handler implementation. */
export function workshopPanelRooms(): WorkshopPanelRooms {
  return {
    acquire: () => ({ services: {
      workshopSessionPersistenceCoordinator: { openRoomIdentity: () => ({ title: 'Room' }), onRoomReplaced: () => () => {} },
      workshopSessionService: { readRoomRevision: () => 1 }
    } as unknown as CoreServices, ready: Promise.resolve() }),
    release: async () => {},
    listUnsavedRooms: async () => [],
    openUnsavedRoom: async () => { throw new Error('No unsaved room in fixture'); },
    deleteUnsavedRoom: async () => { throw new Error('No unsaved room in fixture'); },
    recoverRollingRoom: async () => { throw new Error('No blocked recovery fixture'); },
    listRoomCheckpoints: async () => []
  };
}
