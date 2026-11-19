/**
 * The Memory tab's "List at the start of each conversation" row as drawn
 * (Everyday Conveniences, Round Two, item C; ADR 2026-11-17 D9, D12). Pure:
 * the size the host holds in; the three choices and the line under them
 * out.
 *
 * - The choices are the closed table's, in its order, and every token
 *   figure is read from that table, never a literal; a test holds the two
 *   together.
 * - The row saves at once, so it is never a draft, and it never rebuilds an
 *   open conversation's list: the note says when the choice applies.
 */

import {
  WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS,
  WORKSHOP_PROJECT_MEMORY_LIST_SIZES,
  type WorkshopProjectMemoryListSize
} from '@shared/constants/workshopProjectMemoryListSizes';
import { memoryCount } from './workshopMemoryWords';

export interface WorkshopMemoryListSizeCard {
  readonly size: WorkshopProjectMemoryListSize;
  readonly name: string;
  readonly description: string;
  readonly selected: boolean;
}

export interface WorkshopMemoryListSizeView {
  readonly label: string;
  readonly cards: readonly WorkshopMemoryListSizeCard[];
  /** The lines under the cards, in order. */
  readonly notes: readonly string[];
}

export const WORKSHOP_MEMORY_LIST_SIZE_LABEL = 'List at the start of each conversation';
export const WORKSHOP_MEMORY_LIST_SIZE_APPLIES = 'Applies from the next conversation.';

const NAMES: Readonly<Record<WorkshopProjectMemoryListSize, string>> = {
  standard: 'Standard',
  larger: 'Larger',
  largest: 'Largest'
};

export function workshopMemoryListSizeView(size: WorkshopProjectMemoryListSize): WorkshopMemoryListSizeView {
  return {
    label: WORKSHOP_MEMORY_LIST_SIZE_LABEL,
    cards: WORKSHOP_PROJECT_MEMORY_LIST_SIZE_IDS.map((id) => {
      const row = WORKSHOP_PROJECT_MEMORY_LIST_SIZES[id];
      return {
        size: id,
        name: NAMES[id],
        description: `Up to ${memoryCount(row.catalogTokens)} tokens of titles and summaries, then up to ${memoryCount(row.titleTokens)} of titles alone.`,
        selected: id === size
      };
    }),
    notes: [
      WORKSHOP_MEMORY_LIST_SIZE_APPLIES,
      'An open conversation keeps the list it started with. This choice is saved as soon as you make it, for all your projects.'
    ]
  };
}
