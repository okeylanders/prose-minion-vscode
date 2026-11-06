/**
 * The global modes Conversation settings' apply writes: the project-memory
 * mode (ADR 2026-11-04 D8; PR #202 F03) and suggested file edits (ADR
 * 2026-11-05 D11, its row added in Slice 4c). An apply writes each mode
 * first, so the prompt rebuild sees it; when the apply fails, it undoes its
 * own writes and only those: nothing for a mode it wrote none of, and
 * nothing for a mode that no longer holds what it wrote (a newer choice in
 * VS Code Settings stands, and the settings watcher's sync reconciles the
 * prompts with it). A write back VS Code refuses raises
 * `WorkshopConversationSettingsPartialApplyError`.
 */
import type { LogSink, SettingsStore } from '@/platform';
import {
  coerceWorkshopFileEditsMode,
  coerceWorkshopProjectMemoryMode,
  WORKSHOP_FILE_EDITS_SETTING,
  WORKSHOP_PROJECT_MEMORY_SETTING,
  type WorkshopFileEditsMode,
  type WorkshopProjectMemoryMode
} from '@messages';

/** What an apply did to a mode: wrote `wrote` over `over`, or failed with `error`; empty when it wrote nothing. */
export interface WorkshopGlobalModeWrite<Mode extends string> {
  readonly wrote?: Mode;
  readonly over?: Mode;
  readonly error?: string;
}

/** The modes an apply could not set back, each as its setting holds it now. */
export interface WorkshopGlobalModesLeft {
  readonly projectMemory?: WorkshopProjectMemoryMode;
  readonly fileEdits?: WorkshopFileEditsMode;
}

/**
 * An apply that failed after it wrote a mode, and could not write it back.
 * The modes it names stand as the writer chose them; every other setting is
 * as it was. The handler says so, rather than that the previous settings are
 * all active.
 */
export class WorkshopConversationSettingsPartialApplyError extends Error {
  /** The project-memory mode the global setting holds now, when it could not be set back. */
  readonly projectMemory?: WorkshopProjectMemoryMode;
  /** The file-edits mode the global setting holds now, when it could not be set back. */
  readonly fileEdits?: WorkshopFileEditsMode;

  constructor(
    left: WorkshopGlobalModesLeft,
    readonly cause: unknown,
    readonly rollbackError: string
  ) {
    super(`${messageOf(cause)}; ${leftNames(left)} could not be set back: ${rollbackError}`);
    this.name = 'WorkshopConversationSettingsPartialApplyError';
    if (left.projectMemory !== undefined) {
      this.projectMemory = left.projectMemory;
    }
    if (left.fileEdits !== undefined) {
      this.fileEdits = left.fileEdits;
    }
  }
}

const PROJECT_MEMORY_MODE_WORDS: Record<WorkshopProjectMemoryMode, string> = { off: 'Off', ask: 'Ask first', auto: 'Save and tell me' };
const FILE_EDITS_MODE_WORDS: Record<WorkshopFileEditsMode, string> = { off: 'Off', ask: 'Ask first' };

/** The writer's words for an apply that left a mode it could not set back. */
export function workshopConversationSettingsPartialApplyWords(error: WorkshopConversationSettingsPartialApplyError): string {
  const left = [
    error.projectMemory !== undefined ? `Project memory is now ${PROJECT_MEMORY_MODE_WORDS[error.projectMemory]}` : undefined,
    error.fileEdits !== undefined ? `Suggested file edits are now ${FILE_EDITS_MODE_WORDS[error.fileEdits]}` : undefined
  ].filter((each): each is string => each !== undefined);
  const said = left.length === 2 ? `${left[0]} and ${left[1].charAt(0).toLowerCase()}${left[1].slice(1)}` : left[0];
  return `Could not change conversation settings. ${said}: ${left.length === 2 ? 'they' : 'it'} couldn't be set back. ` +
    'Your other previous settings are still active.';
}

interface WorkshopGlobalModeSpec<Mode extends string> {
  readonly setting: { readonly section: string; readonly key: string };
  readonly coerce: (raw: unknown) => Mode;
  /** Its name in the log ("Project memory mode"). */
  readonly label: string;
}

/** One global mode setting: read live, written by an apply, and that write undone when the apply fails. */
export class WorkshopGlobalModeSetting<Mode extends string> {
  constructor(
    private readonly settings: SettingsStore,
    private readonly outputChannel: LogSink,
    private readonly spec: WorkshopGlobalModeSpec<Mode>
  ) {}

