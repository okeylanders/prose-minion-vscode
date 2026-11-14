/**
 * `resource.read` for one persona turn (ADR 2026-11-14 D2–D7): one to
 * `readPaths` configured files in one call, fitted to the context window.
 * One instance per turn, so its byte count is the turn's.
 *
 * - The bound: a one-path read keeps `readBytes` and its default line
 *   window; a read naming more shares `readBytesMulti`, fairly.
 * - The window fit: a read takes at most half the room the model's context
 *   window has for evidence, by the preflight's own estimate of what was
 *   rendered (reads/WorkshopReadWindowFit). With the window known there is
 *   no per-turn byte total; the fit and the call ceiling are the bounds.
 * - An unknown window: no fit, and no preflight either, so nothing local
 *   checks what a read costs. The turn's file reads then share one read's
 *   worth, `readBytesMulti`, and a limited or refused read says why.
 * - The minimum: `readMinimumBytes` for each file that can be read (or the
 *   whole of a smaller one). A read whose limit holds less is refused, with
 *   the room it had. It is never cut below the minimum.
 * - Whole lines: a line is never cut. One that does not fit its file's
 *   share is that file's own outcome, `line-too-long`, and every hint the
 *   read writes makes progress (D2a).
 * - One bad path never fails the others; each file's outcome is its own.
 */

