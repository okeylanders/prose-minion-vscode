/**
 * PassageSearchEngine (ADR 2026-11-20 D1, D2, D6): the request's form is
 * refused before anything is read, the model is read before any file, a
 * plan sends nothing, and every closed refusal comes back in host words.
 * The scope reader and the model work are stand-ins.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PASSAGE_SEARCH_REFUSALS, type PassageSearchRefusalReason } from '@services/search/passage/PassageSearchContracts';
import { describePassageSearchLeftOut, passageSearchRefusal } from '@services/search/passage/PassageSearchRefusals';
import { ProjectPassageSearchEngine } from '@/application/services/passageSearch/PassageSearchEngine';
import { passageSearchRequestRefusal, type PassageSearchRequest, type PassageSearchScope } from '@/application/services/passageSearch/PassageSearchRequest';
import type { PassageSearchScopeFilesOutcome } from '@/application/services/passageSearch/PassageSearchScopeFiles';

const bounds = PROMPT_BUDGETS.passageSearch;
const QUESTION = 'Find every time the Cat grins.';
const FILE = { identity: '/book/1.md', displayPath: '1.md', absolutePath: '/book/1.md', text: 'The Cat grinned.', lineOffset: 0, lines: 'document' as const };
const GROUP: PassageSearchScope = { kind: 'group', group: 'chapters' };

function createEngine(options: { model?: string | undefined; resolved?: PassageSearchScopeFilesOutcome } = {}) {
  const order: string[] = [];
  const resolve = jest.fn(async (_scopes: readonly PassageSearchScope[]): Promise<PassageSearchScopeFilesOutcome> => {
    order.push('files');
    return options.resolved ?? { kind: 'files', files: [FILE], leftOut: [{ identity: '/book/x.md', reason: 'unreadable' }] };
  });
  const service = {
    model: jest.fn(async () => {
      order.push('model');
      return 'model' in options ? options.model : 'placeholder/passage-model';
    }),
    plan: jest.fn(async () => ({ kind: 'planned' as const, plan: { planKey: 'key' } as never })),
    run: jest.fn(async () => ({ ended: 'complete' }) as never),
    planOrganize: jest.fn(async () => ({ kind: 'unavailable' as const, message: 'none' })),
    organize: jest.fn(async (result: never) => result)
  };
  const log = { appendLine: jest.fn() };
  const engine = new ProjectPassageSearchEngine({ resolve }, service, log as never);
  return { engine, resolve, service, log, order };
}

const request = (overrides: Partial<PassageSearchRequest> = {}): PassageSearchRequest => ({ question: QUESTION, scopes: [GROUP], organize: false, ...overrides });

async function refusalOf(engine: ProjectPassageSearchEngine, asked: PassageSearchRequest): Promise<PassageSearchRefusalReason | undefined> {
  const outcome = await engine.plan(asked);
  return outcome.kind === 'refused' ? outcome.refusal.reason : undefined;
}

describe('ProjectPassageSearchEngine.plan', () => {
  it('reads the model before any file, then hands the files and the trimmed question to the service', async () => {
    const { engine, service, order } = createEngine();
    const outcome = await engine.plan(request({ question: `  ${QUESTION}\n`, organize: true }));
    expect(outcome).toEqual({ kind: 'planned', plan: { planKey: 'key' } });
    expect(order).toEqual(['model', 'files']);
    expect(service.plan).toHaveBeenCalledWith({
      model: 'placeholder/passage-model',
      question: QUESTION,
      organize: true,
      files: [FILE],
      leftOut: [{ identity: '/book/x.md', reason: 'unreadable' }]
    });
    expect(service.run).not.toHaveBeenCalled();
  });

  it.each<[PassageSearchRefusalReason, Partial<PassageSearchRequest>]>([
    ['no-question', { question: '   ' }],
    ['question-too-long', { question: 'q'.repeat(bounds.questionCharacters + 1) }],
    ['no-scope', { scopes: [] }],
    ['too-many-scopes', { scopes: Array.from({ length: bounds.scopes + 1 }, () => GROUP) }],
    ['unknown-group', { scopes: [{ kind: 'group', group: 'villains' as never }] }],
    ['unknown-group', { scopes: [{ kind: 'file', file: { group: 'villains' as never, path: 'a.md' } }] }],
    ['unknown-file', { scopes: [{ kind: 'file', file: { group: 'chapters', path: '../outside.md' } }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: '../**/*.md', writerTyped: true }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: '/etc/*.md', writerTyped: true }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: 'C:\\notes\\*.md', writerTyped: true }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: 'a.md, b.md', writerTyped: true }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: '   ', writerTyped: true }] }],
    ['unsafe-pattern', { scopes: [{ kind: 'pattern', pattern: 'drafts/*.md', writerTyped: false as never }] }]
  ])('refuses %s on the request\'s form, before the model or any file is read', async (reason, overrides) => {
    const { engine, resolve, service } = createEngine();
    expect(await refusalOf(engine, request(overrides))).toBe(reason);
    expect(service.model).not.toHaveBeenCalled();
    expect(resolve).not.toHaveBeenCalled();
    expect(service.plan).not.toHaveBeenCalled();
  });

  it('takes a question and scopes exactly at their bounds', () => {
    expect(passageSearchRequestRefusal(request({
      question: 'q'.repeat(bounds.questionCharacters),
      scopes: Array.from({ length: bounds.scopes }, () => GROUP)
    }))).toBeUndefined();
  });

  it('refuses with no key before any file is read', async () => {
    const { engine, resolve } = createEngine({ model: undefined });
    expect(await refusalOf(engine, request())).toBe('no-key');
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each<PassageSearchRefusalReason>([
    'too-many-files', 'file-too-large', 'unknown-file', 'ambiguous-file', 'no-selection', 'no-active-file', 'catalog-unreadable'
  ])('passes on the scope reader\'s %s', async (reason) => {
    const { engine, service } = createEngine({ resolved: { kind: 'refused', refusal: passageSearchRefusal(reason, 3) } });
    expect(await refusalOf(engine, request())).toBe(reason);
    expect(service.plan).not.toHaveBeenCalled();
  });

  it('refuses when the scopes name no readable file', async () => {
    const { engine, service } = createEngine({ resolved: { kind: 'files', files: [], leftOut: [] } });
    expect(await refusalOf(engine, request())).toBe('no-files');
    expect(service.plan).not.toHaveBeenCalled();
  });

  it('logs a refusal by its reason and a count, never the question, a pattern or a path', async () => {
    const { engine, log } = createEngine();
    await engine.plan(request({ scopes: [{ kind: 'pattern', pattern: '../secret/*.md', writerTyped: true }] }));
    await engine.plan(request({ question: '' }));
    const logged = log.appendLine.mock.calls.map(([line]) => String(line)).join('\n');
    expect(logged).toContain('unsafe-pattern');
    expect(logged).not.toMatch(/secret|Cat|\.md/);
  });
});

describe('ProjectPassageSearchEngine run and organize', () => {
  it('runs exactly the plan it is given, with the caller\'s options', async () => {
    const { engine, service, resolve } = createEngine();
    const plan = { planKey: 'key' } as never;
    const options = { signal: new AbortController().signal, onProgress: jest.fn() };
    await engine.run(plan, options);
    expect(service.run).toHaveBeenCalledWith(plan, options);
    expect(resolve).not.toHaveBeenCalled();
    expect(service.model).not.toHaveBeenCalled();
  });

  it('offers the organizing pass afterwards through the service\'s port', async () => {
    const { engine, service } = createEngine();
    const result = { ended: 'stopped' } as never;
    const organizePlan = { planKey: 'o' } as never;
    await expect(engine.planOrganize(result)).resolves.toEqual({ kind: 'unavailable', message: 'none' });
    await engine.organize(result, organizePlan, {});
    expect(service.planOrganize).toHaveBeenCalledWith(result);
    expect(service.organize).toHaveBeenCalledWith(result, organizePlan, {});
  });
});

describe('the refusals\' words', () => {
  it('has words for every closed reason, and none of them names a path', () => {
    for (const reason of PASSAGE_SEARCH_REFUSALS) {
      const { message } = passageSearchRefusal(reason, 7);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/undefined|NaN|\/book/);
    }
  });

  it('names the bound and the count where there is one', () => {
    expect(passageSearchRefusal('too-many-calls', 412).message).toBe(`That would take 412 calls; Passage Search makes up to ${bounds.calls} in one search. Narrow what it searches.`);
    expect(passageSearchRefusal('too-many-files', 1_250).message).toContain('1,250 files');
    expect(passageSearchRefusal('question-too-long', 512).message).toContain(`512 characters long; Passage Search takes up to ${bounds.questionCharacters}`);
    expect(passageSearchRefusal('too-many-scopes', 13).message).toContain(`up to ${bounds.scopes} at once`);
    expect(passageSearchRefusal('file-too-large', 2).message).toContain('2 files are larger than 2 MiB');
    expect(passageSearchRefusal('model-too-small').message).toContain('1,500 words');
  });

  it('says what an estimate left out, before anything is sent', () => {
    expect(describePassageSearchLeftOut({ unreadable: 0, unsplittable: 0, empty: 0 })).toBeUndefined();
    expect(describePassageSearchLeftOut({ unreadable: 0, unsplittable: 1, empty: 0 })).toBe('1 file left out: it has no place to split.');
    expect(describePassageSearchLeftOut({ unreadable: 2, unsplittable: 3, empty: 1 }))
      .toBe('3 files left out: they have no place to split. 2 files left out: not readable as text. 1 file left out: no text.');
  });
});
