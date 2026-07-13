/** Guard the prompt-budget table against new module-local limit constants. */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';

const SRC_ROOT = path.resolve(__dirname, '..', '..');
const BUDGET_MODULE = path.join(SRC_ROOT, 'shared', 'constants', 'promptBudgets.ts');
const TEST_ROOT = path.join(SRC_ROOT, '__tests__');
const LOOKS_LIKE_LIMIT = /(?:^MAX(?:_|$)|_(?:MAX|LIMIT|CAP|CEILING|THRESHOLD)(?:_|$))/;

// Existing bounds that are explicitly not prompt truncation: provider
// concurrency and the webview-safe error display cap.
const NON_PROMPT_LIMITS = new Set([
  'infrastructure/api/orchestration/ResourceReadXmlCodec.ts:MAX_TOLERATED_PREAMBLE_CHARS',
  'infrastructure/api/services/dictionary/DictionaryService.ts:CONCURRENCY_LIMIT',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_WORDS_PER_BATCH',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_BIGRAMS_PER_BATCH',
  'infrastructure/api/services/search/CategorySearchService.ts:MAX_TRIGRAMS_PER_BATCH',
  'presentation/webview/components/tabs/AnalysisTab.tsx:MAX_EXCERPT_LENGTH',
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
  it('keeps the locked Workshop capability ceilings in the shared table', () => {
    expect(PROMPT_BUDGETS.workshopCapability).toEqual({
      wordCharacters: 100,
      contextCharacters: 4_000,
      purposeCharacters: 500,
      instructionsCharacters: 1_000,
      callsPerTurn: 3,
      fullEntriesPerTurn: 1,
      analysisRunsPerTurn: 1
    });
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
