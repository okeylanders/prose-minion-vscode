/**
 * A Conversation settings apply that failed after it wrote the global
 * project-memory mode, and could not write it back (PR #202 F03). The mode
 * the writer chose stands; every other setting is as it was. The handler
 * says so, rather than that the previous settings are all still active.
 */
import type { WorkshopProjectMemoryMode } from '@messages';

export class WorkshopConversationSettingsPartialApplyError extends Error {
  constructor(
    /** The mode the global setting holds now. */
    readonly projectMemory: WorkshopProjectMemoryMode,
    readonly cause: unknown,
    readonly rollbackError: string
  ) {
    super(`${cause instanceof Error ? cause.message : String(cause)}; the project memory mode could not be set back: ${rollbackError}`);
    this.name = 'WorkshopConversationSettingsPartialApplyError';
  }
}
