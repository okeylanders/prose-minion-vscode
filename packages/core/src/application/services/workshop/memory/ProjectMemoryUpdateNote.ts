/**
 * The `<project-memory-update>` note (ADR 2026-11-04 D14): the delta from
 * what a conversation was told to the memories in effect now. Pure, and
 * rendered with the frame's own element renderers and estimator.
 *
 * - An id that is new, or whose version moved, is an `<entry>`, or a
 *   `<pinned>` with its whole body when it is pinned.
 * - An id the conversation was told of that is no longer in effect is a
 *   `<gone>` with its reason: archived, superseded by …, or no longer among
 *   the project's notes (its file was deleted, or no longer reads).
 * - Held to the frame's budgets: pinned bodies within `pinnedTokens`, entries
 *   and gone lines within `catalogTokens`. Past either, the note is the one
 *   count line pointing at `memory.catalog`; its snapshot still records the
 *   whole set, so the same changes are never announced twice.
 * - Nothing changed means no note.
 */

import { estimateTextTokens } from '@orchestration/RequestContextPreflight';
import {
  compareProjectMemoryOldestCreated,
  PROJECT_MEMORY_FRAME_BUDGETS,
  projectMemoryEntryLine,
  projectMemoryPinnedLine,
  projectMemorySnapshot,
  type ProjectMemoryFrameBudgets
} from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import {
  compareProjectMemoryNewestFirst,
  isProjectMemoryInEffect,
  type ProjectMemorySet
} from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import type { ProjectMemoryDeliveredView } from '@/application/services/workshop/memory/ProjectMemoryDeliveredView';
import { escapeProjectMemoryXml } from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import { workshopProjectMemorySetDigest } from '@/application/services/workshop/session/WorkshopProjectMemoryDeliveryRecords';

export const PROJECT_MEMORY_UPDATE_NOTE =
  'Changes to this project\'s notes since this conversation last saw them. A later entry replaces an earlier entry ' +
  'with the same id, and a gone note is no longer in effect; the same framing as project-memory applies.';

export interface ProjectMemoryUpdate {
  /** The note, or undefined when nothing changed. */
  readonly text?: string;
  /** What the conversation has now been told: every memory in effect, by id. */
  readonly snapshot: Array<{ id: string; version: string }>;
  /** How many memories changed; the count line names it when the note is over budget. */
  readonly changed: number;
  readonly overBudget: boolean;
}

export function renderProjectMemoryUpdateNote(
  view: ProjectMemoryDeliveredView,
  set: ProjectMemorySet,
  budgets: ProjectMemoryFrameBudgets = PROJECT_MEMORY_FRAME_BUDGETS
): ProjectMemoryUpdate {
  const snapshot = projectMemorySnapshot(set);
  if (view.digest) {
    // A set too large to list was recorded whole as a digest (PR #198 F-03):
    // the same set sends nothing; any change is the count line, from the catalog.
    const current = workshopProjectMemorySetDigest(snapshot);
    if (current.count === view.digest.count && current.hash === view.digest.hash) {
      return { snapshot, changed: 0, overBudget: false };
    }
    return {
      text: `<project-memory-update note="${escapeProjectMemoryXml(PROJECT_MEMORY_UPDATE_NOTE)}">This project's notes changed ` +
        'since this conversation last saw them; call memory.catalog.</project-memory-update>',
      snapshot,
      changed: Math.abs(current.count - view.digest.count) || 1,
      overBudget: true
    };
  }
  const changed = set.memories.filter((listed) => isProjectMemoryInEffect(listed) && view.memories.get(listed.memory.id) !== listed.version);
  const inEffect = new Set(snapshot.map(({ id }) => id));
  const gone = [...view.memories.keys()].filter((id) => !inEffect.has(id)).sort();
  const count = changed.length + gone.length;
  if (count === 0) {
    return { snapshot, changed: 0, overBudget: false };
  }

  const pinnedLines = changed.filter(({ memory }) => memory.pinned).sort(compareProjectMemoryOldestCreated).map(projectMemoryPinnedLine);
  const entryLines = changed.filter(({ memory }) => !memory.pinned).sort(compareProjectMemoryNewestFirst)
    .map((listed) => projectMemoryEntryLine(listed, false));
  const byId = new Map(set.memories.map((listed) => [listed.memory.id, listed]));
  const goneLines = gone.map((id) => `<gone id="${escapeProjectMemoryXml(id)}">No longer in effect: ${goneReason(byId.get(id))}</gone>`);
  const tokens = (lines: readonly string[]) => lines.reduce((total, line) => total + estimateTextTokens(line), 0);
  const overBudget = tokens(pinnedLines) > budgets.pinnedTokens || tokens([...entryLines, ...goneLines]) > budgets.catalogTokens;
  const open = `<project-memory-update note="${escapeProjectMemoryXml(PROJECT_MEMORY_UPDATE_NOTE)}"`;
  const text = overBudget
    ? `${open} count="${count}">${count} ${count === 1 ? 'memory' : 'memories'} changed since this conversation last saw them; ` +
      'call memory.catalog.</project-memory-update>'
    : [`${open}>`, ...[...pinnedLines, ...entryLines, ...goneLines].map((line) => `  ${line}`), '</project-memory-update>'].join('\n');
  return { text, snapshot, changed: count, overBudget };
}

function goneReason(listed: ProjectMemorySet['memories'][number] | undefined): string {
  if (!listed) {
    return 'it is no longer among this project\'s notes.';
  }
  if (listed.memory.status === 'archived') {
    return 'archived.';
  }
  return listed.supersededBy.length > 0 ? `superseded by ${listed.supersededBy.join(', ')}.` : 'no longer in effect.';
}
