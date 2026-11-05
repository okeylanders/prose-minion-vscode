/**
 * WorkshopPinnedContextRoomSeed: the room seed port's real seed (ADR
 * 2026-11-04 D2, D3, D5, D6, D9; epic Slice 2b). Built only in
 * `extension.ts` and handed to the persistence coordinator, which calls it
 * at the first room, New session and New session: full reset.
 *
 * - **`prepare` never rejects** (Slice 2a's port contract). It captures the
 *   accepted workspace first, before anything awaits, then reads the pinned
 *   files through the library. Every failure, from the store, the intake
 *   service or anything else, becomes a plan whose report says what was left
 *   out and why. At the first room a rejection would land in the
 *   coordinator's restore `catch` and pause rolling autosave.
 * - **`install`** is synchronous and runs inside the room replacement:
 *   - a plan this seed did not make, or made under another workspace
 *     identity, installs nothing;
 *   - files go in pinned order. A file the room already carries (the shared
 *     match rule, or the aggregate's own duplicate key) is re-read in its
 *     slot through `refreshContextFileAttachments`; any other is added
 *     through `addContextAttachment`. Carried attachments that are not
 *     pinned are left alone;
 *   - every file goes through the aggregate's budget and duplicate guards.
 *     One that doesn't fit is left out and the next is tried; nothing is
 *     truncated to fit (D6). A carried file whose re-read is left out keeps
 *     the body it had, and the report marks it `kept`: nothing is removed
 *     for the writer, and the result line never calls it "not attached".
 * - **Logs** carry counts and categories only.
 */

import type { LogSink } from '@/platform';
import type { WorkshopContextAttachment } from '@/application/services/workshop/WorkshopSessionRecords';
import type {
  WorkshopRoomSeed,
  WorkshopRoomSeedKind,
  WorkshopRoomSeedLeftOut,
  WorkshopRoomSeedPlan,
  WorkshopRoomSeedReport,
  WorkshopRoomSeedTarget
} from '@/application/services/workshop/pinnedContext/WorkshopRoomSeed';
import type {
  WorkshopPinnedContextAsk,
  WorkshopPinnedContextLibrary
} from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextLibrary';
import type { WorkshopPinnedFileRead } from '@/application/services/workshop/pinnedContext/WorkshopPinnedContextFileReader';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopPinnedContextPathPlatform } from '@shared/types/workshopPinnedContext';
import { fileSystemErrorCategory } from '@/infrastructure/storage/fileSystemErrors';

const LOG = '[WorkshopPinnedContext]';

/** The label a report gives the list itself when none of it could be read. */
export const WORKSHOP_PINNED_CONTEXT_LIST_LABEL = 'pinned-context.json';

/** What one plan read, kept beside it; the coordinator only ever holds the opaque plan. */
interface PlanContents {
  readonly ask: WorkshopPinnedContextAsk;
  readonly files: readonly WorkshopPinnedFileRead[];
  /** The list itself could not be read: the report names it, and nothing is attached. */
  readonly listUnreadable: boolean;
}

const NOTHING: WorkshopRoomSeedReport = Object.freeze({
  pinnedCount: 0,
  attachedCount: 0,
  attachedWords: 0,
  leftOut: Object.freeze([])
});

type SeedLibrary = Pick<WorkshopPinnedContextLibrary, 'askSeedWorkspace' | 'readForSeed'>;

export class WorkshopPinnedContextRoomSeed implements WorkshopRoomSeed {
  private readonly plans = new WeakMap<WorkshopRoomSeedPlan, PlanContents>();
  private firstRoom: WorkshopRoomSeedReport | undefined;

  constructor(
    private readonly library: SeedLibrary,
    private readonly outputChannel: LogSink,
    private readonly platform: WorkshopPinnedContextPathPlatform
  ) {}

  async prepare(kind: WorkshopRoomSeedKind): Promise<WorkshopRoomSeedPlan> {
    const plan: WorkshopRoomSeedPlan = Object.freeze({ kind });
    let ask: WorkshopPinnedContextAsk;
    try {
      ask = this.library.askSeedWorkspace();
    } catch (error) {
      this.log(`Seed not prepared: the workspace couldn't be read (${fileSystemErrorCategory(error)})`);
      return plan;
    }
    if (!ask.accepted) {
      return plan;
    }
    try {
      const read = await this.library.readForSeed();
      switch (read.state) {
        case 'nothing':
          return plan;
        case 'list-unreadable':
          this.plans.set(plan, { ask, files: [], listUnreadable: true });
          return plan;
        case 'listed':
          this.plans.set(plan, { ask, files: read.files, listUnreadable: false });
          return plan;
      }
    } catch (error) {
      this.log(`Seed read failed (${fileSystemErrorCategory(error)})`);
      this.plans.set(plan, { ask, files: [], listUnreadable: true });
    }
    return plan;
  }

