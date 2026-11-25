/**
 * A file's git history for one persona turn (ADR 2026-11-19 D11–D15): turns
 * one validated `history.*` request into a capability result. Read-only.
 *
 * - **Which file:** the excerpt's file or a configured file
 *   (`WorkshopHistoryFiles`), never a free path.
 * - **The host** is asked through the `FileHistory` port only: `log` with a
 *   count, and `show` with a full hash its own log returned. A commit id a
 *   persona wrote is checked against the file's log before `show` is called
 *   (`WorkshopHistoryCommits`); no model text reaches git.
 * - **The diff is core's** (`WorkshopHistoryDiff`), from two `show`s or a
 *   `show` and the saved file, read through the `FileSystem` port; no host
 *   diff driver or external tool runs. Each side is bounded by
 *   `diffSourceBytes`.
 * - **Fitted** to half the room left in the context window by whole changes
 *   (`reads/WorkshopReadWindowFit`); with no window, by `diffBytes`. One
 *   change that does not fit alone is refused, with the room it had.
 * - **A diff adds a manifest row** of kind `history`; a log adds none.
 * - **No repository, no git, git disabled, not ready, not tracked:** each is
 *   said in host words, never an error of the call's form.
 * - Logs carry the operation, counts and closed outcome words: never a
 *   commit id, a subject, an author, a path or diff text (G3).
 */

import type { FileHistory, FileSystem, LogSink } from '@/platform';
import type { WorkshopPersonaId } from '@messages';
import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { ConfiguredResourceGroupFiles } from '@/application/services/ConfiguredResourceLookup';
import type { CapabilityContextWindow, CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopCapabilityResult, WorkshopHistoryRequest } from '@shared/types/workshopCapabilities';
import { configuredResourceFingerprint } from '@/application/services/workshop/WorkshopConfiguredResourceLookup';
import {
  fitWorkshopReadToWindow,
  workshopReadEvidenceTokens,
  type WorkshopMeasuredRead
} from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import {
  resolveWorkshopHistoryFile,
  workshopHistoryFileFaultLine,
  type WorkshopHistoryExcerptPort,
  type WorkshopHistoryResolvedFile
} from '@/application/services/workshop/history/WorkshopHistoryFiles';
import { findWorkshopHistoryCommit } from '@/application/services/workshop/history/WorkshopHistoryCommits';
import type { WorkshopHistoryDiffCache } from '@/application/services/workshop/history/WorkshopHistoryDiffCache';
import {
  renderWorkshopHistoryDiff,
  renderWorkshopHistoryLog,
  workshopHistoryShownId,
  type WorkshopHistoryDiffInput
} from '@/application/services/workshop/history/WorkshopHistoryRenderer';
import {
  workshopHistoryBody,
  workshopHistoryRequestSummary,
  workshopHistoryUnavailableLine
} from '@/application/services/workshop/history/WorkshopHistoryCopy';
import { readWorkshopHistorySides } from '@/application/services/workshop/history/WorkshopHistorySides';
import { workshopHistoryDiffRefusal, type WorkshopHistoryDiffRefusal } from '@/application/services/workshop/history/WorkshopHistoryRefusals';

/** What the family reads through: the host's history, the saved file, and the room's excerpt. Built in `extension.ts`. */
export interface WorkshopHistoryPorts {
  readonly history: FileHistory;
  readonly fileSystem: Pick<FileSystem, 'readFile' | 'stat'>;
  readonly excerpt: WorkshopHistoryExcerptPort;
  /** Computed change lists, per window, so a continuation never aligns again (D13a). */
  readonly diffs: WorkshopHistoryDiffCache;
}

export interface WorkshopHistoryTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

type Request<C extends WorkshopHistoryRequest['capability']> = Extract<WorkshopHistoryRequest, { capability: C }>;

/** How long a host waits for its git to start before a call answers `not-ready` (D12). */
export const WORKSHOP_HISTORY_GIT_READY_MS: number = PROMPT_BUDGETS.workshopHistory.gitReadyMs;

