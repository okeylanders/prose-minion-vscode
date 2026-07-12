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

export const PROMPT_BUDGETS: PromptBudgets = {
  fileExcerpt: { words: 10_000, bytes: 5 * 1024 * 1024 },
  personaExcerpt: { words: 10_000 },
  contextBrief: { words: 10_000 },
  toolEvidence: { characters: 50_000 },
  directHandoff: {
    turns: 8,
    characters: 20_000,
    headerAllowanceCharacters: 800
  },
  contextFiles: { words: 50_000, catalogItems: 100 },
  guides: { words: 50_000 },
  sourceDocument: { words: 50_000 }
};