  /** The mode as the setting holds it now, through the mode's own coercion. */
  get(): Mode {
    return this.spec.coerce(this.settings.get<unknown>(this.spec.setting.section, this.spec.setting.key));
  }

  /** Write `next` when it differs; say what was written over what, or why it wasn't. */
  async write(next: Mode | undefined): Promise<WorkshopGlobalModeWrite<Mode>> {
    const over = this.get();
    if (next === undefined || next === over) {
      return {};
    }
    try {
      await this.settings.update(this.spec.setting.section, this.spec.setting.key, next);
      this.outputChannel.appendLine(`[WorkshopConversationSettingsService] ${this.spec.label} set to ${next}`);
      return { wrote: next, over };
    } catch (error) {
      return { error: messageOf(error) };
    }
  }

  /**
   * Undo `write` while the setting still holds what it wrote. Answers why a
   * write back failed, or nothing when it succeeded or there was nothing to undo.
   */
  async rollback(write: WorkshopGlobalModeWrite<Mode>): Promise<string | undefined> {
    if (write.wrote === undefined || write.over === undefined) {
      return undefined;
    }
    if (this.get() !== write.wrote) {
      this.outputChannel.appendLine(`[WorkshopConversationSettingsService] ${this.spec.label} changed since the apply wrote it; the newer choice stands`);
      return undefined;
    }
    return (await this.write(write.over)).error;
  }
}

export function workshopProjectMemoryModeSetting(settings: SettingsStore, outputChannel: LogSink): WorkshopGlobalModeSetting<WorkshopProjectMemoryMode> {
  return new WorkshopGlobalModeSetting(settings, outputChannel, {
    setting: WORKSHOP_PROJECT_MEMORY_SETTING,
    coerce: coerceWorkshopProjectMemoryMode,
    label: 'Project memory mode'
  });
}

/** Unset reads `ask`, anything unknown `off` (D11). */
export function workshopFileEditsModeSetting(settings: SettingsStore, outputChannel: LogSink): WorkshopGlobalModeSetting<WorkshopFileEditsMode> {
  return new WorkshopGlobalModeSetting(settings, outputChannel, {
    setting: WORKSHOP_FILE_EDITS_SETTING,
    coerce: coerceWorkshopFileEditsMode,
    label: 'File edits mode'
  });
}

/** The writes an apply made to the global modes, undone together when it fails. */
export interface WorkshopGlobalModeWrites {
  readonly projectMemory: WorkshopGlobalModeWrite<WorkshopProjectMemoryMode>;
  readonly fileEdits: WorkshopGlobalModeWrite<WorkshopFileEditsMode>;
}

/** A global mode VS Code refused to change: why, and the mode still in effect. */
export interface WorkshopGlobalModeRefusal<Mode extends string> {
  readonly error: string;
  readonly effective: Mode;
}

export interface WorkshopGlobalModeRefusals {
  readonly projectMemory?: WorkshopGlobalModeRefusal<WorkshopProjectMemoryMode>;
  readonly fileEdits?: WorkshopGlobalModeRefusal<WorkshopFileEditsMode>;
}

type WorkshopGlobalModes = {
  readonly projectMemory: WorkshopGlobalModeSetting<WorkshopProjectMemoryMode>;
  readonly fileEdits: WorkshopGlobalModeSetting<WorkshopFileEditsMode>;
};

/**
 * The mode writes VS Code refused, each with the mode still in effect (PR #236 F-01). A refused mode never took
 * effect, so it is never reported as a setting active for this session; `{}` when none was refused.
 */
export function workshopGlobalModeRefusals(modes: WorkshopGlobalModes, writes: WorkshopGlobalModeWrites): { modeRefusals?: WorkshopGlobalModeRefusals } {
  const refusals: WorkshopGlobalModeRefusals = {
    ...(writes.projectMemory.error ? { projectMemory: { error: writes.projectMemory.error, effective: modes.projectMemory.get() } } : {}),
    ...(writes.fileEdits.error ? { fileEdits: { error: writes.fileEdits.error, effective: modes.fileEdits.get() } } : {})
  };
  return Object.keys(refusals).length > 0 ? { modeRefusals: refusals } : {};
}

/**
 * The writer's words for refused mode changes: which modes could not be changed, and what each still is. `alsoApplied`
 * adds that the rest of the submission did take effect, so a mixed apply is reported truthfully.
 */
