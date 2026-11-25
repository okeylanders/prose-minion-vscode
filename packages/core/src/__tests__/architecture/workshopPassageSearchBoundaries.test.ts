/**
 * A persona's passage search (ADR 2026-11-20 D16–D21): its Workshop modules
 * are a closed list, each under 500 lines, importing nothing of recall,
 * memory or the lens library; no Workshop module builds a writer-typed
 * `pattern` scope; the engine's result is read in one module; the run
 * engine names nothing of it; and the engine's own directories still name
 * nothing of the Workshop (`passageSearchBoundaries.test.ts` holds that).
 */
import * as fs from 'fs';
import * as path from 'path';

const SRC_ROOT = path.resolve(__dirname, '../..');
const FAMILY_ROOT = path.join(SRC_ROOT, 'application', 'services', 'workshop', 'passageSearch');

/** Closed: a new module joins on purpose. */
const WORKSHOP_PASSAGE_SEARCH_MODULES = [
  'WorkshopPassageSearchCoverage.ts',
  'WorkshopPassageSearchDirective.ts',
  'WorkshopPassageSearchEngineRequest.ts',
  'WorkshopPassageSearchRecords.ts',
  'WorkshopPassageSearchStatus.ts',
  'WorkshopReplyPassageSearch.ts'
];

/** Every other module of the feature, host and webview. */
const FEATURE_FILES = [
  'application/handlers/domain/workshop/WorkshopPassageSearchHandler.ts',
  'application/handlers/domain/workshop/WorkshopPassageSearchDelivery.ts',
  'application/handlers/domain/workshop/WorkshopPassageSearchResultView.ts',
  'application/handlers/domain/workshop/WorkshopPassageSearchRunSlot.ts',
  'utils/workshopReplyPassageSearch.ts',
  'shared/constants/workshopPassageSearchWords.ts',
  // ADR 2026-11-20 S45: where a card looks, a narrowed group with its patterns, for the card and the directive.
  'shared/utils/workshopPassageSearchPlaces.ts',
  'shared/types/messages/workshop/passageSearch.ts',
  'infrastructure/api/orchestration/ConversationWindowMeasure.ts',
  'presentation/webview/hooks/domain/workshop/useWorkshopPassageSearch.ts',
  'presentation/webview/components/workshop/passageSearch/WorkshopPassageSearchCard.tsx',
  'presentation/webview/components/workshop/passageSearch/useWorkshopPassageSearchControls.ts'
];

function sourceFiles(root: string): string[] {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sourceFiles(full);
    }
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const read = (file: string): string => fs.readFileSync(file, 'utf8');
const importsOf = (source: string): string[] => [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1]);
const relative = (file: string): string => path.relative(SRC_ROOT, file).split(path.sep).join('/');

