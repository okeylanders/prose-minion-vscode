/**
 * Passage Search engine (ADR 2026-11-20 D1): the two directories that hold
 * it name no caller. Neither imports or names the Workshop, the Lightbox, a
 * handler, `presentation/`, a persona or the sidebar's messages; each may
 * import only what D1 lists; their module lists are closed; every module
 * stays under 500 lines; and the composition root alone builds the engine,
 * on the manager's own `passageSearch` scope.
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');
const SERVICE_DIR = path.join(SRC_ROOT, 'infrastructure', 'api', 'services', 'search', 'passage');
const ENGINE_DIR = path.join(SRC_ROOT, 'application', 'services', 'passageSearch');
const EXTENSION = path.resolve(SRC_ROOT, '../../../apps/vscode-extension/src/extension.ts');

/** Closed: a new module joins its list on purpose. */
const PASSAGE_SEARCH_MODULES = {
  service: [
    'PassageSearchContracts.ts',
    'PassageSearchInstances.ts',
    'PassageSearchMessages.ts',
    'PassageSearchOrganizer.ts',
    'PassageSearchPlanning.ts',
    'PassageSearchPrices.ts',
    'PassageSearchRefusals.ts',
    'PassageSearchReplyCodec.ts',
    'PassageSearchService.ts',
    'passageChunks.ts'
  ],
  engine: [
    'PassageSearchEngine.ts',
    'PassageSearchRequest.ts',
    'PassageSearchScopeFiles.ts'
  ]
} as const;

/** What the model work may import: its own modules, the shared chunk, anchor and sentence rules, the parser, the run engine, prompts, ports and shared types. */
const SERVICE_ALLOWED_IMPORTS = [
  '@services/search/passage/',
  '@/utils/draftEdit/chunkParagraphs',
  '@/utils/draftEdit/anchorEdits',
  '@/tools/measure/passageProseStats',
  '@/utils/textUtils',
  '@/utils/tokenUsage',
  '@parsers/',
  '@orchestration/',
  '@providers/OpenRouterModels',
  '@providers/OpenRouterChatContracts',
  '@/tools/shared/prompts',
  '@/platform',
  '@messages',
  '@shared/',
  'p-limit',
  'crypto'
];

/** What the engine may import beside the model work: the context resolver's listing, the pattern safety rule, the ports, natural order and shared types. */
const ENGINE_ALLOWED_IMPORTS = [
  '@services/search/passage/',
  '@/application/services/passageSearch/',
  '@/application/services/contextPaths/ContextPathPatternSafety',
  '@/domain/models/ContextGeneration',
  '@/infrastructure/context/',
  '@/utils/configuredResourcePath',
  '@/utils/naturalOrder',
  '@/platform',
  '@messages',
  '@shared/'
];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const importsOf = (source: string): string[] => [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
const read = (file: string): string => fs.readFileSync(file, 'utf8');

describe('Passage Search engine', () => {
  const service = sourceFiles(SERVICE_DIR);
  const engine = sourceFiles(ENGINE_DIR);
  const all = [...service, ...engine];

  it('lists its modules, each under 500 lines', () => {
    expect(service.map((file) => path.relative(SERVICE_DIR, file)).sort()).toEqual([...PASSAGE_SEARCH_MODULES.service].sort());
    expect(engine.map((file) => path.relative(ENGINE_DIR, file)).sort()).toEqual([...PASSAGE_SEARCH_MODULES.engine].sort());
    for (const file of all) {
      expect([path.basename(file), read(file).split('\n').length < 500]).toEqual([path.basename(file), true]);
    }
  });

  it('imports no Workshop, Lightbox, handler, presentation, persona or sidebar-message module', () => {
    const feature = /workshop|lightbox|persona|handlers?\/|presentation|messages\/search|draftEdit\/(?!chunkParagraphs|anchorEdits)/i;
    const offenders = all.flatMap((file) => importsOf(read(file))
      .filter((module) => feature.test(module))
      .map((module) => `${path.basename(file)} -> ${module}`));
    expect(offenders).toEqual([]);
  });

  it('names none of them either, in code or in a comment', () => {
    const named = /workshop|lightbox|persona|\b\w*Handler\b|presentation\/|sidebar|webview|MessageType|SearchSubtool/i;
    const offenders = all.flatMap((file) => read(file).split('\n')
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => named.test(line))
      .map(({ index }) => `${path.basename(file)}:${index + 1}`));
    expect(offenders).toEqual([]);
  });

  it('imports only what the decision lists, with no relative import', () => {
    const outside = (files: string[], allowed: readonly string[]): string[] => files.flatMap((file) => importsOf(read(file))
      .filter((module) => !allowed.some((prefix) => module === prefix || module.startsWith(prefix)))
      .map((module) => `${path.basename(file)} -> ${module}`));
    expect(outside(service, SERVICE_ALLOWED_IMPORTS)).toEqual([]);
    expect(outside(engine, ENGINE_ALLOWED_IMPORTS)).toEqual([]);
    // Infrastructure never imports up into the application layer.
    expect(service.flatMap((file) => importsOf(read(file)).filter((module) => module.startsWith('@/application/')))).toEqual([]);
    expect(all.flatMap((file) => importsOf(read(file)).filter((module) => module.startsWith('.')))).toEqual([]);
  });

  it('never imports `vscode`', () => {
    expect(all.filter((file) => /from\s+'vscode'/.test(read(file)))).toEqual([]);
  });

  it('is built only at the composition root, once, on the manager\'s own passageSearch scope', () => {
    const builders = /\bnew\s+(PassageSearchService|PassageSearchScopeFiles|ProjectPassageSearchEngine)\s*\(/;
    const inCore = sourceFiles(SRC_ROOT)
      .filter((file) => !path.relative(SRC_ROOT, file).startsWith('__tests__'))
      .filter((file) => builders.test(read(file)))
      .map((file) => path.relative(SRC_ROOT, file));
    expect(inCore).toEqual([]);
    const root = read(EXTENSION);
    for (const builder of ['ProjectPassageSearchEngine', 'PassageSearchScopeFiles', 'PassageSearchService']) {
      expect(root.match(new RegExp(`new ${builder}\\(`, 'g'))).toHaveLength(1);
    }
    expect(root).toMatch(/const coreServices: CoreServices = \{[\s\S]*?\bpassageSearchEngine,/);
    expect(read(path.join(SRC_ROOT, 'infrastructure/api/orchestration/AIResourceManager.ts')))
      .toMatch(/this\.createResourceBundle\(apiKey!, 'passageSearch', passageSearchModel\)/);
    expect(read(path.join(SERVICE_DIR, 'PassageSearchService.ts'))).toMatch(/PASSAGE_SEARCH_MODEL_SCOPE = 'passageSearch'/);
  });

  it('sends no reasoning setting, and every call names the plan\'s model', () => {
    const source = read(path.join(SERVICE_DIR, 'PassageSearchService.ts'));
    expect(source).not.toMatch(/reasoning\s*:/);
    expect(source).toMatch(/model: plan\.model,/);
    expect(source).toMatch(/policy: AGENT_RUN_POLICIES\.passageSearch/);
    expect(source).toMatch(/temperature: 0,/);
  });

  it('logs no message of an error, which may quote a path or the writer\'s text', () => {
    for (const file of all) {
      expect([path.basename(file), /appendLine\([^)]*\.message/.test(read(file))]).toEqual([path.basename(file), false]);
    }
  });
});
