/** Guard the four persona-facing numeric ceilings against prompt/validator drift. */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

describe('persona analysis prompt ↔ validator budgets', () => {
  it.each([
    ['excerpt', PROMPT_BUDGETS.personaExcerpt],
    ['context', PROMPT_BUDGETS.contextAttachments]
  ] as const)('quotes the current %s word and character ceilings', (slot, budget) => {
    const prompt = fs.readFileSync(path.resolve(__dirname,
      '../../../resources/system-prompts/workshop-personas/analysis-capability.md'), 'utf8');
    const match = new RegExp(`Persona-supplied ${slot} text may contain at most ([\\d,]+) words and ([\\d,]+) characters`).exec(prompt);
    expect(match).not.toBeNull();
    expect(Number(match![1].replace(/,/g, ''))).toBe(budget.words);
    expect(Number(match![2].replace(/,/g, ''))).toBe(budget.characters);
  });
});