  install(plan: WorkshopRoomSeedPlan, room: WorkshopRoomSeedTarget): WorkshopRoomSeedReport {
    const contents = this.plans.get(plan);
    this.plans.delete(plan);
    if (!contents) {
      return this.settled(plan.kind, NOTHING);
    }
    if (!contents.ask.still()) {
      this.log(`Seed dropped: the workspace changed before the ${plan.kind} room started`);
      return this.settled(plan.kind, NOTHING);
    }
    if (contents.listUnreadable) {
      this.log(`Seeded ${plan.kind} room (list unreadable; attached=0)`);
      return this.settled(plan.kind, {
        pinnedCount: 0,
        attachedCount: 0,
        attachedWords: 0,
        leftOut: [{ label: WORKSHOP_PINNED_CONTEXT_LIST_LABEL, reason: 'unreadable' }]
      });
    }
    const report = this.installFiles(contents.files, room);
    const count = (reason: WorkshopRoomSeedLeftOut['reason']) =>
      report.leftOut.filter((entry) => !entry.kept && entry.reason === reason).length;
    this.log(
      `Seeded ${plan.kind} room (attached=${report.attachedCount}, missing=${count('missing')}, ` +
      `unreadable=${count('unreadable')}, over-budget=${count('over-budget')}, ` +
      `kept=${report.leftOut.filter((entry) => entry.kept).length})`
    );
    return this.settled(plan.kind, report);
  }

  /**
   * The first room's report, once, for the status ticker: that room starts
   * at activation, with no action result to carry it (Slice 2b). Slice 3's
   * handler posts it when a Workshop webview is first ready.
   */
  takeFirstRoomReport(): WorkshopRoomSeedReport | undefined {
    const report = this.firstRoom;
    this.firstRoom = undefined;
    return report;
  }

  private settled(kind: WorkshopRoomSeedKind, report: WorkshopRoomSeedReport): WorkshopRoomSeedReport {
    if (kind === 'first') {
      this.firstRoom = report.pinnedCount > 0 || report.leftOut.length > 0 ? report : undefined;
    }
    return report;
  }

  private installFiles(files: readonly WorkshopPinnedFileRead[], room: WorkshopRoomSeedTarget): WorkshopRoomSeedReport {
    const leftOut: WorkshopRoomSeedLeftOut[] = [];
    let attachedCount = 0;
    let attachedWords = 0;
    for (const file of files) {
      const carried = this.carried(file, room.getContextAttachments());
      // A carried file whose re-read is left out stays in the room as it was.
      const keptMark = carried ? { kept: true as const } : {};
      if (file.state !== 'ready') {
        leftOut.push({ label: file.label, reason: file.state, ...keptMark });
        continue;
      }
      const placed = carried ? this.reread(file, carried, room) : this.attach(file, room);
      if (placed === undefined) {
        leftOut.push({ label: file.label, reason: 'over-budget', ...keptMark });
        continue;
      }
      attachedCount += 1;
      attachedWords += placed;
    }
    return { pinnedCount: files.length, attachedCount, attachedWords, leftOut };
  }

  /** The room's attachment this pinned file already is, by the shared rule or the aggregate's duplicate key. */
  private carried(
    file: WorkshopPinnedFileRead,
    attachments: readonly WorkshopContextAttachment[]
  ): WorkshopContextAttachment | undefined {
    const input = file.state === 'ready' ? file.input : undefined;
    return attachments.find((attachment) =>
      attachment.kind === 'file' && (
        workshopPinnedContextMatches(file.entry, attachment, this.platform) ||
        (input?.sourceUri !== undefined && attachment.sourceUri === input.sourceUri) ||
        (input?.configuredResource !== undefined &&
          attachment.configuredResource?.group === input.configuredResource.group &&
          attachment.configuredResource?.path === input.configuredResource.path)
      ));
  }

  /** Re-read in its slot; the words it holds now, or undefined when the new body doesn't fit. */
  private reread(
    file: Extract<WorkshopPinnedFileRead, { state: 'ready' }>,
    carried: WorkshopContextAttachment,
    room: WorkshopRoomSeedTarget
  ): number | undefined {
    const used = room.getContextAttachments().reduce((total, attachment) => total + attachment.words, 0);
    if (file.input.words > PROMPT_BUDGETS.contextAttachments.words - (used - carried.words)) {
      return undefined;
    }
    const refreshed = room.refreshContextFileAttachments([{
      id: carried.id,
      content: file.input.content,
      words: file.input.words,
      truncation: file.input.truncation,
      sourceUri: file.input.sourceUri ?? carried.sourceUri ?? '',
      relativePath: file.input.relativePath ?? file.entry.path,
      configuredResource: file.input.configuredResource
    }]);
    return refreshed.ok ? file.input.words : undefined;
  }

  /** Add through the aggregate's guards; the words it holds, or undefined over budget. */
  private attach(file: Extract<WorkshopPinnedFileRead, { state: 'ready' }>, room: WorkshopRoomSeedTarget): number | undefined {
    const added = room.addContextAttachment(file.input);
    if (added.ok) {
      return added.attachment.words;
    }
    if (added.reason === 'duplicate') {
      // Already in the room under the aggregate's own key: it holds the file.
      const existing = this.carried(file, room.getContextAttachments());
      return existing?.words ?? 0;
    }
    return undefined;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(`${LOG} ${line}`);
  }
}