import type { CapabilityContextWindow, CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type {
  WorkshopCapabilityRequest,
  WorkshopCapabilityResult
} from '@shared/types/workshopCapabilities';
import {
  fitWorkshopReadToWindow,
  workshopReadEvidenceTokens,
  WorkshopMeasuredRead,
  WorkshopReadWindowFit
} from '@/application/services/workshop/reads/WorkshopReadWindowFit';
import {
  prepareWorkshopResourceFiles,
  WorkshopResourceFaultedFile,
  WorkshopResourceFileSource
} from './WorkshopResourceReadFiles';
import {
  planWorkshopResourceRead,
  WorkshopResourceLongLineFile,
  WorkshopResourceReadLimit,
  WorkshopResourceReadPlan,
  workshopResourceReadMinimumBytes
} from './WorkshopResourceReadPlan';
import {
  renderWorkshopResourceRead,
  WorkshopResourceRenderedRead
} from './WorkshopResourceReadRenderer';

export type ResourceReadRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.read' }>;

/** What a read needs of the turn's resource capability. */
export interface WorkshopResourceReadPorts extends WorkshopResourceFileSource {
  /** A refusal, logged by its words; they name numbers, never a path. */
  rejected(request: ResourceReadRequest, error: string, metadata?: Readonly<Record<string, unknown>>): WorkshopCapabilityResult;
  /** Counts and groups only. */
  log(line: string): void;
}

export interface WorkshopResourceReadOutcome {
  readonly result: WorkshopCapabilityResult;
  /** Manifest rows: one per file that delivered a line. */
  readonly sources?: readonly CapabilityDeliveredSource[];
}

/**
 * What a one-path read costs beyond its text, in tokens: its header and its
 * metadata. An estimate for one question only, whether a long line would fit
 * a read of its file alone; a wrong guess costs a call, never progress.
 */
const SOLO_READ_OVERHEAD_TOKENS = 256;

const count = (value: number): string => value.toLocaleString('en-US');
const files = (named: number): string => `${named} ${named === 1 ? 'file' : 'files'}`;

export class WorkshopResourceReadOperation {
  /** The bytes this turn's file reads have delivered. */
  private turnBytes = 0;

  constructor(private readonly ports: WorkshopResourceReadPorts) {}

  async run(request: ResourceReadRequest, window?: CapabilityContextWindow): Promise<WorkshopResourceReadOutcome> {
    const budgets = PROMPT_BUDGETS.workshopResource;
    const prepared = await prepareWorkshopResourceFiles(this.ports, request.files, request);
    const single = prepared.length === 1;
    if (single && prepared[0].kind === 'fault') {
      return { result: this.singleFault(request, prepared[0]) };
    }
    const readable = prepared.some(file => file.kind === 'ready');
    const minimum = workshopResourceReadMinimumBytes(prepared, budgets.readMinimumBytes);
    const limit = this.readLimit(single ? budgets.readBytes : budgets.readBytesMulti, window);
    if (readable && limit.bytes < minimum) {
      return { result: this.tooSmall(request, limit, minimum) };
    }

    const renderedOf = new Map<WorkshopCapabilityResult, { rendered: WorkshopResourceRenderedRead; plan: WorkshopResourceReadPlan }>();
    const render = (size: number): WorkshopMeasuredRead => {
      // Below the first guess, only the window limits a read.
      const readLimit: WorkshopResourceReadLimit = size === limit.bytes ? limit : { bytes: size, by: 'context-window' };
      const plan = planWorkshopResourceRead(prepared, readLimit);
      const rendered = this.render(request, plan, window);
      renderedOf.set(rendered.result, { rendered, plan });
      return { size, outcome: rendered.result, tokens: window ? workshopReadEvidenceTokens(rendered.result) : 0 };
    };
    const half = window ? Math.floor(window.freeInputTokens / 2) : undefined;
    const fitted: WorkshopReadWindowFit = half === undefined || !readable
      ? { fit: render(limit.bytes), renders: 1 }
      : fitWorkshopReadToWindow(render, limit.bytes, half, minimum);
    if (!fitted.fit) {
      return { result: this.windowTooSmall(request, minimum, half!, fitted.minimum) };
    }
    const { rendered, plan } = renderedOf.get(fitted.fit.outcome)!;
    this.turnBytes += plan.deliveredBytes;
    this.ports.log(
      `read files=${prepared.length} delivered=${rendered.sources.length} status=${rendered.result.status} ` +
      `limit=${plan.limit.bytes} by=${plan.limit.by} bytes=${plan.deliveredBytes} turnBytes=${this.turnBytes}` +
      (half === undefined ? ' window=unknown' : ` tokens=${fitted.fit.tokens} halfWindow=${half} renders=${fitted.renders}`)
    );
    return { result: rendered.result, sources: rendered.sources };
  }

  /** The tightest of the read's own bound and, by the window: half of it, or what is left of the turn's total. */
  private readLimit(bound: number, window: CapabilityContextWindow | undefined): WorkshopResourceReadLimit {
    if (window) {
      // A first guess, at the estimate's bytes per token; the rendered read is measured after.
      const half = Math.floor(window.freeInputTokens / 2) * PROMPT_BUDGETS.inferenceContext.bytesPerToken;
      return half < bound ? { bytes: half, by: 'context-window' } : { bytes: bound, by: 'read-budget' };
    }
    const left = Math.max(0, PROMPT_BUDGETS.workshopResource.readBytesMulti - this.turnBytes);
    return left < bound ? { bytes: left, by: 'per-turn-total' } : { bytes: bound, by: 'read-budget' };
  }

  private render(
    request: ResourceReadRequest,
    plan: WorkshopResourceReadPlan,
    window: CapabilityContextWindow | undefined
  ): WorkshopResourceRenderedRead {
    const options = { requestedEndLine: request.endLine, limitNote: this.limitNote(plan) };
    const provisional = renderWorkshopResourceRead(plan, { ...options, fitsAlone: () => false });
    // A one-path read never hints its own first line; the renderer holds that too.
    if (plan.files.length === 1 || !plan.files.some(file => file.kind === 'line-too-long')) {
      return provisional;
    }
    // What this read costs is known only once it is written, so it is written twice.
    return renderWorkshopResourceRead(plan, { ...options, fitsAlone: this.soloRoom(plan, provisional.result, window) });
  }

  /**
   * Whether a line would fit a later read of its file alone, once this
   * read's evidence is in the window (D2a): within half the room left, or,
   * with no window, within what is left of the turn's total.
   */
  private soloRoom(
    plan: WorkshopResourceReadPlan,
    result: WorkshopCapabilityResult,
    window: CapabilityContextWindow | undefined
  ): (file: WorkshopResourceLongLineFile) => boolean {
    if (!window) {
      const left = PROMPT_BUDGETS.workshopResource.readBytesMulti - this.turnBytes - plan.deliveredBytes;
      return (file) => file.lineBytes <= left;
    }
    const halfAfter = Math.floor(Math.max(0, window.freeInputTokens - workshopReadEvidenceTokens(result)) / 2);
    return (file) => {
      const line = file.file.lines[file.line - 1];
      const lineTokens = workshopReadEvidenceTokens({ capability: 'resource.read', status: 'success', requestSummary: '', content: line });
      return lineTokens + SOLO_READ_OVERHEAD_TOKENS <= halfAfter;
    };
  }

  private limitNote(plan: WorkshopResourceReadPlan): string | undefined {
    const { limit } = plan;
    switch (limit.by) {
      case 'read-budget':
        return plan.files.length === 1 ? undefined : `This read was limited to ${count(limit.bytes)} bytes, shared between its files.`;
      case 'per-turn-total':
        return `This read was limited to ${count(limit.bytes)} bytes: ${this.turnTotalWords()}.`;
      case 'context-window':
        return `This read was limited to ${count(limit.bytes)} bytes, half the room left in your context window.`;
      default:
        return assertNever(limit.by);
    }
  }

  private turnTotalWords(): string {
    return `earlier file reads this turn used ${count(this.turnBytes)} of the ` +
      `${count(PROMPT_BUDGETS.workshopResource.readBytesMulti)}-byte total, one read's worth, ` +
      'because the size of your context window is unknown';
  }

  /** A one-path read of a file that cannot be read at all: today's result, in today's words. */
  private singleFault(request: ResourceReadRequest, file: WorkshopResourceFaultedFile): WorkshopCapabilityResult {
    if (file.fault === 'missing' || file.fault === 'ambiguous') {
      return this.ports.rejected(request, file.error);
    }
    return {
      capability: request.capability,
      status: 'failed',
      requestSummary: file.path,
      error: file.error,
      metadata: { ...file.metadata, files: [{ group: file.group, path: file.path, outcome: file.fault }], filesNamed: 1, filesRead: 0 }
    };
  }

  /** A bounded, recorded refusal naming the room the read had and what it needs. */
  private tooSmall(request: ResourceReadRequest, limit: WorkshopResourceReadLimit, minimum: number): WorkshopCapabilityResult {
    const named = request.files.length;
    const byWindow = limit.by === 'context-window';
    return this.ports.rejected(
      request,
      `${this.needs(named, minimum)}, but ${byWindow
        ? `half the room left in your context window holds only about ${count(limit.bytes)} bytes`
        : `only ${count(limit.bytes)} bytes are left: ${this.turnTotalWords()}`}. ` +
        // The turn's total resets with the next writer message; the window does not.
        (byWindow
          ? fewerFiles(named)
          : 'The total resets with the next writer message. Answer from what you have, and tell the writer which files are left for your next turn.'),
      {
        rejectionReason: byWindow ? 'resource-context-window' : 'resource-read-total',
        bytesLeft: limit.bytes,
        minimumBytes: minimum,
        filesNamed: named
      }
    );
  }

  /** After measuring: even the minimum read costs more than half the window. */
  private windowTooSmall(
    request: ResourceReadRequest,
    minimum: number,
    half: number,
    measured: WorkshopMeasuredRead | undefined
  ): WorkshopCapabilityResult {
    const named = request.files.length;
    return this.ports.rejected(
      request,
      `${this.needs(named, minimum)}, but half the room left in your context window is ${count(half)} tokens` +
        (measured ? `, and the smallest read of ${named === 1 ? 'this file' : 'these files'} measured ${count(measured.tokens)}` : '') +
        `. ${fewerFiles(named)}`,
      {
        rejectionReason: 'resource-context-window',
        minimumBytes: minimum,
        filesNamed: named,
        ...(measured ? { minimumTokens: measured.tokens } : {}),
        halfWindowTokens: half
      }
    );
  }

  private needs(named: number, minimum: number): string {
    return `This read names ${files(named)} and needs at least ${count(minimum)} bytes ` +
      `(${count(PROMPT_BUDGETS.workshopResource.readMinimumBytes)} for each, or the whole of a smaller file)`;
  }
}

function fewerFiles(named: number): string {
  return named === 1 ? 'Answer from what you have.' : 'Name fewer files, or answer from what you have.';
}

function assertNever(value: never): never {
  throw new Error(`Unhandled resource-read limit: ${String(value)}`);
}
