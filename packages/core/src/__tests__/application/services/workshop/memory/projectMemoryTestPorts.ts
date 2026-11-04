/**
 * A project-memory port for tests that do not exercise memory: every
 * question answers that memory is off, as the default mode does, so no
 * frame is sent and every `memory.*` call is refused `memory-off`.
 */

import type { WorkshopProjectMemoryPort } from '@/application/services/workshop/memory/WorkshopProjectMemoryCapability';

export const offProjectMemory: WorkshopProjectMemoryPort = {
  catalog: async () => ({ kind: 'closed', reason: 'off' }),
  search: async () => ({ kind: 'closed', reason: 'off' }),
  read: async () => ({ kind: 'closed', reason: 'off' }),
  frame: async () => ({ kind: 'closed', reason: 'off' }),
  replyMemoryContext: async () => ({ open: false }),
  update: async () => ({ kind: 'closed', reason: 'off' })
};
