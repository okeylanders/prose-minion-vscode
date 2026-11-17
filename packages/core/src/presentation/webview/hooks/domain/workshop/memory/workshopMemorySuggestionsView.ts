/**
 * The Memory tab's "Suggest notes" row as drawn (Everyday Conveniences,
 * Round Two, item B). Pure: the level the host holds and the mode draft in;
 * the three choices and the lines under them out.
 *
 * - The choices are the closed list's, in its order; a test holds the two
 *   together.
 * - The line about Save and tell me reads its number from the budget, never
 *   a literal: that mode stops saving at `autoSavesPerRoom` a conversation
 *   and holds the rest as cards, whatever the level.
 * - Off is said, never enforced here: the level is global and independent
 *   of the mode, so the mode never disables the row.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_MEMORY_SUGGESTION_LEVELS,
  type WorkshopMemorySuggestionLevel
} from '@shared/constants/workshopMemorySuggestions';
import type { WorkshopProjectMemoryMode } from './workshopMemoryViewInputs';

export interface WorkshopMemorySuggestionsInput {
  /** The level as the host holds it: this row saves at once, so it is never a draft. */
  readonly level: WorkshopMemorySuggestionLevel;
  /** The mode draft the cards above show. */
  readonly mode: WorkshopProjectMemoryMode;
  /** How many notes Save and tell me saves in one conversation; the budget's unless a test says otherwise. */
  readonly autoSavesPerRoom?: number;
}

export interface WorkshopMemorySuggestionCard {
  readonly level: WorkshopMemorySuggestionLevel;
  readonly name: string;
  readonly description: string;
  readonly selected: boolean;
}

export interface WorkshopMemorySuggestionsView {
  readonly cards: readonly WorkshopMemorySuggestionCard[];
  /** The lines under the cards, in order. */
  readonly notes: readonly string[];
}

const WORDS: Readonly<Record<WorkshopMemorySuggestionLevel, { readonly name: string; readonly description: string }>> = {
  sparingly: {
    name: 'Sparingly',
    description: 'Only what will matter later. Most replies suggest none.'
  },
  readily: {
    name: 'Readily',
    description: 'Whenever something worth keeping comes up, small things included.'
  },
  aggressively: {
    name: 'Aggressively',
    description: 'Anything a later conversation might want. You dismiss what you don’t need.'
  }
};

export function workshopMemorySuggestionsView(input: WorkshopMemorySuggestionsInput): WorkshopMemorySuggestionsView {
  const saves = input.autoSavesPerRoom ?? PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom;
  return {
    cards: WORKSHOP_MEMORY_SUGGESTION_LEVELS.map((level) => ({ level, ...WORDS[level], selected: level === input.level })),
    notes: [
      ...(input.mode === 'off' ? ['Personas suggest no notes while project memory is off.'] : []),
      `With Save and tell me, at most ${saves} ${saves === 1 ? 'note is' : 'notes are'} saved in one conversation; the rest wait as cards.`,
      'This choice is saved as soon as you make it, for all your projects.'
    ]
  };
}
