/**
 * One memory edit per settlement verdict (ADR 2026-11-17 D13; PR #269
 * F-01): a trailer that decodes, and the listing it is settled against, so
 * that it ends with no card for exactly that reason. *Alice*, made-up ids.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import type { WorkshopMemoryEditDropReason } from '@/application/services/workshop/memory/WorkshopReplyMemoryEdit';
import { memory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

export const EDIT_NOTE = memory({ body: projectMemoryBody('Settled at the tea party. The reader notices before Alice does.') });

type Listing = ReturnType<typeof listProjectMemories>;

export const editFrame = (...elements: string[]): string =>
  `<prose-minion-memory-proposal>\n<edit>${EDIT_NOTE.id}</edit>\n${elements.join('\n')}\n</prose-minion-memory-proposal>`;

const REPLACE = ['<find-in-body>The reader</find-in-body>', '<replace-with>Alice</replace-with>'];

/** The note alone, readable and in effect. */
export const EDIT_NOTE_LISTED: Listing = listProjectMemories([{ memory: EDIT_NOTE }]);

const PINNED: Listing = listProjectMemories([
  { memory: { ...EDIT_NOTE, pinned: true } },
  ...Array.from({ length: 4 }, (_, i) => ({ memory: memory({ id: `mem-00000${i}`, pinned: true, body: projectMemoryBody('x '.repeat(3_000)) }) }))
]);

export interface MemoryEditDropCase {
  /** The verdict settlement returns, and the reason its log line says. */
  readonly reason: WorkshopMemoryEditDropReason;
  /** The edit's elements, inside its frame. */
  readonly elements: readonly string[];
  /** The listing it is settled against; undefined is a listing that could not be read. */
  readonly listing: Listing | undefined;
}

/** Every settlement verdict a trailer that decodes can reach. (`conflicting-operations` and the title and kind faults are refused by the decoder first.) */
export const MEMORY_EDIT_DROP_CASES: readonly MemoryEditDropCase[] = [
  { reason: 'listing-unread', elements: REPLACE, listing: undefined },
  { reason: 'unknown-target', elements: REPLACE, listing: listProjectMemories([{ memory: memory({ id: 'mem-000009' }) }]) },
  { reason: 'archived-target', elements: REPLACE, listing: listProjectMemories([{ memory: { ...EDIT_NOTE, status: 'archived' } }]) },
  {
    reason: 'superseded-target',
    elements: REPLACE,
    listing: listProjectMemories([{ memory: EDIT_NOTE }, { memory: memory({ id: 'mem-000002', supersedes: [EDIT_NOTE.id] }) }])
  },
  { reason: 'busy-target', elements: REPLACE, listing: listProjectMemories([{ memory: EDIT_NOTE, busy: true }]) },
  { reason: 'find-missing', elements: ['<find-in-body>the Queen</find-in-body>', '<replace-with>Alice</replace-with>'], listing: EDIT_NOTE_LISTED },
  { reason: 'find-ambiguous', elements: ['<find-in-body>ea</find-in-body>', '<replace-with>x</replace-with>'], listing: EDIT_NOTE_LISTED },
  {
    reason: 'replaces-overlap',
    elements: [
      '<find-in-body>The reader notices</find-in-body>', '<replace-with>a</replace-with>',
      '<find-in-body>notices before</find-in-body>', '<replace-with>b</replace-with>'
    ],
    listing: EDIT_NOTE_LISTED
  },
  {
    reason: 'summary-emptied',
    elements: [`<find-in-summary>${EDIT_NOTE.summary}</find-in-summary>`, '<replace-with></replace-with>'],
    listing: EDIT_NOTE_LISTED
  },
  {
    reason: 'summary-not-one-line',
    elements: ['<find-in-summary>chapter 3</find-in-summary>', '<replace-with>one\ntwo</replace-with>'],
    listing: EDIT_NOTE_LISTED
  },
  {
    reason: 'body-too-long',
    elements: [`<append>${'x'.repeat(PROMPT_BUDGETS.workshopProjectMemory.bodyCharacters)}</append>`],
    listing: EDIT_NOTE_LISTED
  },
  { reason: 'unchanged', elements: [`<title>${EDIT_NOTE.title}</title>`], listing: EDIT_NOTE_LISTED },
  { reason: 'pinned-budget', elements: [`<append>${'Tea. '.repeat(1_500)}</append>`], listing: PINNED }
];