/** The saved text's mark a `current` continuation carries: the first 12 hex of its SHA-256 (D13). */
export function workshopHistoryCurrentMark(text: string): string {
  return configuredResourceFingerprint(text).slice(0, 12);
}

export class WorkshopHistoryCapability {
  private readonly sources = new WeakMap<WorkshopCapabilityResult, readonly CapabilityDeliveredSource[]>();

  constructor(
    private readonly ports: WorkshopHistoryPorts,
    private readonly resources: () => Promise<readonly ContextResourceSummary[]>,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopHistoryTurnContext,
    /** The authoritative listing a pair's file is named from (ADR 2026-11-20 S50). */
    private readonly groupFiles: ConfiguredResourceGroupFiles
  ) {}

  /** A diff's manifest row (D15); a log, or anything that failed, has none. */
  deliveredSources(result: WorkshopCapabilityResult): readonly CapabilityDeliveredSource[] {
    return this.sources.get(result) ?? [];
  }

  async fulfill(request: WorkshopHistoryRequest, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    this.throwIfAborted();
    const file = await resolveWorkshopHistoryFile(request.file, this.ports.excerpt, this.resources, this.groupFiles);
    this.throwIfAborted();
    if (file.kind === 'fault') {
      this.log(`${request.capability} failed reason=${file.fault} file=${request.file.kind}`);
      return this.failed(request, workshopHistoryFileFaultLine(file.fault), { outcome: 'file-fault', fault: file.fault });
    }
    switch (request.capability) {
      case 'history.log':
        return this.historyLog(request, file);
      case 'history.diff':
        return this.historyDiff(request, file, window);
      default:
        return assertNever(request);
    }
  }

  private async historyLog(request: Request<'history.log'>, file: WorkshopHistoryResolvedFile): Promise<WorkshopCapabilityResult> {
    const budgets = PROMPT_BUDGETS.workshopHistory;
    const page = request.page ?? 1;
    const limit = Math.min(page * budgets.logPageCommits + 1, budgets.logScanCommits);
    const log = await this.ports.history.log(file.fsPath, limit);
    this.throwIfAborted();
    if (log.kind === 'unavailable' || log.commits.length === 0) {
      return this.unavailable(request, log.kind === 'unavailable' ? log.reason : 'not-tracked');
    }
    const commits = log.commits.slice(0, limit);
    const scanLimited = limit === budgets.logScanCommits && commits.length >= limit;
    const rendered = renderWorkshopHistoryLog({ file: file.callFile, label: file.label, page, commits, scanLimited });
    this.log(`log page=${page} shown=${rendered.shown} more=${rendered.hint !== undefined} scanLimited=${scanLimited} pastEnd=${rendered.pastEnd}`);
    return {
      capability: request.capability,
      status: 'success',
      requestSummary: workshopHistoryRequestSummary(request),
      content: rendered.content,
      metadata: {
        outcome: 'log',
        page,
        commitsShown: rendered.shown,
        scanLimited,
        // More is one call away exactly when a later page exists.
        truncated: rendered.hint !== undefined,
        characters: rendered.content.length
      }
    };
  }

