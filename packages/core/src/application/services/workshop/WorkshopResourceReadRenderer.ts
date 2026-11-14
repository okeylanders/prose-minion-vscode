/**
 * The model-facing text of one `resource.read` (ADR 2026-11-14 D2a, D6, D7):
 * one message, a section per file in the order named, and what the card and
 * the manifest keep of it. Pure: the operation plans and decides, this
 * writes.
 *
 * - Each file read has its own header (label, group, canonical configured
 *   path, `Lines: a-b of N`) and its text in a neutralized fence.
 * - A file that was not read says why in its own section; the others are
 *   still read.
 * - A file that stopped early ends its section with one complete call on
 *   one line, in the plain one-path form with the file's own group. Each
 *   decodes alone through the codec, exactly as written.
 * - A hint is written only where following it makes progress: it names a
 *   later `startLine`, or the same one with fewer files. A one-path read
 *   never hints its own first line.
 * - A file that delivered no line has no manifest row, no line range and no
 *   fingerprint.
 */

import type { CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ContextPathGroup } from '@shared/types';
import type {
  WorkshopCapabilityResult,
  WorkshopCapabilityStatus
} from '@shared/types/workshopCapabilities';
import type {
  WorkshopResourceDeliveredFile,
  WorkshopResourceLongLineFile,
  WorkshopResourcePlannedFile,
  WorkshopResourceReadPlan
} from './WorkshopResourceReadPlan';
import { workshopResourceReadSummary } from './WorkshopResourceRequestCopy';

export interface WorkshopResourceReadRenderOptions {
  /** Lines the request named, which only a one-path read carries. */
  readonly requestedEndLine?: number;
  /**
   * Whether a later read of the file alone has room for its long line
   * (D2a). The renderer adds what needs no estimate: the line is within a
   * one-path read's bound, and this read named other files too.
   */
  readonly fitsAlone: (file: WorkshopResourceLongLineFile) => boolean;
  /** Said at the top when the limit cut the read. */
  readonly limitNote?: string;
}

export interface WorkshopResourceRenderedRead {
  readonly result: WorkshopCapabilityResult;
  /** One row per file that delivered a line, with its own range and fingerprint. */
  readonly sources: readonly CapabilityDeliveredSource[];
  /** Every continuation call written, as written. */
  readonly hints: readonly string[];
}

const bytes = (value: number): string => value.toLocaleString('en-US');

/** Project text inside a Markdown fence can never close it. */
export function neutralizeWorkshopResourceFence(value: string): string {
  return value.replace(/```/g, '`​``');
}

/** The plain one-path call that reads a file on from `startLine`: complete, on one line. */
export function workshopResourceContinuationCall(
  file: { readonly group: ContextPathGroup; readonly path: string },
  startLine: number
): string {
  const escaped = file.path.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<prose-minion-tool-call name="resource.read"><group>${file.group}</group><path>${escaped}</path>` +
    `<startLine>${startLine}</startLine></prose-minion-tool-call>`;
}

export function renderWorkshopResourceRead(
  plan: WorkshopResourceReadPlan,
  options: WorkshopResourceReadRenderOptions
): WorkshopResourceRenderedRead {
  const single = plan.files.length === 1;
  const hints: string[] = [];
  const sources: CapabilityDeliveredSource[] = [];
  const sections = plan.files.map((planned) => {
    const section = renderSection(planned, plan, options, hints);
    if (planned.kind === 'read') {
      sources.push({
        kind: 'resource',
        label: planned.file.path,
        configuredResource: { group: planned.file.group, path: planned.file.path },
        // This file's own section, never the whole card's.
        sizeChars: section.length,
        lineRange: { start: planned.file.startLine, end: planned.endLine },
        sourceFingerprint: planned.file.fingerprint
      });
    }
    return section;
  });
  const delivered = plan.files.filter((planned) => planned.kind === 'read').length;
  const status: WorkshopCapabilityStatus = delivered === plan.files.length
    ? 'success'
    : delivered > 0 ? 'partial' : 'failed';
  const content = [
    ...(single ? [] : [`# Project resources · ${delivered} of ${plan.files.length} files read`]),
    ...(options.limitNote && plan.limited ? [options.limitNote] : []),
    ...sections
  ].join('\n\n');
  return {
    result: {
      capability: 'resource.read',
      status,
      requestSummary: workshopResourceReadSummary(plan.files.map((planned) => planned.file.path)),
      content,
      metadata: {
        ...(single ? singleFileMetadata(plan.files[0], options) : {}),
        files: plan.files.map(fileRow),
        filesNamed: plan.files.length,
        filesRead: delivered,
        limitedBy: plan.limit.by,
        limitBytes: plan.limit.bytes,
        ...(single ? {} : { bytes: plan.deliveredBytes, truncated: plan.limited })
      },
      ...(delivered === 0 ? { error: single ? 'The line does not fit this read. No text was delivered.' : 'None of the named files could be read.' } : {})
    },
    sources,
    hints
  };
}