describe('Workshop passage search', () => {
  const family = sourceFiles(FAMILY_ROOT);
  const feature = [...family, ...FEATURE_FILES.map((file) => path.join(SRC_ROOT, file))];

  it('lists its modules, each under 500 lines', () => {
    expect(family.map((file) => path.basename(file)).sort()).toEqual(WORKSHOP_PASSAGE_SEARCH_MODULES);
    for (const file of feature) {
      expect([relative(file), read(file).split('\n').length <= 500]).toEqual([relative(file), true]);
    }
  });

  it('imports nothing of recall, memory or the lens library, and no relative path', () => {
    const offenders = feature.flatMap((file) => importsOf(read(file))
      // The message contracts and a component's own folder import by relative path, as their neighbours do.
      .filter((module) => /\/(?:recall|memory|lens)\//.test(module)
        || (module.startsWith('.') && !/[\\/](?:presentation|shared[\\/]types[\\/]messages)[\\/]/.test(file)))
      .map((module) => `${relative(file)} -> ${module}`));
    expect(offenders).toEqual([]);
  });

  it('builds no `pattern` scope anywhere in the Workshop: a persona\'s words never become a path or a glob', () => {
    const workshop = sourceFiles(SRC_ROOT).filter((file) => /workshop/i.test(relative(file)));
    const offenders = workshop
      .filter((file) => /kind:\s*['"]pattern['"]|writerTyped/.test(read(file)))
      .map(relative);
    expect(offenders).toEqual([]);
    // The one place a card becomes the engine's request builds exactly three kinds.
    const builder = read(path.join(FAMILY_ROOT, 'WorkshopPassageSearchEngineRequest.ts'));
    expect([...builder.matchAll(/kind: '([a-z-]+)'/g)].map((match) => match[1]).sort()).toEqual(['file', 'group', 'text']);
    // And the trailer's codec reads no element that could carry one.
    expect(read(path.join(SRC_ROOT, 'utils', 'workshopReplyPassageSearch.ts')))
      .toContain("export const WORKSHOP_PASSAGE_SEARCH_ELEMENTS = ['question', 'group', 'path', 'excerpt'] as const;");
  });

  it('reads the engine\'s result in one module', () => {
    const readers = sourceFiles(path.join(SRC_ROOT, 'application'))
      .filter((file) => /workshop/i.test(relative(file)))
      // The directive and the report render the display-safe value that module returns, never the engine's result.
      .filter((file) => /\bPassageSearchResult\b/.test(read(file)))
      .filter((file) => /\bresult\.(?:instances|labels|calls|files|ended|analysis|dropped|overLimit)\b/.test(read(file)))
      .map(relative);
    // None reads a field of it: the one module that takes it hands it to the shared view.
    expect(readers).toEqual([]);
    const takers = sourceFiles(path.join(SRC_ROOT, 'application'))
      .filter((file) => /workshop/i.test(relative(file)))
      .filter((file) => /passageSearchResultView\(/.test(read(file)))
      .map(relative);
    expect(takers).toEqual(['application/handlers/domain/workshop/WorkshopPassageSearchResultView.ts']);
  });

  it('adds no Workshop branch to the run engine: it names no passage search and no feature frame', () => {
    const engine = read(path.join(SRC_ROOT, 'infrastructure', 'api', 'orchestration', 'AgentRunEngine.ts'));
    expect(engine).not.toMatch(/passage|resultsDelivery|notAdopted/i);
    const measure = read(path.join(SRC_ROOT, 'infrastructure', 'api', 'orchestration', 'ConversationWindowMeasure.ts'));
    expect(measure).not.toMatch(/workshop|passage|persona/i);
  });

  it('constructs the handler only in the slice composition, and writes its report through the one shared export', () => {
    const all = [...sourceFiles(SRC_ROOT), ...sourceFiles(path.resolve(SRC_ROOT, '../../../apps/vscode-extension/src'))];
    const constructing = (pattern: RegExp): string[] => all.filter((file) => pattern.test(read(file))).map((file) => path.basename(file)).sort();
    expect(constructing(/new\s+WorkshopPassageSearchHandler\s*\(/)).toEqual(['WorkshopSliceComposition.ts']);
    // The sidebar's route builds its own; the Workshop's is built at the composition root. No Workshop module writes a report.
    expect(constructing(/new\s+PassageSearchReportExport\s*\(/)).toEqual(['PassageSearchRoute.ts', 'extension.ts']);
    expect(sourceFiles(SRC_ROOT).filter((file) => /workshop/i.test(relative(file)) && /formatPassageSearchReport\(/.test(read(file))).map(relative)).toEqual([]);
    expect(constructing(/new\s+WorkshopPassageSearchResults\s*\(/)).toEqual(['WorkshopPassageSearchHandler.ts']);
  });

  it('gives up a run that is not adopted inside completion, never after it', () => {
    const completion = read(path.join(SRC_ROOT, 'application', 'services', 'workshop', 'WorkshopRunCompletion.ts'));
    // Every non-adoption branch goes through the one switch; none calls abandonRun directly.
    expect(completion.match(/giveUp\(\);/g)).toHaveLength(3);
    expect(completion.match(/session\.abandonRun\(/g)).toHaveLength(1);
    expect(completion).toContain("input.notAdopted !== 'rollback' || !session.rollbackMessageRun(requestId)");
  });
});
