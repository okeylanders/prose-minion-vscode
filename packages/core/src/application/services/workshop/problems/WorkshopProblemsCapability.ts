import type { ContextResourceSummary } from '@/domain/models/ContextGeneration';
import type { LogSink } from '@/platform';
import type { CapabilityContextWindow } from '@orchestration/AgentRunContracts';
import type { WorkshopExcerpt } from '@messages';
import type { WorkshopCapabilityResult, WorkshopProblemsRequest } from '@shared/types/workshopCapabilities';
import type { ConfiguredResourceGroupFiles } from '@/application/services/ConfiguredResourceLookup';
import {
  resolveWorkshopHistoryFile,
  workshopHistoryExcerptFile,
  type WorkshopHistoryFileFault
} from '../history/WorkshopHistoryFiles';
import { fitWorkshopReadToWindow, workshopReadEvidenceTokens } from '../reads/WorkshopReadWindowFit';
import {
  WORKSHOP_PROBLEMS_BOUNDS,
  workshopProblemTextPrefix,
  type WorkshopProblemRow,
  type WorkshopProblemsPage,
  type WorkshopProblemsPorts
} from './WorkshopProblemsPort';

const request = { capability: 'problems.read', requestSummary: 'Read current file Problems' } as const;
/* eslint-disable @typescript-eslint/naming-convention -- keyed by the shared file resolver's fault codes. */
const faults: Record<WorkshopHistoryFileFault, string> = {
  'no-excerpt': 'No excerpt is pinned. Name a configured file by group and path.',
  'pasted-excerpt': 'This excerpt has no backing file. Name a configured file by group and path.',
  'excerpt-unreadable': 'The excerpt file could not be authorized in this workspace.',
  'not-configured': 'No configured file matches that group and path.',
  'ambiguous-path': 'That group and path do not identify a unique configured file.',
  'file-list-unreadable': 'The configured file listing could not be verified.'
};
/* eslint-enable @typescript-eslint/naming-convention */

type Turn = { readonly excerpt?: WorkshopExcerpt; readonly signal: AbortSignal };

/** Read a single authorized file in this run. A later request reads a new snapshot. */
export class WorkshopProblemsCapability {
  constructor(
    private readonly ports: WorkshopProblemsPorts | undefined,
    private readonly resources: () => Promise<readonly ContextResourceSummary[]>,
    private readonly log: LogSink,
    private readonly turn: Turn,
    private readonly groupFiles: ConfiguredResourceGroupFiles
  ) {}

  async fulfill(
    call: WorkshopProblemsRequest,
    window?: CapabilityContextWindow,
    evidenceTokens: (result: WorkshopCapabilityResult) => number = workshopReadEvidenceTokens
  ): Promise<WorkshopCapabilityResult> {
    const start = call.start ?? 1;
    this.checkRun();
    if (!Number.isSafeInteger(start) || start < 1) {
      return { ...request, status: 'rejected', error: 'Start must be a positive entry number.' };
    }
    if (!this.ports) {
      return this.unavailable();
    }
    let page: WorkshopProblemsPage | undefined;
    try {
      const bound = workshopHistoryExcerptFile({ getExcerpt: () => this.turn.excerpt }, this.ports.intake);
      const file = await resolveWorkshopHistoryFile(call.file, bound, this.resources, this.groupFiles);
      this.checkRun();
      if (file.kind === 'fault') {
        return { ...request, status: 'failed', error: faults[file.fault] };
      }
      page = await this.ports.reader.read(file.fsPath, start);
    } catch {
      this.checkRun();
      return this.unavailable();
    }
    this.checkRun();
    if (!page || !Number.isSafeInteger(page.total) || page.total < 0) {
      return this.unavailable();
    }
    const total = page.total;
    const expected = Math.max(0, Math.min(WORKSHOP_PROBLEMS_BOUNDS.rowsPerPage, total - start + 1));
    if (page.problems.length !== expected) {
      return this.unavailable();
    }
    const entries = page.problems.map((row, offset) => renderRow(row, start + offset));
    const render = (take: number): WorkshopCapabilityResult => {
      const nextStart = start + take;
      const more = nextStart <= total;
      let summary = `Current Problems ${start}–${nextStart - 1} of ${total}.`;
      if (!total) {
        summary = 'This file has no currently published Problems.';
      } else if (!take) {
        summary = `No entries at start ${start}. The current snapshot has ${total} Problems.`;
      }
      const lines = [summary, ...entries.slice(0, take)];
      if (more) {
        lines.push(`Continue with start ${nextStart}. A later read sees the current snapshot.`);
      }
      return {
        ...request,
        status: more ? 'partial' : 'success',
        content: lines.join('\n'),
        metadata: { diagnosticCount: total, shownCount: take, ...(more ? { nextStart } : {}) }
      };
    };
    const measure = (take: number) => {
      const candidate = render(take);
      return { size: take, outcome: candidate, tokens: evidenceTokens(candidate) };
    };
    const outcome = window
      ? fitWorkshopReadToWindow(measure, entries.length, Math.floor(window.freeInputTokens / 2), Math.min(1, entries.length)).fit?.outcome
      : render(entries.length);
    if (!outcome) {
      return {
        ...request,
        status: 'rejected',
        error: `The smallest Problems result does not fit. No entries were delivered. Retry start ${start} with more context space.`
      };
    }
    this.log.appendLine(`[WorkshopProblemsCapability] problems.read total=${total} shown=${outcome.metadata?.shownCount}`);
    return outcome;
  }

  private unavailable(): WorkshopCapabilityResult {
    return { ...request, status: 'failed', error: 'The host could not read current Problems for this file.' };
  }

  private checkRun(): void {
    if (this.turn.signal.aborted) {
      const error = new Error('Workshop Problems read cancelled');
      error.name = 'AbortError';
      throw error;
    }
  }
}

/** A single JSON record per location. Diagnostic publishers and manuscript text cannot introduce a new record or frame. */
function renderRow(row: WorkshopProblemRow, number: number): string {
  const fields: Record<string, string | number | boolean> = {
    number,
    severity: row.severity,
    startLine: row.startLine,
    startColumn: row.startColumn,
    endLine: row.endLine,
    endColumn: row.endColumn
  };
  for (const [key, limit] of [
    ['source', WORKSHOP_PROBLEMS_BOUNDS.sourceCharacters],
    ['message', WORKSHOP_PROBLEMS_BOUNDS.messageCharacters],
    ['quote', WORKSHOP_PROBLEMS_BOUNDS.quoteCharacters]
  ] as const) {
    const text = row[key];
    if (text === undefined) {
      continue;
    }
    fields[key] = workshopProblemTextPrefix(text, limit);
    if (text.length > limit || row[`${key}Truncated`]) {
      fields[`${key}Truncated`] = true;
    }
  }
  return JSON.stringify(fields).replace(/[<>&\u2028\u2029]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
