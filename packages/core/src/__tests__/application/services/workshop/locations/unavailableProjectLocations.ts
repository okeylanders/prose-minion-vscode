import type { WorkshopLocationsPorts } from '@/application/services/workshop/locations/WorkshopLocationsCapability';

/** Context-path ports for a turn whose test never reads them: no folder is open. */
export const unavailableProjectLocations: WorkshopLocationsPorts = {
  scan: { scan: async () => undefined },
  checker: { check: async () => ({ kind: 'no-workspace' }) }
};
