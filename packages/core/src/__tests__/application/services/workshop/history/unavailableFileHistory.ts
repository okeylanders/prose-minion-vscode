import type { WorkshopHistoryPorts } from '@/application/services/workshop/history/WorkshopHistoryCapability';
import { WorkshopHistoryDiffCache } from '@/application/services/workshop/history/WorkshopHistoryDiffCache';

/** History ports for a turn whose test never reads git: every call answers that no git is available. */
export const unavailableFileHistory: WorkshopHistoryPorts = {
  history: {
    log: async () => ({ kind: 'unavailable', reason: 'no-git' }),
    show: async () => ({ kind: 'unavailable', reason: 'no-git' })
  },
  fileSystem: { readFile: async () => new Uint8Array() },
  excerpt: { excerptFile: async () => ({ kind: 'none' }) },
  diffs: new WorkshopHistoryDiffCache()
};
