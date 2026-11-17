/**
 * The Memory tab's "Suggest notes" row as drawn (Everyday Conveniences,
 * Round Two, item B): the closed list's three choices in its order, the one
 * the host holds selected, and the lines under them, with Save and tell me's
 * limit read from the budget.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { WORKSHOP_MEMORY_SUGGESTION_LEVELS } from '@shared/constants/workshopMemorySuggestions';
import { workshopMemorySuggestionsView } from '@hooks/domain/workshop/memory/workshopMemorySuggestionsView';

describe('workshopMemorySuggestionsView', () => {
  it('draws one card per level of the closed list, in its order, each named and described', () => {
    const view = workshopMemorySuggestionsView({ level: 'sparingly', mode: 'ask' });
    expect(view.cards.map((card) => card.level)).toEqual([...WORKSHOP_MEMORY_SUGGESTION_LEVELS]);
    expect(view.cards.map((card) => card.name)).toEqual(['Sparingly', 'Readily', 'Aggressively']);
    expect(view.cards.every((card) => card.description.length > 0)).toBe(true);
    expect(new Set(view.cards.map((card) => card.description)).size).toBe(3);
  });

  it.each([...WORKSHOP_MEMORY_SUGGESTION_LEVELS])('selects exactly the level the host holds (%s)', (level) => {
    const view = workshopMemorySuggestionsView({ level, mode: 'ask' });
    expect(view.cards.filter((card) => card.selected).map((card) => card.level)).toEqual([level]);
  });

  it('says Save and tell me\'s limit beside the choice, the number read from the budget', () => {
    const saves = PROMPT_BUDGETS.workshopProjectMemory.autoSavesPerRoom;
    for (const mode of ['ask', 'auto'] as const) {
      expect(workshopMemorySuggestionsView({ level: 'aggressively', mode }).notes).toEqual([
        `With Save and tell me, at most ${saves} notes are saved in one conversation; the rest wait as cards.`,
        'This choice is saved as soon as you make it, for all your projects.'
      ]);
    }
    expect(workshopMemorySuggestionsView({ level: 'readily', mode: 'auto', autoSavesPerRoom: 8 }).notes[0])
      .toBe('With Save and tell me, at most 8 notes are saved in one conversation; the rest wait as cards.');
    expect(workshopMemorySuggestionsView({ level: 'readily', mode: 'auto', autoSavesPerRoom: 1 }).notes[0])
      .toBe('With Save and tell me, at most 1 note is saved in one conversation; the rest wait as cards.');
  });

  it('with memory off, says first that nothing is suggested, and still shows the level', () => {
    const view = workshopMemorySuggestionsView({ level: 'readily', mode: 'off' });
    expect(view.notes[0]).toBe('Personas suggest no notes while project memory is off.');
    expect(view.notes).toHaveLength(3);
    expect(view.cards.find((card) => card.selected)?.level).toBe('readily');
  });
});
