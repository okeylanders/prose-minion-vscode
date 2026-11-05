/**
 * A reply's edit suggestion, settled at completion (epic Slice 6c; ADR
 * 2026-11-04 addendum of 2026-11-05). Pure, beside `WorkshopReplyMemory`,
 * which settles each item in order and calls this for an edit.
 *
 * - **The target** must be a readable note in effect, as the listing had it
 *   when the reply landed: an id it doesn't hold (unknown, unreadable, set
 *   aside, or held by several files) is `unknown-target`; an archived,
 *   superseded or busy one is refused by its standing. A listing that
 *   couldn't be read drops the edit (`listing-unread`).
 * - **Anchoring** is `WorkshopMemoryEditAnchor`'s, against that note; the
 *   item records the note's edit token (every field a Save can overwrite,
 *   and its standing: PR #212 F-02), which a Save must still find, and
 *   every id it supersedes, listed or not (F-01).
 * - **The result** passes the phrasing fence (D9) exactly as a new note
 *   does, and the pinned budget when the note loads in full (D5). The
 *   field bounds imply the file's byte bound (PR #194 F-05); the store
 *   checks the file again at commit.
 * - **Always waits.** Under Save and tell me it is held `edit` (after the
 *   web-research hold), and never takes a place under the cap.
 * - **Logs** carry the target id and reasons, never text.
 */

import type { WorkshopMemoryEditProposal, WorkshopMemoryHold } from '@messages';
import { projectMemoryBody } from '@shared/types/projectMemory';
import type { ProjectMemoryListed } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { pinnedBudget } from '@/application/services/workshop/memory/ProjectMemoryPinnedBudget';
import { projectMemoryEditToken } from '@/application/services/workshop/memory/ProjectMemoryVersion';
import { anchorWorkshopMemoryEdit } from '@/application/services/workshop/memory/WorkshopMemoryEditAnchor';
import { workshopMemoryProposalPhrasingFault } from '@/application/services/workshop/memory/WorkshopMemoryProposalPhrasing';
import type { WorkshopMemoryEditDraft } from '@/utils/workshopMemoryEditProtocol';

export interface WorkshopSettledMemoryEdit {
  readonly proposal?: WorkshopMemoryEditProposal;
  readonly log: string;
}

export function settleWorkshopMemoryEdit(
  edit: WorkshopMemoryEditDraft,
  memories: readonly ProjectMemoryListed[] | undefined,
  writerName: string | undefined,
  held: WorkshopMemoryHold | undefined
): WorkshopSettledMemoryEdit {
  const dropped = (reason: string): WorkshopSettledMemoryEdit => ({ log: `Memory edit dropped (target=${edit.target}; reason=${reason})` });
  if (!memories) {
    return dropped('listing-unread');
  }
  const listed = memories.find(({ memory }) => memory.id === edit.target);
  if (!listed) {
    return dropped('unknown-target');
  }
  const { memory } = listed;
  if (memory.status === 'archived') {
    return dropped('archived-target');
  }
  if (listed.superseded) {
    return dropped('superseded-target');
  }
  if (listed.busy) {
    return dropped('busy-target');
  }
  const anchoring = anchorWorkshopMemoryEdit(edit, memory);
  if (anchoring.kind === 'refused') {
    return dropped(anchoring.reason);
  }
  const { before, after } = anchoring;
  const fault = workshopMemoryProposalPhrasingFault(after, writerName);
  if (fault) {
    return { log: `Memory edit withheld (target=${edit.target}; reason=${fault})` };
  }
  if (memory.pinned) {
    const budget = pinnedBudget(memories, { ...memory, ...after, body: projectMemoryBody(after.body) }, memory.id);
    if (budget.refused) {
      return dropped('pinned-budget');
    }
  }
  const titles = new Map(memories.map((entry) => [entry.memory.id, entry.memory.title]));
  const replaces = memory.supersedes.flatMap((id) => titles.has(id) ? [{ id, title: titles.get(id) as string }] : []);
  const changed = (['title', 'kind', 'summary', 'body'] as const).filter((field) => after[field] !== before[field]);
  return {
    proposal: {
      proposes: 'edit',
      ...after,
      state: 'pending',
      ...(held ? { held } : {}),
      target: {
        id: memory.id,
        token: projectMemoryEditToken(memory, listed.superseded),
        pinned: memory.pinned,
        // Every id, listed or not, so a Save never drops one (PR #212 F-01); titles only for those listed.
        supersedes: [...memory.supersedes],
        ...(replaces.length > 0 ? { replaces } : {})
      },
      before
    },
    log: `Memory edit ${held ? `held (reason=${held}; ` : 'pending ('}target=${memory.id}; changes=${changed.join(',')}; ` +
      `operations=${edit.operations.map((operation) => operation.op).join(',')})`
  };
}