export function workshopGlobalModeRefusalWords(refusals: WorkshopGlobalModeRefusals, alsoApplied: boolean): string {
  return [
    refusals.projectMemory
      ? `VS Code could not change project memory, so it is still ${PROJECT_MEMORY_MODE_WORDS[refusals.projectMemory.effective]}.`
      : undefined,
    refusals.fileEdits
      ? `VS Code could not change suggested file edits, so they are still ${FILE_EDITS_MODE_WORDS[refusals.fileEdits.effective]}.`
      : undefined,
    alsoApplied ? 'Your other conversation settings were applied.' : undefined
  ].filter((each): each is string => each !== undefined).join(' ');
}

/** What an apply reports beyond success: settings saved for this session only, and modes VS Code refused. */
export interface WorkshopConversationSettingsApplyOutcome {
  readonly changed: boolean;
  readonly persistenceErrors?: { readonly behavior?: string; readonly writerProfile?: string; readonly webResearch?: string };
  readonly modeRefusals?: WorkshopGlobalModeRefusals;
}

/**
 * The room's one report of an apply that did not fully land (PR #236 F-01), or nothing when it did. A setting active
 * for this session but not saved for restart says so; a refused mode says it did not change and what it still is. A
 * mixed apply says both, and never calls a refused mode active.
 */
export function workshopConversationSettingsApplyReport(
  outcome: WorkshopConversationSettingsApplyOutcome
): { readonly message: string; readonly details: string; readonly logLine: string } | undefined {
  const unsaved = outcome.persistenceErrors && Object.keys(outcome.persistenceErrors).length > 0 ? outcome.persistenceErrors : undefined;
  const refused = outcome.modeRefusals;
  if (!unsaved && !refused) {
    return undefined;
  }
  const unsavedDetails = [
    unsaved?.behavior ? `behavior: ${unsaved.behavior}` : undefined,
    unsaved?.writerProfile ? `writer profile: ${unsaved.writerProfile}` : undefined,
    unsaved?.webResearch ? `web research: ${unsaved.webResearch}` : undefined
  ].filter((each): each is string => each !== undefined).join('; ');
  const refusedDetails = [
    refused?.projectMemory ? `project memory: ${refused.projectMemory.error}` : undefined,
    refused?.fileEdits ? `file edits: ${refused.fileEdits.error}` : undefined
  ].filter((each): each is string => each !== undefined).join('; ');
  const message = [
    refused ? workshopGlobalModeRefusalWords(refused, outcome.changed && !unsaved) : undefined,
    unsaved
      ? `${refused ? 'Your other conversation settings' : 'Conversation settings'} changed for this session, but VS Code could not save them for restart.`
      : undefined
  ].filter((each): each is string => each !== undefined).join(' ');
  const logLine = [
    unsaved ? `Conversation settings are active but could not be persisted: ${unsavedDetails}` : undefined,
    refused ? `Global modes not changed, VS Code refused: ${refusedDetails}` : undefined
  ].filter((each): each is string => each !== undefined).join('; ');
  return { message, details: [unsavedDetails, refusedDetails].filter((each) => each.length > 0).join('; '), logLine };
}

/**
 * Undo an apply's own mode writes, the last written first, then rethrow
 * `error`; or raise the partial-apply error naming each mode that could not
 * be set back, as it stands now.
 */
export async function undoWorkshopGlobalModeWrites(
  modes: WorkshopGlobalModes,
  writes: WorkshopGlobalModeWrites,
  error: unknown
): Promise<never> {
  const fileEditsFailure = await modes.fileEdits.rollback(writes.fileEdits);
  const projectMemoryFailure = await modes.projectMemory.rollback(writes.projectMemory);
  if (fileEditsFailure !== undefined || projectMemoryFailure !== undefined) {
    throw new WorkshopConversationSettingsPartialApplyError(
      {
        ...(projectMemoryFailure !== undefined ? { projectMemory: modes.projectMemory.get() } : {}),
        ...(fileEditsFailure !== undefined ? { fileEdits: modes.fileEdits.get() } : {})
      },
      error,
      [projectMemoryFailure, fileEditsFailure].filter((each): each is string => each !== undefined).join('; ')
    );
  }
  throw error;
}

function leftNames(left: WorkshopGlobalModesLeft): string {
  return [left.projectMemory !== undefined ? 'the project memory mode' : undefined, left.fileEdits !== undefined ? 'the file edits mode' : undefined]
    .filter((each): each is string => each !== undefined)
    .join(' and ');
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
