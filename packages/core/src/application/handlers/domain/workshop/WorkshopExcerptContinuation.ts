/**
 * Continue with a carried, file-backed passage (epic Everyday Conveniences,
 * item E; PR #260 F-01): one room operation that reads the file FIRST, then
 * chooses the passage path and lands what it read, with nothing awaited in
 * between.
 *
 * The order is the point. Choosing the path makes the room send-ready, so a
 * path chosen before the read would let a message go out on the old passage
 * while the disk was still being read. Here the path stays unchosen for the
 * whole read, and the read runs in the coordinator's session-operation queue
 * (as Refresh changed files and Attach missing do), so every room mutation
 * asked meanwhile is refused in the room's usual busy words.
 */

import type {
  WorkshopScopeTransition
} from '@/application/services/workshop/WorkshopSessionRecords';
import type {
  WorkshopSessionService
} from '@/application/services/workshop/WorkshopSessionService';
import type {
  WorkshopContextIntakeService
} from '@/application/services/workshop/WorkshopContextIntakeService';
import type { WorkshopRoomEffects } from '@handlers/domain/workshop/WorkshopRouteContracts';
import type { LogSink } from '@/platform';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopExcerpt,
  WorkshopExcerptSource,
  WorkshopExcerptTruncation
} from '@messages';

type FileSource = Extract<WorkshopExcerptSource, { kind: 'file' }>;

/** What the carried passage's file held when it was read. */
type CarriedFileRead =
  | { kind: 'refused'; details: string }
  | { kind: 'unchanged'; source: FileSource }
  | {
      kind: 'changed';
      source: FileSource;
      text: string;
      truncation?: WorkshopExcerptTruncation;
      sourceFingerprint: string;
    };

export interface WorkshopExcerptContinuationPort {
  session: Pick<
    WorkshopSessionService,
    'getExcerpt' | 'getShelvedExcerpt' | 'setSessionScope' | 'refreshExcerptFileSource'
  >;
  intake: Pick<WorkshopContextIntakeService, 'authorizeExcerptReread' | 'loadFile'>;
  log: LogSink;
  effects: Pick<
    WorkshopRoomEffects,
    'postSessionState' | 'markDirty' | 'reportError' | 'sendStatus'
  >;
  /** The coordinator's session-operation queue: room mutations are refused while it runs. */
  runRoomOperation: (work: () => Promise<void>) => Promise<void>;
  /** Reports the refusal and returns true while a run or wizard holds the room. */
  rejectWhileRunning: () => boolean;
  /** Words for a refused path change (the scope lock's, or the fallback). */
  scopeErrorMessage: (error: unknown) => string;
  applyScopeTransition: (transition: WorkshopScopeTransition, reason: string) => void;
  /** The handler's one excerpt-replacement path; false when it refused and reported. */
  replaceExcerpt: (input: {
    text: string;
    source: WorkshopExcerptSource;
    truncation?: WorkshopExcerptTruncation;
    sourceFingerprint?: string;
  }) => boolean;
}

const LOG = '[WorkshopExcerptScopeHandler]';

export const WORKSHOP_CONTINUE_REREAD_FAILED_MESSAGE =
  'Continued with the passage as it was: its file could not be re-read.';

const readCarriedFile = async (
  intake: WorkshopExcerptContinuationPort['intake'],
  carried: WorkshopExcerpt,
  source: FileSource
): Promise<CarriedFileRead> => {
  try {
    const authorization = await intake.authorizeExcerptReread(source);
    if (authorization.kind === 'refused') {
      return { kind: 'refused', details: authorization.message };
    }
    const loaded = await intake.loadFile(
      authorization.fsPath,
      authorization.source.relativePath,
      {
        maxBytes: PROMPT_BUDGETS.fileExcerpt.bytes,
        maxWords: PROMPT_BUDGETS.fileExcerpt.words
      },
      'pin'
    );
    if (loaded.kind === 'refused') {
      return { kind: 'refused', details: loaded.refusal.message };
    }
    const { text, sourceFingerprint } = loaded.file;
    const truncation = loaded.file.truncation
      ? {
          pinnedWords: loaded.file.truncation.keptWords,
          totalWords: loaded.file.truncation.totalWords
        }
      : undefined;
    const unchanged = carried.sourceFingerprint !== undefined
      ? sourceFingerprint === carried.sourceFingerprint
      : text === carried.text && truncation?.totalWords === carried.truncation?.totalWords;
    return unchanged
      ? { kind: 'unchanged', source: authorization.source }
      : { kind: 'changed', source: authorization.source, text, truncation, sourceFingerprint };
  } catch (error) {
    return { kind: 'refused', details: error instanceof Error ? error.message : String(error) };
  }
};

/**
 * Read the carried passage's file, then choose the passage path and land the
 * read. A file that cannot be read never stops Continue: the room continues
 * on the passage as it was, and says so once.
 */
export const continueWithCurrentFile = async (
  port: WorkshopExcerptContinuationPort
): Promise<void> => {
  if (port.rejectWhileRunning()) {
    return;
  }
  try {
    await port.runRoomOperation(async () => {
      const carried = port.session.getExcerpt() ?? port.session.getShelvedExcerpt();
      const read = carried && carried.source.kind === 'file'
        ? await readCarriedFile(port.intake, carried, carried.source)
        : undefined;

      // The read awaited. Everything below runs with nothing awaited, so the
      // path and the passage it settles on change together.
      if (port.rejectWhileRunning()) {
        return;
      }
      let transition: WorkshopScopeTransition;
      try {
        transition = port.session.setSessionScope('excerpt');
      } catch (error) {
        port.effects.reportError(port.scopeErrorMessage(error));
        return;
      }
      port.applyScopeTransition(transition, 'session scope set to passage session');

      const adopted = transition.excerpt;
      if (!read || !carried || !adopted) {
        return;
      }
      if (read.kind === 'refused' || adopted.version !== carried.version) {
        port.log.appendLine(`${LOG} Continue: carried file not re-read (v${adopted.version} kept)`);
        port.effects.reportError(
          WORKSHOP_CONTINUE_REREAD_FAILED_MESSAGE,
          read.kind === 'refused' ? read.details : undefined
        );
        return;
      }
      if (read.kind === 'unchanged') {
        if (port.session.refreshExcerptFileSource(adopted.version, read.source)) {
          port.effects.markDirty('file excerpt source reconnected');
          port.effects.postSessionState();
        }
        port.log.appendLine(`${LOG} Continue: carried file unchanged on disk (v${adopted.version} kept)`);
        port.effects.sendStatus(`Excerpt unchanged on disk · ${read.source.relativePath}`);
        return;
      }
      if (!port.replaceExcerpt({
        text: read.text,
        source: read.source,
        truncation: read.truncation,
        sourceFingerprint: read.sourceFingerprint
      })) {
        return;
      }
      port.effects.markDirty('file excerpt reread on continue');
      port.effects.postSessionState();
    });
  } catch (error) {
    port.effects.reportError(
      'Could not continue with that passage.',
      error instanceof Error ? error.message : String(error)
    );
  }
};
