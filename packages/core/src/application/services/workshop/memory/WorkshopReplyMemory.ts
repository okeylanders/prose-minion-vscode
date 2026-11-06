/**
 * A reply's project-memory proposals, settled at completion (ADR 2026-11-04
 * D6, D8, D9; epic Slices 3 and 6b). Pure: the completion path resolves the
 * context (is memory open, which memories are listed) before it runs, and
 * this turns the extractor's verdict into the turn's `memoryProposals`, or
 * into nothing, with one log line per frame of ids, counts and reasons,
 * never text. Each proposal is settled on its own, in the order written.
 *
 * - **Off or unavailable:** the trailer was already stripped; it's dropped
 *   with a log line and no card (D8).
 * - **The phrasing fence** (D9) withholds a proposal that infers something
 *   personal about the writer: no card, a logged reason.
 * - **`supersedes`** keeps each id a listed memory holds, with the title it
 *   had, and drops the rest, counted for the card's note (D6). When the
 *   listing could not be read, every one is dropped and counted.
 * - **An edit** (Slice 6c) is settled by `WorkshopReplyMemoryEdit`, against
 *   the listing whole (`memories`), and always waits for the writer.
 * - **Save and tell me** (Slice 5, `WorkshopMemoryAutoSave`): with the run's
 *   facts, each proposal under `auto` is held (web research attached, a
 *   memory it replaces, or the room's cap reached, counting the reply's
 *   earlier proposals admitted) with its reason on its card, or marked to be
 *   saved at once. Without them (a caller that can't save), it waits as
 *   under `ask`.
 */

import type { WorkshopMemoryProposal, WorkshopProjectMemoryMode } from '@messages';
import type { WorkshopReplyMemoryControl } from '@/utils/workshopReplyControls';
import { isWorkshopMemoryEditDraft } from '@/utils/workshopMemoryEditProtocol';
import type { ProjectMemoryListed } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { settleWorkshopMemoryEdit } from '@/application/services/workshop/memory/WorkshopReplyMemoryEdit';
import type { WorkshopMemoryProposalDraft } from '@/utils/workshopMemoryProposalProtocol';
import { workshopMemoryProposalPhrasingFault } from '@/application/services/workshop/memory/WorkshopMemoryProposalPhrasing';
import {
  routeWorkshopMemoryProposal,
  type WorkshopMemoryRunFacts
} from '@/application/services/workshop/memory/WorkshopMemoryAutoSave';

/** What completion needs to know about memory, resolved before it runs. */
export interface WorkshopReplyMemoryContext {
  /** Personas may propose now: the mode is on and this workspace holds memory. */
  readonly open: boolean;
  /** The mode read with `open`: Ask first or Save and tell me (Slice 5). */
  readonly mode?: Exclude<WorkshopProjectMemoryMode, 'off'>;
  /** Readable memories by id, with their titles; absent when the reply held no frame, or the listing failed. */
  readonly listed?: ReadonlyMap<string, string>;
  /** The same listing whole, with each note's standing and version: what an edit is anchored against (Slice 6c). */
  readonly memories?: readonly ProjectMemoryListed[];
  /** The About-you name, for the phrasing fence. */
  readonly writerName?: string;
}

export const WORKSHOP_REPLY_MEMORY_CLOSED: WorkshopReplyMemoryContext = Object.freeze({ open: false });

/** Resolves a reply's memory context; the library implements it. */
export interface WorkshopReplyMemoryPort {
  replyMemoryContext(reply: string, signal?: AbortSignal): Promise<WorkshopReplyMemoryContext>;
}

export interface WorkshopSettledMemoryProposals {
  /** The cards, in the order written; empty when none survived. */
  readonly proposals: readonly WorkshopMemoryProposal[];
  /** One log line per frame (ids, counts, reasons); empty when the reply held no frame. */
  readonly logs: readonly string[];
  /** Save and tell me: indexes in `proposals` to save at once, in order, once the turn is recorded (Slice 5). */
  readonly autoSave: readonly number[];
}

const NOTHING: WorkshopSettledMemoryProposals = Object.freeze({ proposals: [], logs: [], autoSave: [] });

export function settleWorkshopMemoryProposals(
  control: WorkshopReplyMemoryControl,
  context: WorkshopReplyMemoryContext,
  run?: WorkshopMemoryRunFacts
): WorkshopSettledMemoryProposals {
  switch (control.kind) {
    case 'none':
      return NOTHING;
    case 'frames': {
      const proposals: WorkshopMemoryProposal[] = [];
      const autoSave: number[] = [];
      const logs = control.rejections.map((reason) => `Memory proposal dropped (reason=${reason})`);
      for (const draft of control.proposals) {
        if (isWorkshopMemoryEditDraft(draft)) {
          // An edit always waits for the writer; under Save and tell me it says why (Slice 6c).
          const route = run ? routeWorkshopMemoryProposal(context.mode, run, { supersedes: [], edit: true }) : { kind: 'wait' as const };
          const edit = settleWorkshopMemoryEdit(draft, context.memories, context.writerName, route.kind === 'held' ? route.held : undefined);
          if (edit.proposal) {
            proposals.push(edit.proposal);
          }
          logs.push(edit.log);
          continue;
        }
        const fault = workshopMemoryProposalPhrasingFault(draft, context.writerName);
        if (fault) {
          logs.push(`Memory proposal withheld (reason=${fault})`);
          continue;
        }
        const settled = settleOne(draft, context, run, autoSave.length);
        if (settled.auto) {
          autoSave.push(proposals.length);
        }
        proposals.push(settled.proposal);
        logs.push(settled.log);
      }
      return { proposals, logs, autoSave };
    }
    default:
      return assertNever(control);
  }
}

function settleOne(
  draft: WorkshopMemoryProposalDraft,
  context: WorkshopReplyMemoryContext,
  run: WorkshopMemoryRunFacts | undefined,
  admitted: number
): { proposal: WorkshopMemoryProposal; auto: boolean; log: string } {
  const supersedes = draft.supersedes.flatMap((id) => {
    const title = context.listed?.get(id);
    return title === undefined ? [] : [{ id, title }];
  });
  const dropped = draft.supersedes.length - supersedes.length;
  const route = run ? routeWorkshopMemoryProposal(context.mode, run, draft, admitted) : { kind: 'wait' as const };
  const proposal: WorkshopMemoryProposal = {
    proposes: 'new',
    title: draft.title,
    kind: draft.kind,
    summary: draft.summary,
    body: draft.body,
    ...(supersedes.length > 0 ? { supersedes } : {}),
    ...(dropped > 0 ? { droppedSupersedes: dropped } : {}),
    ...(draft.cites ? { cites: [...draft.cites] } : {}),
    state: 'pending',
    ...(route.kind === 'held' ? { held: route.held } : {})
  };
  const outcome = route.kind === 'held' ? `held (reason=${route.held}; ` : route.kind === 'auto' ? 'saving (mode=auto; ' : 'pending (';
  return {
    proposal,
    auto: route.kind === 'auto',
    log: `Memory proposal ${outcome}kind=${draft.kind}; supersedes=${supersedes.map((item) => item.id).join(',') || 'none'}; ` +
      `dropped=${dropped}${draft.cites ? `; cites=${draft.cites.length}` : ''}${context.listed ? '' : '; listing=unread'})`
  };
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
