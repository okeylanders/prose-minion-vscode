import {
  workshopQuickActionPrompt,
  workshopQuickActionsForTool
} from '@shared/constants/workshopQuickActions';
import { WORKSHOP_TOOL_CATALOG } from '@shared/constants/workshopTools';

describe('workshopQuickActions', () => {
  it('defines non-empty actions with exactly one primary action for every Workshop tool', () => {
    for (const tool of WORKSHOP_TOOL_CATALOG) {
      const actions = workshopQuickActionsForTool(tool.id);

      expect(actions.length).toBeGreaterThan(0);
      expect(actions.filter((action) => action.primary)).toHaveLength(1);
      for (const action of actions) {
        expect(action.label).toEqual(expect.any(String));
        expect(action.prompt).toEqual(expect.any(String));
        expect(action.prompt.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('resolves every configured label to a prompt and rejects unknown labels', () => {
    for (const tool of WORKSHOP_TOOL_CATALOG) {
      for (const action of workshopQuickActionsForTool(tool.id)) {
        expect(workshopQuickActionPrompt(tool.id, action.label)).toBe(action.prompt);
      }
      expect(workshopQuickActionPrompt(tool.id, 'Generate another variation maybe')).toBeUndefined();
    }
  });

  it('keeps fallback variation prompts explicit instead of inferred from label text', () => {
    const fallbackOnlyTool = 'decision-points';
    expect(workshopQuickActionPrompt(fallbackOnlyTool, 'Generate 3 variations')).toContain(
      'Return exactly three options'
    );
    expect(workshopQuickActionPrompt(fallbackOnlyTool, 'Try another angle')).not.toContain(
      'Return exactly three options'
    );
  });
});