  private async historyDiff(
    request: Request<'history.diff'>,
    file: WorkshopHistoryResolvedFile,
    window: CapabilityContextWindow | undefined
  ): Promise<WorkshopCapabilityResult> {
    const log = await this.ports.history.log(file.fsPath, PROMPT_BUDGETS.workshopHistory.logScanCommits);
    this.throwIfAborted();
    if (log.kind === 'unavailable' || log.commits.length === 0) {
      return this.unavailable(request, log.kind === 'unavailable' ? log.reason : 'not-tracked');
    }
    // Membership before anything reaches git: only full hashes from this log are ever shown (D14).
    const from = findWorkshopHistoryCommit(log.commits, request.from);
    const to = request.to.kind === 'commit' ? findWorkshopHistoryCommit(log.commits, request.to.commit) : undefined;
    if (from.kind !== 'found') {
      return this.refused(request, from.kind === 'ambiguous' ? 'ambiguous-commit' : 'commit-not-in-history', 'from');
    }
    if (to && to.kind !== 'found') {
      return this.refused(request, to.kind === 'ambiguous' ? 'ambiguous-commit' : 'commit-not-in-history', 'to');
    }
    if (to && to.index === from.index) {
      return this.refused(request, 'same-commit', 'to');
    }
    // Newest first: an older commit stands later in the log.
    if (to && to.index > from.index) {
      return this.refused(request, 'commit-order', 'to');
    }

    // Both sides are sized before either is fetched, and decoded by one policy (PR #287).
    const sides = await readWorkshopHistorySides(this.ports, file.fsPath, from.commit, to?.commit, () => this.throwIfAborted());
    switch (sides.kind) {
      case 'sides':
        break;
      case 'unavailable':
        return this.unavailable(request, sides.reason);
      case 'too-large':
        return this.refused(request, 'diff-source-too-large', sides.field);
      case 'not-utf8':
        return this.refused(request, 'not-utf8', sides.field);
      case 'current-unreadable':
        this.log('diff failed reason=current-unreadable');
        return this.failed(request, 'The saved file could not be read just now. Try again later.', { outcome: 'current-unreadable' });
      default:
        return assertNever(sides);
    }
    const { older, newer } = sides;
    const mark = to ? undefined : workshopHistoryCurrentMark(newer.text);
    if (request.to.kind === 'current' && request.to.fingerprint !== undefined && request.to.fingerprint !== mark) {
      this.log('diff failed reason=current-changed');
      return this.failed(request, 'The saved file changed since the earlier part was read, so its changes would be numbered ' +
        'differently. Ask again from change 1, without <startChange> or <current>.', { outcome: 'current-changed' });
    }

    // The alignment runs once per pair; a continuation reads its changes from the window's cache (D13a).
    const { outcome: diff, cached } = this.ports.diffs.diff(
      { fsPath: file.fsPath, from: from.commit.id, to: to ? to.commit.id : `current:${mark}` },
      older.text,
      newer.text
    );
    this.log(`diff computed cached=${cached} outcome=${diff.kind === 'diff' ? 'diff' : diff.reason}`);
    if (diff.kind === 'refused') {
      return this.refused(request, diff.reason, 'to');
    }
    const input: Omit<WorkshopHistoryDiffInput, 'take' | 'limitedBy'> = {
      file: file.callFile,
      label: file.label,
      from: { kind: 'commit', commit: from.commit, ...(older.absent ? { absent: true } : {}) },
      to: to
        ? { kind: 'commit', commit: to.commit, ...(newer.absent ? { absent: true } : {}) }
        : { kind: 'current' },
      ...(mark !== undefined ? { currentMark: mark } : {}),
      changes: diff.changes,
      identical: older.text === newer.text,
      startChange: request.startChange ?? 1
    };
    const row = `${file.label} · ${workshopHistoryShownId(from.commit)} → ${to ? workshopHistoryShownId(to.commit) : 'current'}`;
    return this.fittedDiff(request, input, row, window, diff.oldParagraphs, diff.newParagraphs);
  }