function renderSection(
  planned: WorkshopResourcePlannedFile,
  plan: WorkshopResourceReadPlan,
  options: WorkshopResourceReadRenderOptions,
  hints: string[]
): string {
  switch (planned.kind) {
    case 'read':
      return deliveredSection(planned, plan, options, hints);
    case 'line-too-long':
      return longLineSection(planned, plan, options, hints);
    case 'fault':
      return [
        `## Project resource · ${planned.file.path}`,
        `Group: ${planned.file.group}`,
        `Path: ${planned.file.path}`,
        `Not read: ${planned.file.error}`
      ].join('\n');
    default:
      return assertNever(planned);
  }
}

function header(file: WorkshopResourceDeliveredFile['file']): string[] {
  return [
    `## Project resource · ${file.label}`,
    `Group: ${file.group}`,
    `Path: ${file.path}`,
    ...(file.workspaceFolder ? [`Workspace: ${file.workspaceFolder}`] : [])
  ];
}

function deliveredSection(
  planned: WorkshopResourceDeliveredFile,
  plan: WorkshopResourceReadPlan,
  options: WorkshopResourceReadRenderOptions,
  hints: string[]
): string {
  const { file, endLine } = planned;
  const single = plan.files.length === 1;
  const reachedDefaultEnd = !planned.truncated && options.requestedEndLine === undefined && endLine < file.totalLines;
  const lines = [
    ...header(file),
    `Lines: ${file.startLine}-${endLine} of ${file.totalLines}.`,
    planned.truncated
      ? `Requested through line ${file.selectedEndLine}; stopped at ${stoppedAt(planned, plan, single)}.`
      : reachedDefaultEnd
        ? `Default window: up to ${PROMPT_BUDGETS.workshopResource.readDefaultLines} lines.`
        : `Read size: ${planned.bytes} UTF-8 bytes.`,
    '',
    '```markdown',
    neutralizeWorkshopResourceFence(file.lines.slice(file.startLine - 1, endLine).join('\n')),
    '```'
  ];
  // Stopped before the file's end without the request asking it to.
  if (planned.truncated || reachedDefaultEnd) {
    const call = workshopResourceContinuationCall(file, endLine + 1);
    hints.push(call);
    lines.push('More of this file is unread. To continue it, send this call alone:', call);
  }
  return lines.join('\n');
}

/** Where a truncated file stopped, in today's words for a one-path read at its own ceiling. */
function stoppedAt(planned: WorkshopResourceDeliveredFile, plan: WorkshopResourceReadPlan, single: boolean): string {
  if (!single) {
    return `a whole line within its ${bytes(planned.share)}-byte share of this read`;
  }
  return plan.limit.by === 'read-budget'
    ? `a whole line within the ${plan.limit.bytes}-byte ceiling`
    : `a whole line within this read's ${bytes(plan.limit.bytes)}-byte limit`;
}

