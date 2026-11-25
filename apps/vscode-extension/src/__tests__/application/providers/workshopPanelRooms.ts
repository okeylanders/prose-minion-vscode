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
    listRoomCheckpoints: async () => []
  };
}
