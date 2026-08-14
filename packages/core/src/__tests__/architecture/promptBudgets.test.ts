/** Guard the prompt-budget table against new module-local limit constants. */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS,
  WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION
} from '@/application/services/workshop/widgets/WorkshopWidgetRecommendationOperations';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const BUDGET_MODULE = path.join(SRC_ROOT, 'shared', 'constants', 'promptBudgets.ts');
const TEST_ROOT = path.join(SRC_ROOT, '__tests__');
const LOOKS_LIKE_LIMIT = /(?:^MAX(?:_|$)|_(?:MAX|LIMIT|CAP|CEILING|THRESHOLD)(?:_|$))/;

// Existing bounds that are explicitly not prompt truncation: provider
// concurrency, protocol tolerance, and bounded webview layout.
const NON_PROMPT_LIMITS = new Set([
  'infrastructure/api/orchestration/ResourceReadXmlCodec.ts:MAX_TOLERATED_PREAMBLE_CHARS',
  'infrastructure/api/services/dictionary/DictionaryService.ts:CONCURRENCY_LIMIT',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_WORDS_PER_BATCH',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_BIGRAMS_PER_BATCH',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_TRIGRAMS_PER_BATCH',
  'presentation/webview/components/tabs/AnalysisTab.tsx:MAX_EXCERPT_LENGTH',
  'presentation/webview/components/workshop/widgets/lexicalGravity/WorkshopLexicalGravityModal.tsx:PREVIEW_SOURCE_HEIGHT_CAP',
  'shared/types/messages/ui.ts:WEBVIEW_ERROR_TEXT_MAX'
]);

function collectTypeScriptFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full !== TEST_ROOT) {
        collectTypeScriptFiles(full, acc);
      }
    } else if (entry.isFile() && /\.tsx?$/.test(entry.name) && full !== BUDGET_MODULE) {
      acc.push(full);
    }
  }
  return acc;
}

function collectLimitDeclarationNames(source: string, fileName = 'prompt-budget-scan.ts'): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const declarations: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node))
      && ts.isIdentifier(node.name)
      && /^[A-Z][A-Z0-9_]*$/.test(node.name.text)
      && LOOKS_LIKE_LIMIT.test(node.name.text)) {
      declarations.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

describe('prompt budgets', () => {
  it('keeps the writer-selected Workshop room and standing-context bounds', () => {
    expect(PROMPT_BUDGETS.guestJoinSnapshot).toEqual({
      turns: 100,
      characters: 100_000,
      headerAllowanceCharacters: 1_200
    });
    expect(PROMPT_BUDGETS.contextAttachments.words).toBe(50_000);
  });

  it('keeps the locked Workshop capability ceilings in the shared table', () => {
    expect(PROMPT_BUDGETS.workshopCapability).toEqual({
      wordCharacters: 100,
      contextCharacters: 4_000,
      purposeCharacters: 500,
      callsPerTurn: 5,
      fullEntriesPerTurn: 1,
      analysisRunsPerTurn: 1
    });
    expect(PROMPT_BUDGETS.workshopResource).toEqual({
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
    });
  });

  it('pins the model-facing Conversation Widget budgets and aggregate frame ceiling', () => {
    expect(PROMPT_BUDGETS.workshopWidgets).toEqual({
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
      creativeContextCharacters: 20_000,
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
    });
    expect(WORKSHOP_WIDGET_RECOMMENDATION_FRAME_CHARACTERS).toBe(51_500);
  });

  it('pins the assembled recommendation instruction so prompt growth is reviewed explicitly', () => {
    expect(WORKSHOP_WIDGET_RECOMMENDATION_INSTRUCTION.length).toBe(7_823);
  });

  it('keeps Lexical Gravity Preview as two explicit application gears', () => {
    const buildPrompt = fs.readFileSync(
      path.resolve(
        SRC_ROOT,
        '..',
        'resources',
        'system-prompts',
        'lexical-gravity',
        '00-build-lens.md'
      ),
      'utf8'
    );
    const previewPrompt = fs.readFileSync(
      path.resolve(SRC_ROOT, '..', 'resources', 'system-prompts', 'lexical-gravity', '01-preview.md'),
      'utf8'
    );

    expect(previewPrompt).toContain('`interpret`: keep the source\'s beat order');
    expect(previewPrompt).toContain('`recompose`: use the semantic positions');
    expect(previewPrompt).toContain('do not preserve the source sentence-by-sentence');
    expect(previewPrompt).not.toContain('and sentence count');

    const budget = PROMPT_BUDGETS.workshopWidgets;
    for (const fragment of [
      `premise ≤ ${budget.lexicalLogicPremiseCharacters} characters`,
      `role description ≤ ${budget.lexicalRoleDescriptionCharacters} characters`,
      `sample ≤ ${budget.lexicalSampleCharacters} characters`
    ]) {
      expect(buildPrompt).toContain(fragment);
    }
    for (const fragment of [
      `0–${budget.lexicalPreviewPositions} semantic positions`,
      `element ≤ ${budget.lexicalPreviewElementCharacters} characters`,
      `text ≤ ${budget.lexicalPreviewCharacters} characters`
    ]) {
      expect(previewPrompt).toContain(fragment);
    }
  });

  it('declares every Creative Variations response ceiling to the model', () => {
    const prompt = fs.readFileSync(
      path.resolve(
        SRC_ROOT,
        '..',
        'resources',
        'system-prompts',
        'creative-variations',
        '00-creative-variations.md'
      ),
      'utf8'
    );
    const budget = PROMPT_BUDGETS.workshopWidgets;
    for (const fragment of [
      `\`approach\` ≤ ${budget.creativeApproachCharacters} characters`,
      `\`direction\` ≤ ${budget.creativeDirectionCharacters} characters`,
      `\`prose\` ≤ ${budget.creativeProseCharacters.toLocaleString('en-US')} characters`,
      `\`tradeoff.gain\` and \`tradeoff.cost\` ≤ ${budget.creativeTradeoffCharacters} characters each`,
      `At most ${budget.creativeFlagsPerCard} \`invariantFlags\` per card`,
      `flag \`note\` ≤ ${budget.creativeFlagNoteCharacters} characters`
    ]) {
      expect(prompt).toContain(fragment);
    }
    expect(prompt).toContain("Target 60–100% of the subject's length");
  });

  it('recognizes mutable, field, and suffix-style budget declarations', () => {
    const source = [
      'let MAX_WORDS = 10;',
      'const PERSONA_BRIEF_MAX = 500;',
      'const CONTEXT_CAP = 100;',
      'class Limits {',
      '  private static MAX_ITEMS = 5;',
      '  readonly TOKEN_CEILING = 20;',
      '  public BATCH_THRESHOLD = 3;',
      '}'
    ].join('\n');
    const declarations = collectLimitDeclarationNames(source);

    expect(declarations).toEqual([
      'MAX_WORDS',
      'PERSONA_BRIEF_MAX',
      'CONTEXT_CAP',
      'MAX_ITEMS',
      'TOKEN_CEILING',
      'BATCH_THRESHOLD'
    ]);
  });

  it('keeps prompt-side max and limit constants in the central budget table', () => {
    const offenders = collectTypeScriptFiles(SRC_ROOT).flatMap((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const declarations = collectLimitDeclarationNames(source, file);
      return declarations
        .map(name => `${path.relative(SRC_ROOT, file)}:${name}`)
        .filter(witness => !NON_PROMPT_LIMITS.has(witness));
    });

    expect(offenders).toEqual([]);
  });
});
