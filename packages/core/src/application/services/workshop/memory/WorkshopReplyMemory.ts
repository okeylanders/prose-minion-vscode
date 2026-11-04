/**
 * A reply's project-memory proposal, settled at completion (ADR 2026-11-04
 * D6, D8, D9; epic Slice 3). Pure: the completion path resolves the context
 * (is memory open, which memories are listed) before it runs, and this turns
 * the extractor's verdict into the turn's `memoryProposal`, or into nothing,
 * with one log line of ids, counts and reasons, never text.
 *
 * - **Off or unavailable:** the trailer was already stripped; it's dropped
 *   with a log line and no card (D8).
 * - **The phrasing fence** (D9) withholds a proposal that infers something
 *   personal about the writer: no card, a logged reason.
 * - **`supersedes`** keeps each id a listed memory holds, with the title it
 *   had, and drops the rest, counted for the card's note (D6). When the
 *   listing could not be read, every one is dropped and counted.
 * - Under `auto` a proposal waits as under `ask` until Slice 5.
 */

import type { WorkshopMemoryProposal } from '@messages';
import type { WorkshopReplyMemoryControl } from '@/utils/workshopReplyControls';
import { workshopMemoryProposalPhrasingFault } from '@/application/services/workshop/memory/WorkshopMemoryProposalPhrasing';

/** What completion needs to know about memory, resolved before it runs. */
export interface WorkshopReplyMemoryContext {
  /** Personas may propose now: the mode is on and this workspace holds memory. */
  readonly open: boolean;
  /** Readable memories by id, with their titles; absent when the reply held no frame, or the listing failed. */
  readonly listed?: ReadonlyMap<string, string>;
  /** The About-you name, for the phrasing fence. */
  readonly writerName?: string;
}

export const WORKSHOP_REPLY_MEMORY_CLOSED: WorkshopReplyMemoryContext = Object.freeze({ open: false });

/** Resolves a reply's memory context; the library implements it. */
export interface WorkshopReplyMemoryPort {
  replyMemoryContext(reply: string, signal?: AbortSignal): Promise<WorkshopReplyMemoryContext>;
}

export interface WorkshopSettledMemoryProposal {
  /** The pending card, or none. */
  readonly proposal?: WorkshopMemoryProposal;
  /** One log line (ids, counts, reasons), or none when the reply held no frame. */
  readonly log?: string;
}

export function settleWorkshopMemoryProposal(
  control: WorkshopReplyMemoryControl,
  context: WorkshopReplyMemoryContext
): WorkshopSettledMemoryProposal {
  switch (control.kind) {
    case 'none':
      return {};
    case 'rejected':
      return { log: `Memory proposal dropped (reason=${control.reason})` };
    case 'proposal': {
      const draft = control.proposal;
      const fault = workshopMemoryProposalPhrasingFault(draft, context.writerName);
      if (fault) {
        return { log: `Memory proposal withheld (reason=${fault})` };
      }
      const supersedes = draft.supersedes.flatMap((id) => {
        const title = context.listed?.get(id);
        return title === undefined ? [] : [{ id, title }];
      });
      const dropped = draft.supersedes.length - supersedes.length;
      const proposal: WorkshopMemoryProposal = {
        title: draft.title,
        kind: draft.kind,
        summary: draft.summary,
        body: draft.body,
        ...(supersedes.length > 0 ? { supersedes } : {}),
        ...(dropped > 0 ? { droppedSupersedes: dropped } : {}),
        state: 'pending'
      };
      return {
        proposal,
        log: `Memory proposal pending (kind=${draft.kind}; supersedes=${supersedes.map((item) => item.id).join(',') || 'none'}; ` +
          `dropped=${dropped}${context.listed ? '' : '; listing=unread'})`
      };
    }
    default:
      return assertNever(control);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled reply memory control: ${JSON.stringify(value)}`);
}

/**
 * The context for one completed reply. A reply that holds no frame needs
 * none, and costs no await: ordinary completions keep their timing. A
 * cancelled run, or a port that fails, reads as closed (the trailer is
 * still stripped).
 */
export async function resolveWorkshopReplyMemory(
  port: WorkshopReplyMemoryPort,
  reply: string,
  signal: AbortSignal,
  writerName?: string
): Promise<WorkshopReplyMemoryContext> {
  if (signal.aborted) {
    return WORKSHOP_REPLY_MEMORY_CLOSED;
  }
  try {
    const context = await port.replyMemoryContext(reply, signal);
    return writerName ? { ...context, writerName } : context;
  } catch {
    return WORKSHOP_REPLY_MEMORY_CLOSED;
  }
}
