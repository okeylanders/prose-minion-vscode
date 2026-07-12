/**
 * Prompt-side input budgets.
 *
 * Keep static prompt bounds here so every caller shares the same units and
 * provenance rules. Response token limits remain settings-driven and batching
 * or presentation-only limits do not belong in this table.
 */

export interface PromptBudgets {
  readonly fileExcerpt: Readonly<{ words: number; bytes: number }>;
  readonly personaExcerpt: Readonly<{ words: number }>;
  readonly contextBrief: Readonly<{ words: number }>;
  readonly toolEvidence: Readonly<{ characters: number }>;
  readonly directHandoff: Readonly<{
    turns: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly contextFiles: Readonly<{ words: number; catalogItems: number }>;
  readonly guides: Readonly<{ words: number }>;
  readonly sourceDocument: Readonly<{ words: number }>;
}

export const PROMPT_BUDGETS: PromptBudgets = Object.freeze({
  fileExcerpt: Object.freeze({ words: 10_000, bytes: 5 * 1024 * 1024 }),
  personaExcerpt: Object.freeze({ words: 10_000 }),
  contextBrief: Object.freeze({ words: 10_000 }),
  toolEvidence: Object.freeze({ characters: 50_000 }),
  directHandoff: Object.freeze({
    turns: 8,
    characters: 20_000,
    headerAllowanceCharacters: 800
  }),
  contextFiles: Object.freeze({ words: 50_000, catalogItems: 100 }),
  guides: Object.freeze({ words: 50_000 }),
  sourceDocument: Object.freeze({ words: 50_000 })
});
