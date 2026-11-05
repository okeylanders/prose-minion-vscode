/**
 * Session recall for one persona turn (ADR 2026-10-05 §1, §7, D9, D11):
 * turns one validated `transcript.*` request into a capability result. The
 * service returns data and the renderers write the text; each operation's
 * adapter owns its limits and what its result records, and this class only
 * dispatches and keeps the manifest rows each result delivered.
 *
 * Recall is deterministic, so a result carries no usage. Cancellation
 * propagates.
 */

import type { LogSink } from '@/platform';
import type { CapabilityContextWindow, CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import type {
  WorkshopCapabilityResult,
  WorkshopTranscriptRecallRequest
} from '@shared/types/workshopCapabilities';
import type { WorkshopTranscriptRecallService } from '@/application/services/workshop/recall/WorkshopTranscriptRecallService';
import { runWorkshopRecallCatalog } from '@/application/services/workshop/recall/WorkshopRecallCatalogOperation';
import { runWorkshopRecallSearch } from '@/application/services/workshop/recall/WorkshopRecallSearchOperation';
import { WorkshopRecallReadOperation } from '@/application/services/workshop/recall/WorkshopRecallReadOperation';
import { runWorkshopRecallTodos } from '@/application/services/workshop/recall/WorkshopRecallTodosOperation';
import {
  assertNeverRecallValue,
  throwIfRecallTurnAborted,
  WorkshopRecallOperationContext,
  WorkshopRecallOperationOutcome,
  WorkshopTranscriptRecallTurnContext
} from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

export type { WorkshopTranscriptRecallTurnContext } from '@/application/services/workshop/recall/WorkshopRecallOperationResults';

/** The service's four questions; satisfied by WorkshopTranscriptRecallService. */
export type WorkshopTranscriptRecallPort = Pick<WorkshopTranscriptRecallService, 'catalog' | 'search' | 'read' | 'todos'>;

export class WorkshopTranscriptRecallCapability {
  private readonly sources = new WeakMap<WorkshopCapabilityResult, readonly CapabilityDeliveredSource[]>();
  private readonly context: WorkshopRecallOperationContext;
  private readonly reads: WorkshopRecallReadOperation;

  constructor(
    private readonly recall: WorkshopTranscriptRecallPort,
    private readonly outputChannel: LogSink,
    private readonly turn: WorkshopTranscriptRecallTurnContext,
    now: () => number = Date.now
  ) {
    this.context = { turn, now, log: (line) => this.log(line) };
    this.reads = new WorkshopRecallReadOperation(recall, this.context);
  }

  async fulfill(request: WorkshopTranscriptRecallRequest, window?: CapabilityContextWindow): Promise<WorkshopCapabilityResult> {
    throwIfRecallTurnAborted(this.turn.signal);
    switch (request.capability) {
      case 'transcript.catalog':
        return runWorkshopRecallCatalog(this.recall, this.context, request);
      case 'transcript.search':
        return runWorkshopRecallSearch(this.recall, this.context, request);
      case 'transcript.read':
        return this.recorded(await this.reads.run(request, window));
      case 'transcript.todos':
        return this.recorded(await runWorkshopRecallTodos(this.recall, this.context, request));
      default:
        return assertNeverRecallValue(request);
    }
  }

  /** Manifest rows for what a result put in context: none for a catalog, a search, or a failure. */
  deliveredSources(result: WorkshopCapabilityResult): readonly CapabilityDeliveredSource[] {
    return this.sources.get(result) ?? [];
  }

  private recorded(outcome: WorkshopRecallOperationOutcome): WorkshopCapabilityResult {
    if (outcome.sources) {
      this.sources.set(outcome.result, outcome.sources);
    }
    return outcome.result;
  }

  private log(line: string): void {
    this.outputChannel.appendLine(
      `[WorkshopTranscriptRecallCapability] request=${this.turn.requestId} persona=${this.turn.personaId} ${line}`
    );
  }
}
