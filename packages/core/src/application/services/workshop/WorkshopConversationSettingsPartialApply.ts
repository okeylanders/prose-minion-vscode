/**
 * The global project-memory mode as Conversation settings' apply writes it
 * (ADR 2026-11-04 D8; PR #202 F03). An apply writes the mode first, so the
 * prompt rebuild sees it; when the apply fails, it undoes its own write and
 * only that: nothing when it wrote none, and nothing when the setting no
 * longer holds what it wrote (a newer choice in VS Code Settings stands, and
 * the settings watcher's sync reconciles the prompts with it). A write back
 * VS Code refuses raises `WorkshopConversationSettingsPartialApplyError`.
 */
import type { LogSink, SettingsStore } from '@/platform';
import {
  coerceWorkshopProjectMemoryMode,
  WORKSHOP_PROJECT_MEMORY_SETTING,
  type WorkshopProjectMemoryMode
} from '@messages';

/** What an apply did to the mode: wrote `wrote` over `over`, or failed with `error`; empty when it wrote nothing. */
export interface WorkshopProjectMemoryModeWrite {
  readonly wrote?: WorkshopProjectMemoryMode;
  readonly over?: WorkshopProjectMemoryMode;
  readonly error?: string;
}

/**
 * An apply that failed after it wrote the mode, and could not write it back.
 * The mode the writer chose stands; every other setting is as it was. The
 * handler says so, rather than that the previous settings are all active.
 */
export class WorkshopConversationSettingsPartialApplyError extends Error {
  constructor(
    /** The mode the global setting holds now. */
    readonly projectMemory: WorkshopProjectMemoryMode,
    readonly cause: unknown,
    readonly rollbackError: string
  ) {
    super(`${messageOf(cause)}; the project memory mode could not be set back: ${rollbackError}`);
    this.name = 'WorkshopConversationSettingsPartialApplyError';
  }
}

export class WorkshopProjectMemoryModeSetting {
  constructor(
    private readonly settings: SettingsStore,
    private readonly outputChannel: LogSink
  ) {}

  /** The mode as the setting holds it now; an unknown value reads as Off. */
  get(): WorkshopProjectMemoryMode {
    return coerceWorkshopProjectMemoryMode(
      this.settings.get<unknown>(WORKSHOP_PROJECT_MEMORY_SETTING.section, WORKSHOP_PROJECT_MEMORY_SETTING.key)
    );
  }

  /** Write `next` when it differs; say what was written over what, or why it wasn't. */
  async write(next: WorkshopProjectMemoryMode | undefined): Promise<WorkshopProjectMemoryModeWrite> {
    const over = this.get();
    if (next === undefined || next === over) {
      return {};
    }
    try {
      await this.settings.update(WORKSHOP_PROJECT_MEMORY_SETTING.section, WORKSHOP_PROJECT_MEMORY_SETTING.key, next);
      this.outputChannel.appendLine(`[WorkshopConversationSettingsService] Project memory mode set to ${next}`);
      return { wrote: next, over };
    } catch (error) {
      return { error: messageOf(error) };
    }
  }

  /** Undo `write` while the setting still holds what it wrote, then rethrow `error`. */
  async undo(write: WorkshopProjectMemoryModeWrite, error: unknown): Promise<never> {
    if (write.wrote !== undefined && write.over !== undefined) {
      if (this.get() !== write.wrote) {
        this.outputChannel.appendLine('[WorkshopConversationSettingsService] Project memory mode changed since the apply wrote it; the newer choice stands');
      } else {
        const rollback = await this.write(write.over);
        if (rollback.error) {
          throw new WorkshopConversationSettingsPartialApplyError(this.get(), error, rollback.error);
        }
      }
    }
    throw error;
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