function longLineSection(
  planned: WorkshopResourceLongLineFile,
  plan: WorkshopResourceReadPlan,
  options: WorkshopResourceReadRenderOptions,
  hints: string[]
): string {
  const { file, line } = planned;
  const had = plan.files.length === 1 ? 'this read had' : 'this file had in this read';
  const lines = [
    ...header(file),
    `Not read: line ${line} of ${file.totalLines} is ${bytes(planned.lineBytes)} bytes, more than the ` +
      `${bytes(planned.share)} bytes ${had}. A line is never cut, so no text was delivered for this file.`
  ];
  const withinOneRead = planned.lineBytes <= PROMPT_BUDGETS.workshopResource.readBytes;
  // Only beside other files: a one-path read's own first line is the call that just failed.
  if (withinOneRead && plan.files.length > 1 && options.fitsAlone(planned)) {
    const call = workshopResourceContinuationCall(file, line);
    hints.push(call);
    lines.push('The line fits a read of this file alone. To read it, send this call alone:', call);
    return lines.join('\n');
  }
  lines.push(!withinOneRead
    ? `A read of one file holds at most ${bytes(PROMPT_BUDGETS.workshopResource.readBytes)} bytes, so line ${line} cannot be read on its own.`
    : `Line ${line} cannot be read in this turn: it does not fit the room left even in a read of this file alone.`);
  if (line < file.totalLines) {
    const call = workshopResourceContinuationCall(file, line + 1);
    hints.push(call);
    lines.push(`To read on from line ${line + 1}, passing over line ${line} unread, send this call alone:`, call);
  }
  return lines.join('\n');
}

/** One file's row in the card's metadata. */
function fileRow(planned: WorkshopResourcePlannedFile): Record<string, unknown> {
  switch (planned.kind) {
    case 'read':
      return {
        group: planned.file.group,
        path: planned.file.path,
        outcome: 'read',
        startLine: planned.file.startLine,
        endLine: planned.endLine,
        totalLines: planned.file.totalLines,
        bytes: planned.bytes,
        truncated: planned.truncated
      };
    case 'line-too-long':
      return {
        group: planned.file.group,
        path: planned.file.path,
        outcome: 'line-too-long',
        line: planned.line,
        lineBytes: planned.lineBytes,
        shareBytes: planned.share,
        totalLines: planned.file.totalLines
      };
    case 'fault':
      return { group: planned.file.group, path: planned.file.path, outcome: planned.file.fault };
    default:
      return assertNever(planned);
  }
}

/** A one-path read keeps the top-level fields it has always had, so its line range reads as before. */
function singleFileMetadata(
  planned: WorkshopResourcePlannedFile,
  options: WorkshopResourceReadRenderOptions
): Record<string, unknown> {
  switch (planned.kind) {
    case 'read':
      return {
        group: planned.file.group,
        path: planned.file.path,
        workspaceFolder: planned.file.workspaceFolder,
        startLine: planned.file.startLine,
        endLine: planned.endLine,
        requestedEndLine: options.requestedEndLine,
        totalLines: planned.file.totalLines,
        defaultLineWindow: options.requestedEndLine === undefined,
        bytes: planned.bytes,
        totalBytes: planned.file.totalBytes,
        windowBytes: planned.file.windowBytes,
        truncated: planned.truncated
      };
    case 'line-too-long':
      // No `startLine`/`endLine`: nothing was delivered, so there is no line range to record.
      return {
        group: planned.file.group,
        path: planned.file.path,
        workspaceFolder: planned.file.workspaceFolder,
        outcome: 'line-too-long',
        line: planned.line,
        lineBytes: planned.lineBytes,
        shareBytes: planned.share,
        totalLines: planned.file.totalLines
      };
    case 'fault':
      return { ...planned.file.metadata };
    default:
      return assertNever(planned);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled resource-read file: ${JSON.stringify(value)}`);
}
