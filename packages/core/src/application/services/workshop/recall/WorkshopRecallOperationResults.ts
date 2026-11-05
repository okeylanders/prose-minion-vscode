/**
 * What every `transcript.*` operation adapter shares (ADR 2026-10-05 §7,
 * D11): the turn it runs in, the failed and rejected results it records, the
 * scan costs a result reports, and the turn ranges a provenance row names.
 * Pure but for the log line a refusal writes.
 */

import type { WorkshopPersonaId } from '@messages';
import type { CapabilityDeliveredSource } from '@orchestration/AgentRunContracts';
import type {
  WorkshopCapabilityResult,
  WorkshopTranscriptRecallRequest
} from '@shared/types/workshopCapabilities';
import { workshopTranscriptRecallRequestSummary } from '@/application/services/workshop/recall/WorkshopTranscriptRecallRequestCopy';
import { formatWorkshopRecallTurnRanges } from '@/application/services/workshop/recall/WorkshopRecallReadWindow';

export interface WorkshopTranscriptRecallTurnContext {
  readonly requestId: string;
  readonly personaId: WorkshopPersonaId;
  readonly signal: AbortSignal;
}

/** What one operation adapter needs from the capability that dispatched it. */
export interface WorkshopRecallOperationContext {
  readonly turn: WorkshopTranscriptRecallTurnContext;
  readonly now: () => number;
  log(line: string): void;
}

/** A result, and the manifest rows for what it put in context (none for a failure). */
export interface WorkshopRecallOperationOutcome {
  readonly result: WorkshopCapabilityResult;
  readonly sources?: readonly CapabilityDeliveredSource[];
}

export type WorkshopRecallRequestOf<C extends WorkshopTranscriptRecallRequest['capability']> =
  Extract<WorkshopTranscriptRecallRequest, { capability: C }>;

/** Ranges a read's provenance or a manifest label names before counting the rest. */
export const WORKSHOP_RECALL_LISTED_RANGES = 12;

export function recallFailedResult(
  request: WorkshopTranscriptRecallRequest,
  content: string,
  metadata: Readonly<Record<string, unknown>>
): WorkshopCapabilityResult {
  return {
    capability: request.capability,
    status: 'failed',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    content,
    metadata: { ...metadata, characters: content.length },
    error: 'Nothing from saved sessions was recalled.'
  };
}

export function recallRejectedResult(
  context: WorkshopRecallOperationContext,
  request: WorkshopTranscriptRecallRequest,
  rejectionReason: string,
  error: string,
  metadata: Readonly<Record<string, unknown>> = {}
): WorkshopCapabilityResult {
  context.log(`refused ${request.capability} reason=${rejectionReason}`);
  return {
    capability: request.capability,
    status: 'rejected',
    requestSummary: workshopTranscriptRecallRequestSummary(request),
    error,
    metadata: { rejectionReason, ...metadata }
  };
}

export function throwIfRecallTurnAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    const error = new Error('Session recall was cancelled.');
    error.name = 'AbortError';
    throw error;
  }
}

/** What reading many sessions cost, as the result log and the evidence report it. */
export function recallScanCosts(bounds: {
  readonly parsedBytes: number;
  readonly unreadableSessions: number;
  readonly unreadableBytesCharged: number;
  readonly cacheHits: number;
  readonly listingTruncated: boolean;
}): Record<string, number | boolean> {
  return {
    parsedBytes: bounds.parsedBytes,
    unreadableSessions: bounds.unreadableSessions,
    unreadableBytesCharged: bounds.unreadableBytesCharged,
    cacheHits: bounds.cacheHits,
    listingTruncated: bounds.listingTruncated
  };
}

export function recallListedRanges(ranges: ReadonlyArray<{ readonly from: number; readonly to: number }>): string {
  const listed = formatWorkshopRecallTurnRanges(ranges.slice(0, WORKSHOP_RECALL_LISTED_RANGES));
  return ranges.length > WORKSHOP_RECALL_LISTED_RANGES
    ? `${listed}, and ${ranges.length - WORKSHOP_RECALL_LISTED_RANGES} more`
    : listed;
}

export function recallNumber(value: number): string {
  return value.toLocaleString('en-US');
}

export function assertNeverRecallValue(value: never): never {
  throw new Error(`Unhandled session-recall request: ${JSON.stringify(value)}`);
}