  /** The diff, fitted by whole changes to half the window, or to `diffBytes` with no window. */
  private fittedDiff(
    request: Request<'history.diff'>,
    input: Omit<WorkshopHistoryDiffInput, 'take' | 'limitedBy'>,
    rowLabel: string,
    window: CapabilityContextWindow | undefined,
    oldParagraphs: number,
    newParagraphs: number
  ): WorkshopCapabilityResult {
    const total = input.changes.length;
    const remaining = Math.max(0, total - input.startChange + 1);
    const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
    const limitedBy = half !== undefined ? 'context-window' as const : 'diff-bytes' as const;
    const render = (take: number): WorkshopMeasuredRead => {
      const rendered = renderWorkshopHistoryDiff({ ...input, take, ...(take < remaining ? { limitedBy } : {}) });
      const outcome: WorkshopCapabilityResult = {
        capability: request.capability,
        status: 'success',
        requestSummary: workshopHistoryRequestSummary(request),
        content: rendered.content,
        metadata: {
          outcome: 'diff',
          changes: total,
          changesShown: rendered.shown,
          startChange: input.startChange,
          paragraphsBefore: oldParagraphs,
          paragraphsAfter: newParagraphs,
          truncated: rendered.hint !== undefined,
          ...(rendered.hint !== undefined ? { limitedBy, ...(half !== undefined ? { halfWindowTokens: half } : {}) } : {}),
          characters: rendered.content.length
        }
      };
      const size = half === undefined ? Buffer.byteLength(rendered.content, 'utf8') : workshopReadEvidenceTokens(outcome);
      return { size: take, outcome, tokens: size };
    };
    const ceiling = half ?? PROMPT_BUDGETS.workshopHistory.diffBytes;
    const fitted = remaining === 0 ? { fit: render(0), renders: 1 } : fitWorkshopReadToWindow(render, remaining, ceiling, 1);
    if (!fitted.fit) {
      return this.tooLarge(request, half, fitted.minimum);
    }
    const result = fitted.fit.outcome;
    this.sources.set(result, [{ kind: 'history', label: rowLabel, sizeChars: result.content?.length ?? 0 }]);
    this.log(
      `diff changes=${total} shown=${fitted.fit.size} start=${input.startChange} paragraphs=${oldParagraphs}->${newParagraphs} ` +
      `size=${fitted.fit.tokens} ${half !== undefined ? `halfWindow=${half}` : 'window=unknown'} renders=${fitted.renders}`
    );
    return result;
  }

  private unavailable(request: WorkshopHistoryRequest, reason: Parameters<typeof workshopHistoryUnavailableLine>[0]): WorkshopCapabilityResult {
    this.log(`${request.capability} unavailable reason=${reason}`);
    return this.failed(request, workshopHistoryUnavailableLine(reason), { outcome: 'unavailable', reason });
  }

  private failed(request: WorkshopHistoryRequest, line: string, metadata: Record<string, unknown>): WorkshopCapabilityResult {
    const content = workshopHistoryBody([line]);
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: workshopHistoryRequestSummary(request),
      content,
      metadata: { ...metadata, characters: content.length },
      error: line
    };
  }

  /** A diff the host will not run as asked: a recorded refusal in host words, before or without git. */
  private refused(request: Request<'history.diff'>, reason: WorkshopHistoryDiffRefusal, field: 'from' | 'to'): WorkshopCapabilityResult {
    this.log(`diff refused reason=${reason} field=${field}`);
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: workshopHistoryRequestSummary(request),
      error: workshopHistoryDiffRefusal(reason, field),
      metadata: { rejectionReason: reason, rejectionField: field }
    };
  }

  /** Even one change costs more than the room it has: a recorded refusal with that room, and no call. */
  private tooLarge(
    request: Request<'history.diff'>,
    half: number | undefined,
    measured: WorkshopMeasuredRead | undefined
  ): WorkshopCapabilityResult {
    const reason = half !== undefined ? 'history-context-window' : 'diff-too-large';
    this.log(`diff refused reason=${reason}${half !== undefined ? ` halfWindow=${half}` : ''}`);
    const tokens = (value: number): string => `${value.toLocaleString('en-US')} ${value === 1 ? 'token' : 'tokens'}`;
    const bytes = (value: number): string => `${value.toLocaleString('en-US')} bytes`;
    const unit = half !== undefined ? tokens : bytes;
    const room = half !== undefined
      ? `half the room left in your context window is ${tokens(half)}`
      : `one diff result may hold ${bytes(PROMPT_BUDGETS.workshopHistory.diffBytes)}`;
    return {
      capability: request.capability,
      status: 'rejected',
      requestSummary: workshopHistoryRequestSummary(request),
      error: `The first change asked for does not fit: ${room}` +
        (measured ? `, and that change alone measured ${unit(measured.tokens)}` : '') +
        '. A change is never cut. Answer from what you have, and say that this diff could not be read here.',
      metadata: {
        rejectionReason: reason,
        ...(half !== undefined ? { halfWindowTokens: half } : {}),
        ...(measured ? { minimumSize: measured.tokens } : {})
      }
    };
  }

  private throwIfAborted(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('The file-history read was cancelled.');
      error.name = 'AbortError';
      throw error;
    }
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopHistoryCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled history request: ${JSON.stringify(value)}`);
}
