/**
 * The engine's narrowed `group` scope (ADR 2026-11-20 S43): the files of
 * the group's own listing at least one pattern finds, never a file outside
 * it; unsafe narrowings refused by the engine itself; an incomplete walk
 * refused as `catalog-unreadable`; one walk per plan; and the plan's files,
 * estimate and `planKey` are the narrowed ones. The real resolver walks a
 * made-up *Alice* project; no provider is reached.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */
jest.mock('p-limit', () => ({
  // eslint-disable-next-line @typescript-eslint/naming-convention -- jest's ES-module interop flag.
  __esModule: true,
  // The plan sends nothing; the limiter is never asked to run a call here.
  default: () => (fn: () => Promise<unknown>) => fn()
}));

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { PassageSearchService } from '@services/search/passage/PassageSearchService';
import type { PassageSearchPlan } from '@services/search/passage/PassageSearchContracts';
import { ProjectPassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import { passageSearchRequestRefusal, type PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';
import { PassageSearchScopeFiles } from '@/application/services/passageSearch/PassageSearchScopeFiles';
import { aliceProject, type AliceProjectOptions } from '../contextPaths/aliceProject';

const BOOK = [
  'Drafts/chapter-1.md',
  'Drafts/chapter-1.2.md',
  'Drafts/chapter-4.1.md',
  'Drafts/chapter-4.2.md',
  'Drafts/chapter-10.md',
  'Notes/chapter-4-notes.md'
];
const QUESTION = 'Find every time the White Rabbit looks at his watch.';
const MODEL = 'placeholder/passage-model';

function engineOver(files: readonly string[] = BOOK, options: Partial<AliceProjectOptions> = {}) {
  const roots: Record<string, readonly string[]> = { '/alice': [...files] };
  const alice = aliceProject({ roots, settings: { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.general': 'Notes/**' }, ...options });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  const matchPatterns = jest.spyOn(resolver, 'matchPatterns');
  const readFile = jest.fn(async (filePath: string) => new TextEncoder().encode(`The Rabbit looked at his watch in ${filePath.split('/').pop()}.`));
  const scopeFiles = new PassageSearchScopeFiles({
    listing: resolver,
    fileSystem: { readFile, stat: alice.fileSystem.stat },
    workspace: alice.workspace,
    editor: { currentSelection: () => undefined }
  });
  const engine = { runInitial: jest.fn(), getModel: jest.fn(() => MODEL), isProviderAvailable: jest.fn(() => true) };
  const manager = { ensureInitialized: jest.fn(async () => undefined), getEngine: jest.fn(() => engine) };
  const prompts = { loadPrompts: jest.fn(async (names: string[]) => `SYSTEM ${names.join(' + ')}`) };
  const prices = { facts: jest.fn(async () => ({ pricing: { promptUsdPerToken: 0.000001, completionUsdPerToken: 0.000004 } })) };
  const log = { appendLine: jest.fn(), show: jest.fn(), clear: jest.fn() };
  const service = new PassageSearchService(manager as never, prompts as never, prices, log as never);
  return { searchEngine: new ProjectPassageSearchEngine(scopeFiles, service, log as never), scopeFiles, matchPatterns, readFile, alice, log, runInitial: engine.runInitial };
}

const narrowed = (...match: string[]): PassageSearchScope => ({ kind: 'group', group: 'chapters', match });

async function planOf(setup: ReturnType<typeof engineOver>, scopes: PassageSearchScope[]): Promise<PassageSearchPlan> {
  const outcome = await setup.searchEngine.plan({ question: QUESTION, scopes, organize: false });
  if (outcome.kind !== 'planned') {
    throw new Error(`expected a plan, got ${outcome.refusal.reason}`);
  }
  return outcome.plan;
}

async function refusalOf(setup: ReturnType<typeof engineOver>, scopes: PassageSearchScope[]): Promise<string | undefined> {
  const outcome = await setup.searchEngine.plan({ question: QUESTION, scopes, organize: false });
  return outcome.kind === 'refused' ? outcome.refusal.reason : undefined;
}

describe('a narrowed group, planned by the engine', () => {
  it('reads only the group\'s files a pattern finds, in natural order, and the estimate counts them', async () => {
    const setup = engineOver();
    const plan = await planOf(setup, [narrowed('Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md')]);
    expect(plan.files.map((file) => file.displayPath)).toEqual([
      'Drafts/chapter-1.md', 'Drafts/chapter-1.2.md', 'Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md', 'Drafts/chapter-10.md'
    ]);
    expect(plan.estimate.files).toBe(5);
    // Nothing was sent: a plan only prices.
    expect(setup.runInitial).not.toHaveBeenCalled();
  });

  it('never reaches a file outside its group, whatever the pattern finds elsewhere', async () => {
    const setup = engineOver();
    const plan = await planOf(setup, [narrowed('**/chapter-4*.md')]);
    expect(plan.files.map((file) => file.displayPath)).toEqual(['Drafts/chapter-4.1.md', 'Drafts/chapter-4.2.md']);
    expect(setup.readFile.mock.calls.map(([filePath]) => filePath)).not.toContain('/alice/Notes/chapter-4-notes.md');
  });

  it('a pattern that finds no file of its group refuses the plan, never the whole group or a quietly narrower search (S53)', async () => {
    expect(await refusalOf(engineOver(), [narrowed('Notes/*.md')])).toBe('match-found-nothing');
    // One of two patterns finding nothing is refused too: the plan never reads less than every pattern asked for.
    const setup = engineOver();
    expect(await refusalOf(setup, [narrowed('Drafts/chapter-4.*.md', 'Notes/*.md')])).toBe('match-found-nothing');
    expect(setup.readFile).not.toHaveBeenCalled();
  });

  it('refuses an incomplete walk as catalog-unreadable, never fewer files', async () => {
    const setup = engineOver(BOOK, { failingGlobs: ['Drafts/chapter-1*.md'] });
    expect(await refusalOf(setup, [narrowed('Drafts/chapter-4.*.md', 'Drafts/chapter-1*.md')])).toBe('catalog-unreadable');
    expect(setup.readFile).not.toHaveBeenCalled();
  });

  it('walks once for every narrowing in a plan, and not at all without one', async () => {
    const setup = engineOver();
    await planOf(setup, [narrowed('Drafts/chapter-4.*.md'), { kind: 'group', group: 'general', match: ['Notes/*.md'] }]);
    expect(setup.matchPatterns).toHaveBeenCalledTimes(1);
    const plain = engineOver();
    await planOf(plain, [{ kind: 'group', group: 'chapters' }]);
    expect(plain.matchPatterns).not.toHaveBeenCalled();
  });

  it('a narrowed group and its whole group plan differently, and a file added under a pattern moves the key', async () => {
    const whole = await planOf(engineOver(), [{ kind: 'group', group: 'chapters' }]);
    const part = await planOf(engineOver(), [narrowed('Drafts/chapter-4.*.md')]);
    expect(part.planKey).not.toBe(whole.planKey);
    const again = await planOf(engineOver(), [narrowed('Drafts/chapter-4.*.md')]);
    expect(again.planKey).toBe(part.planKey);
    const grown = await planOf(engineOver([...BOOK, 'Drafts/chapter-4.3.md']), [narrowed('Drafts/chapter-4.*.md')]);
    expect(grown.estimate.files).toBe(3);
    expect(grown.planKey).not.toBe(part.planKey);
  });

  it('logs no pattern, path or file name', async () => {
    const setup = engineOver();
    await planOf(setup, [narrowed('Drafts/chapter-4.*.md')]);
    const logged = [...setup.alice.lines, ...setup.log.appendLine.mock.calls.map(([line]) => String(line))].join('\n');
    expect(logged).not.toMatch(/chapter|Drafts|Rabbit/);
  });
});

describe('the engine refuses an unsafe narrowing itself, whoever sends it', () => {
  const request = (scope: PassageSearchScope) => ({ question: QUESTION, scopes: [scope], organize: false });

  it.each<[string, string[]]>([
    ['a parent segment', ['../secrets/*.md']],
    ['a leading slash', ['/Drafts/*.md']],
    ['a drive', ['C:/Drafts/*.md']],
    ['a comma inside one pattern', ['Drafts/a.md, Drafts/b.md']],
    ['an empty list', []],
    ['more than matchPatterns', Array.from({ length: PROMPT_BUDGETS.contextPaths.matchPatterns + 1 }, (_, index) => `Drafts/${index}.md`)]
  ])('refuses %s as unsafe-pattern, before anything is listed', async (_what, match) => {
    expect(passageSearchRequestRefusal(request(narrowed(...match)))?.reason).toBe('unsafe-pattern');
    const setup = engineOver();
    const listGroupFiles = jest.spyOn(setup.scopeFiles, 'resolve');
    expect(await refusalOf(setup, [narrowed(...match)])).toBe('unsafe-pattern');
    expect(listGroupFiles).not.toHaveBeenCalled();
  });

  it('accepts a safe one', () => {
    expect(passageSearchRequestRefusal(request(narrowed('Drafts/chapter-4.*.md', 'Drafts/**/*.txt')))).toBeUndefined();
  });
});
