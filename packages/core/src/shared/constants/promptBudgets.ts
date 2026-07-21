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
  readonly contextAttachments: Readonly<{ words: number; fileBytes: number }>;
  readonly workshopCapability: Readonly<{
    wordCharacters: number;
    contextCharacters: number;
    purposeCharacters: number;
    instructionsCharacters: number;
    callsPerTurn: number;
    fullEntriesPerTurn: number;
    analysisRunsPerTurn: number;
  }>;
  readonly workshopResource: Readonly<{
    queryCharacters: number;
    pathCharacters: number;
    catalogItems: number;
    searchFiles: number;
    searchMatches: number;
    searchContextLines: number;
    searchFileBytes: number;
    searchTotalBytes: number;
    readDefaultLines: number;
    readSourceBytes: number;
    readBytes: number;
  }>;
  readonly toolEvidence: Readonly<{ characters: number }>;
  readonly workshopTodos: Readonly<{
    items: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly directHandoff: Readonly<{
    turns: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly guestJoinSnapshot: Readonly<{
    turns: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly guestCatchUp: Readonly<{
    turns: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly guestOpening: Readonly<{ characters: number }>;
  readonly contextFiles: Readonly<{ words: number; catalogItems: number }>;
  readonly guides: Readonly<{ words: number }>;
  readonly sourceDocument: Readonly<{ words: number }>;
  /**
   * Workshop tool initial runs' composite catalog (Sprint 12 Phase 6): the
   * excerpt's configured source resource plus at most `neighborItems`
   * same-group neighbors, with one combined evidence word cap across
   * everything a run loads.
   */
  readonly workshopToolCatalog: Readonly<{ neighborItems: number; words: number }>;
  /**
   * One-shot writer message attachments (Sprint 12 Phase 6B; ADR 2026-07-18
   * thread-artifacts). Per-artifact head-slice word cap and a per-message
   * item cap — thread artifacts ride one turn and have NO standing budget.
   */
  readonly workshopThreadArtifacts: Readonly<{ itemsPerMessage: number; words: number }>;
}

export const PROMPT_BUDGETS: PromptBudgets = {
  fileExcerpt: { words: 10_000, bytes: 5 * 1024 * 1024 },
  personaExcerpt: { words: 10_000 },
  // Sprint 12 interim bump (10k → 35k, Okey 2026-07-17). Making this a user
  // setting is tracked in .todo/tech-debt/2026-07-17-context-attachment-budget-setting.md.
  contextAttachments: { words: 35_000, fileBytes: 5 * 1024 * 1024 },
  workshopCapability: {
    wordCharacters: 100,
    contextCharacters: 4_000,
    purposeCharacters: 500,
    instructionsCharacters: 1_000,
    callsPerTurn: 5,
    fullEntriesPerTurn: 1,
    analysisRunsPerTurn: 1
  },
  workshopResource: {
    queryCharacters: 200,
    pathCharacters: 500,
    catalogItems: 100,
    searchFiles: 100,
    searchMatches: 20,
    searchContextLines: 1,
    searchFileBytes: 256 * 1024,
    searchTotalBytes: 2 * 1024 * 1024,
    readDefaultLines: 400,
    readSourceBytes: 2 * 1024 * 1024,
    readBytes: 64 * 1024
  },
  toolEvidence: { characters: 50_000 },
  workshopTodos: { items: 12, characters: 12_000, headerAllowanceCharacters: 600 },
  directHandoff: {
    turns: 8,
    characters: 20_000,
    headerAllowanceCharacters: 800
  },
  guestJoinSnapshot: {
    turns: 20,
    characters: 24_000,
    headerAllowanceCharacters: 1_200
  },
  guestCatchUp: {
    turns: 8,
    characters: 20_000,
    headerAllowanceCharacters: 800
  },
  guestOpening: { characters: 2_000 },
  contextFiles: { words: 50_000, catalogItems: 100 },
  guides: { words: 50_000 },
  sourceDocument: { words: 50_000 },
  workshopToolCatalog: { neighborItems: 4, words: 50_000 },
  workshopThreadArtifacts: { itemsPerMessage: 3, words: 10_000 }
};
