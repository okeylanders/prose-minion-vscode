/**
 * Prompt-side input budgets.
 *
 * Keep static inference bounds here so every caller shares the same units and
 * provenance rules. User-configurable response limits remain settings-driven;
 * route-specific fixed ceilings live here with their corresponding inputs.
 * Batching and presentation-only limits do not belong in this table.
 */

export interface PromptBudgets {
  readonly fileExcerpt: Readonly<{ words: number; bytes: number }>;
  readonly personaExcerpt: Readonly<{ words: number; characters: number }>;
  readonly contextAttachments: Readonly<{
    words: number;
    characters: number;
    fileBytes: number;
  }>;
  readonly workshopCapability: Readonly<{
    wordCharacters: number;
    contextCharacters: number;
    purposeCharacters: number;
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
  readonly workshopTodos: Readonly<{
    items: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly guestJoinSnapshot: Readonly<{
    turns: number;
    characters: number;
    headerAllowanceCharacters: number;
  }>;
  readonly workshopRoom: Readonly<{
    gapMilliseconds: number;
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
  /**
   * Conversation Widgets (ADR 2026-07-22). Gesture Playground pre-commit
   * surface: caps on writer/persona-prefilled inputs, the recommendation
   * frame's syntax allowance, the writer-facing dictionary, the generated
   * menu accepted by fail-closed parsers, and what a commit may carry. The
   * exploration cloud stays in the re-openable config but is excluded from
   * the rail — only selections and the writer's note influence the turn.
   * Creative Variations adds bounded passage/context inputs, typed card and
   * risk fields, the complete provider envelope, and the compact artifact.
   */
  readonly workshopWidgets: Readonly<{
    gestureTargetPhraseCharacters: number;
    gestureWriterInstructionsCharacters: number;
    gestureContextCharacters: number;
    gestureCharacterNotesCharacters: number;
    gestureSourceReferences: number;
    gestureSourceReferenceCharacters: number;
    gestureReferencedSourceCharacters: number;
    gestureOutputTokens: number;
    gestureMoreOutputTokens: number;
    gestureRecommendationFrameAllowanceCharacters: number;
    gestureDictionaryCharacters: number;
    gestureNoteCharacters: number;
    gestureMenuGroupsMinimum: number;
    gestureMenuGroups: number;
    gestureOptionsPerGroupMinimum: number;
    /** Maximum options returned by one generation call. */
    gestureGeneratedOptionsPerGroup: number;
    /** Maximum accumulated options retained after "More gestures" merges. */
    gestureOptionsPerGroup: number;
    gestureOptionCharacters: number;
    gestureSelectionsPerCommit: number;
    creativeSubjectCharacters: number;
    creativeSubjectPreviewCharacters: number;
    creativeProvenancePathCharacters: number;
    /** Maximum surrounding context the writer may author or paste into the widget. */
    creativeContextCharacters: number;
    /** Maximum surrounding prose a persona may copy into a recommendation prefill. */
    creativeRecommendationContextCharacters: number;
    creativeSourceReferences: number;
    creativeSourceReferenceCharacters: number;
    creativeMustSurviveCharacters: number;
    creativeMustNotChangeCharacters: number;
    creativeAimCharacters: number;
    creativeNoteCharacters: number;
    creativeWorkupIdCharacters: number;
    creativeApproachCharacters: number;
    creativeDirectionCharacters: number;
    creativeProseCharacters: number;
    creativeTradeoffCharacters: number;
    creativeFlagsPerCard: number;
    creativeFlagNoteCharacters: number;
    creativeOutputTokens: number;
    creativeResponseCharacters: number;
    creativeArtifactCharacters: number;
    creativeRecommendationFrameAllowanceCharacters: number;
    lexicalRecommendationFrameCharacters: number;
    lexicalLensNameCharacters: number;
    lexicalLensSlugCharacters: number;
    lexicalLensVariantCharacters: number;
    lexicalLensDescriptionCharacters: number;
    lexicalLogicPremiseCharacters: number;
    lexicalAttentionItemsMinimum: number;
    lexicalAttentionItems: number;
    lexicalAttentionItemCharacters: number;
    lexicalLogicAxesMinimum: number;
    lexicalLogicAxes: number;
    lexicalLogicIdCharacters: number;
    lexicalLogicNameCharacters: number;
    lexicalAxisPoleCharacters: number;
    lexicalLogicRolesMinimum: number;
    lexicalLogicRoles: number;
    lexicalRoleDescriptionCharacters: number;
    lexicalLogicDynamicsMinimum: number;
    lexicalLogicDynamics: number;
    lexicalDynamicMovementCharacters: number;
    lexicalDynamicEntailmentCharacters: number;
    lexicalDynamicAffordanceCharacters: number;
    lexicalLogicGuardrailsMinimum: number;
    lexicalLogicGuardrails: number;
    lexicalGuardrailCharacters: number;
    lexicalTermCharacters: number;
    lexicalTermsPerBucket: number;
    lexicalGradientTerms: number;
    lexicalCliches: number;
    lexicalPhraseCharacters: number;
    lexicalSampleCharacters: number;
    lexicalBuildQueryCharacters: number;
    lexicalBuildCandidates: number;
    lexicalBuildOutputTokens: number;
    lexicalBuildResponseCharacters: number;
    lexicalPreviewCharacters: number;
    lexicalPreviewResponseCharacters: number;
    lexicalPreviewPositions: number;
    lexicalPreviewElementCharacters: number;
    lexicalPreviewAxisPositionCharacters: number;
    lexicalPreviewSignificanceCharacters: number;
    lexicalPreviewEntailmentCharacters: number;
    lexicalPreviewOutputTokens: number;
    lexicalDirectiveCharacters: number;
  }>;
}

export const PROMPT_BUDGETS: PromptBudgets = {
  fileExcerpt: { words: 25_000, bytes: 5 * 1024 * 1024 },
  personaExcerpt: { words: 25_000, characters: 300_000 },
  // Raised to 50k for long-form Workshop rooms (Okey 2026-07-26). Making this a user
  // setting is tracked in .todo/tech-debt/2026-07-17-context-attachment-budget-setting.md.
  contextAttachments: {
    words: 50_000,
    characters: 420_000,
    fileBytes: 5 * 1024 * 1024
  },
  workshopCapability: {
    wordCharacters: 100,
    contextCharacters: 4_000,
    purposeCharacters: 500,
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
  workshopTodos: { items: 12, characters: 12_000, headerAllowanceCharacters: 600 },
  guestJoinSnapshot: {
    turns: 100,
    characters: 100_000,
    headerAllowanceCharacters: 1_200
  },
  workshopRoom: {
    gapMilliseconds: 60 * 60 * 1_000
  },
  guestOpening: { characters: 2_000 },
  contextFiles: { words: 50_000, catalogItems: 100 },
  guides: { words: 50_000 },
  sourceDocument: { words: 50_000 },
  workshopToolCatalog: { neighborItems: 4, words: 50_000 },
  workshopThreadArtifacts: { itemsPerMessage: 3, words: 10_000 },
  workshopWidgets: {
    gestureTargetPhraseCharacters: 300,
    gestureWriterInstructionsCharacters: 1_000,
    gestureContextCharacters: 10_000,
    gestureCharacterNotesCharacters: 1_500,
    gestureSourceReferences: 8,
    gestureSourceReferenceCharacters: 500,
    gestureReferencedSourceCharacters: 420_000,
    gestureOutputTokens: 50_000,
    gestureMoreOutputTokens: 8_000,
    gestureRecommendationFrameAllowanceCharacters: 2_000,
    gestureDictionaryCharacters: 64_000,
    gestureNoteCharacters: 300,
    gestureMenuGroupsMinimum: 4,
    gestureMenuGroups: 6,
    gestureOptionsPerGroupMinimum: 3,
    gestureGeneratedOptionsPerGroup: 5,
    gestureOptionsPerGroup: 10,
    gestureOptionCharacters: 220,
    gestureSelectionsPerCommit: 8,
    creativeSubjectCharacters: 20_000,
    creativeSubjectPreviewCharacters: 160,
    creativeProvenancePathCharacters: 500,
    creativeContextCharacters: 250_000,
    creativeRecommendationContextCharacters: 20_000,
    creativeSourceReferences: 8,
    creativeSourceReferenceCharacters: 500,
    creativeMustSurviveCharacters: 2_000,
    creativeMustNotChangeCharacters: 2_000,
    creativeAimCharacters: 1_000,
    creativeNoteCharacters: 500,
    creativeWorkupIdCharacters: 64,
    creativeApproachCharacters: 160,
    creativeDirectionCharacters: 600,
    creativeProseCharacters: 20_000,
    creativeTradeoffCharacters: 400,
    creativeFlagsPerCard: 8,
    creativeFlagNoteCharacters: 400,
    creativeOutputTokens: 45_000,
    creativeResponseCharacters: 140_000,
    creativeArtifactCharacters: 20_000,
    creativeRecommendationFrameAllowanceCharacters: 2_500,
    lexicalRecommendationFrameCharacters: 1_000,
    lexicalLensNameCharacters: 80,
    lexicalLensSlugCharacters: 64,
    lexicalLensVariantCharacters: 120,
    lexicalLensDescriptionCharacters: 320,
    lexicalLogicPremiseCharacters: 400,
    lexicalAttentionItemsMinimum: 2,
    lexicalAttentionItems: 4,
    lexicalAttentionItemCharacters: 180,
    lexicalLogicAxesMinimum: 2,
    lexicalLogicAxes: 4,
    lexicalLogicIdCharacters: 64,
    lexicalLogicNameCharacters: 80,
    lexicalAxisPoleCharacters: 100,
    lexicalLogicRolesMinimum: 2,
    lexicalLogicRoles: 4,
    lexicalRoleDescriptionCharacters: 240,
    lexicalLogicDynamicsMinimum: 2,
    lexicalLogicDynamics: 4,
    lexicalDynamicMovementCharacters: 200,
    lexicalDynamicEntailmentCharacters: 360,
    lexicalDynamicAffordanceCharacters: 360,
    lexicalLogicGuardrailsMinimum: 2,
    lexicalLogicGuardrails: 4,
    lexicalGuardrailCharacters: 240,
    lexicalTermCharacters: 80,
    lexicalTermsPerBucket: 12,
    lexicalGradientTerms: 12,
    lexicalCliches: 8,
    lexicalPhraseCharacters: 240,
    lexicalSampleCharacters: 800,
    lexicalBuildQueryCharacters: 100,
    lexicalBuildCandidates: 3,
    lexicalBuildOutputTokens: 24_000,
    lexicalBuildResponseCharacters: 200_000,
    lexicalPreviewCharacters: 1_200,
    lexicalPreviewResponseCharacters: 12_000,
    lexicalPreviewPositions: 6,
    lexicalPreviewElementCharacters: 160,
    lexicalPreviewAxisPositionCharacters: 160,
    lexicalPreviewSignificanceCharacters: 320,
    lexicalPreviewEntailmentCharacters: 500,
    lexicalPreviewOutputTokens: 5_000,
    lexicalDirectiveCharacters: 16_000
  }
};
