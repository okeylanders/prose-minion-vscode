import type { WorkshopHelpReferencePort } from '@/application/services/workshop/help/WorkshopHelpReference';

export const unavailableHelpReference: WorkshopHelpReferencePort = {
  version: 'test',
  load: async () => undefined,
  referenceVersion: () => undefined
};
