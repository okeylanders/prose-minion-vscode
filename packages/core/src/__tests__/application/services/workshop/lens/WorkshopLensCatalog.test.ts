/**
 * `lens.catalog` (ADR 2026-11-17 D17): the library's order, the one merge
 * rule, the installed mark, files that did not read, a workspace with no
 * folder or several, and the pages. The walk follows every hint exactly as
 * written through the real codec, at 50, 51 and 206 lenses. *Alice*, with
 * made-up lenses.
 */
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { FileType } from '@/platform';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import {
  WORKSHOP_CAPABILITY_LARGEST_LISTING,
  workshopCapabilityPage
} from '@/application/services/workshop/WorkshopCapabilityPaging';
import {
  builtInLexicalGravityLenses,
  mergeLexicalGravityLibrary
} from '@/application/services/workshop/widgets/lexicalGravity/LexicalGravityLenses';
import {
  LEXICAL_GRAVITY_LIBRARY_LIMITS,
  LexicalGravityLensRepository
} from '@/infrastructure/storage/LexicalGravityLensRepository';
import { WORKSHOP_LENS_FRAMING } from '@/application/services/workshop/lens/WorkshopLensCopy';
import { workshopLensCatalogCall } from '@/application/services/workshop/lens/WorkshopLensRenderer';
import { workshopInstalledLensOf } from '@/application/services/workshop/lens/WorkshopLensInstalled';
import { createFakeFileSystem, createFakeWorkspace } from '@/__tests__/mocks/platform';
import {
  aliceLens,
  aliceLenses,
  LENS_PAGE_SIZE,
  lensCapability,
  lensLibrary,
  noProjectLenses,
  unavailableLensLibrary
} from '@/__tests__/application/services/workshop/lens/lensLibraryFixtures';
import type { WorkshopLensLibraryPort } from '@/application/services/workshop/lens/WorkshopLensCapability';

const codec = new WorkshopCapabilityXmlCodec();
const BUILT_INS = builtInLexicalGravityLenses();
const slugsOn = (content: string): string[] => [...content.matchAll(/^- ([a-z0-9-]+) · /gm)].map((match) => match[1]);
/** The continuation a page wrote, exactly as written, or undefined when it wrote none. */
const hintOf = (content: string): string | undefined =>
  content.split('\n').map((line) => /The next page: (.*)$/.exec(line)?.[1]).find((hint) => hint !== undefined);

async function catalog(library: WorkshopLensLibraryPort, page?: number, installed?: string) {
  const wired = lensCapability(library, { installed });
  const result = await wired.capability.fulfill({ capability: 'lens.catalog', ...(page !== undefined ? { page } : {}) });
  return { ...wired, result, content: result.content ?? '' };
}

describe('the library a catalog lists', () => {
  it('lists the project\'s lenses first, by name with ties by slug, then the built-ins in their own order', async () => {
    const { result, content } = await catalog(lensLibrary([
      aliceLens('tea-b', { name: 'Tea Party' }),
      aliceLens('croquet', { name: 'Croquet Ground' }),
      aliceLens('tea-a', { name: 'Tea Party' }),
      aliceLens('zz-caucus', { name: 'A Caucus Race' })
    ]));
    expect(slugsOn(content)).toEqual(['zz-caucus', 'croquet', 'tea-a', 'tea-b', ...BUILT_INS.map((lens) => lens.slug)]);
    expect(content.split('\n')[0]).toBe(WORKSHOP_LENS_FRAMING);
    expect(content).toContain(`${4 + BUILT_INS.length} lenses: the project's lenses first, by name, then the built-in starters.`);
    expect(result).toMatchObject({
      capability: 'lens.catalog',
      status: 'success',
      requestSummary: 'the lens library',
      metadata: { outcome: 'catalog', lensCount: 4 + BUILT_INS.length, page: 1, pages: 1, notShown: 0, unreadableFiles: 0, projectLibrary: 'listed', truncated: false }
    });
    expect(result.usage).toBeUndefined();
  });

  it('shows each lens\'s slug, name, variant, source, subject and description on one line', async () => {
    const { content } = await catalog(lensLibrary([aliceLens('tea-party', {
      name: 'Tea Party', variant: 'the table that never clears', originQuery: 'a mad tea party', description: 'Cups, clocks and bad manners.'
    })]));
    expect(content).toContain(
      '- tea-party · “Tea Party” — the table that never clears · project lens · subject: “a mad tea party” · Cups, clocks and bad manners.'
    );
    const builtIn = BUILT_INS[0];
    expect(content).toMatch(new RegExp(`^- ${builtIn.slug} · “${builtIn.name}”.* · built-in starter`, 'm'));
  });

  it('lets a built-in win its slug, by the modal\'s own rule', async () => {
    const shadow = { ...aliceLens('x'), slug: BUILT_INS[0].slug, name: 'SHADOWING-PROJECT-LENS' };
    const { content } = await catalog(lensLibrary([shadow, aliceLens('tea-party')]));
    expect(slugsOn(content)).toEqual(['tea-party', ...BUILT_INS.map((lens) => lens.slug)]);
    expect(content).not.toContain('SHADOWING-PROJECT-LENS');
    // The one rule: built-ins, then each project lens whose slug is free; of two project lenses, the first read.
    const first = aliceLens('twin', { name: 'First' });
    expect(mergeLexicalGravityLibrary(BUILT_INS, [shadow, first, aliceLens('twin', { name: 'Second' })]))
      .toEqual([...BUILT_INS, first]);
    expect(mergeLexicalGravityLibrary(BUILT_INS, [])).toEqual(BUILT_INS);
  });

  it('marks the installed lens, and only it', async () => {
    const library = lensLibrary([aliceLens('tea-party'), aliceLens('croquet')]);
    const marked = (content: string): string[] => content.split('\n').filter((line) => line.includes('installed in this room')).flatMap(slugsOn);
    expect(marked((await catalog(library, undefined, 'croquet')).content)).toEqual(['croquet']);
    expect(marked((await catalog(library, undefined, BUILT_INS[1].slug)).content)).toEqual([BUILT_INS[1].slug]);
    expect(marked((await catalog(library)).content)).toEqual([]);
    // A slug the library does not hold marks nothing.
    expect(marked((await catalog(library, undefined, 'gone')).content)).toEqual([]);
  });

  it('learns the installed slug from the room\'s directive and its config, and nothing else of either', () => {
    const directive = { id: 'dir-1', family: 'lexical-gravity', widgetId: 'lexical-gravity', widgetConfigId: 'cfg-1', revision: 1, updatedAt: 1 };
    const session = (config: unknown, installed: unknown = directive) => ({
      getStandingDirective: jest.fn(() => installed),
      getWidgetConfig: jest.fn(() => config)
    });
    const installed = session({ widgetId: 'lexical-gravity', draft: { lensSlug: 'tea-party', resolvedLens: { name: 'NEVER-READ' } } });
    expect(workshopInstalledLensOf(installed as never).installedLensSlug()).toBe('tea-party');
    expect(installed.getStandingDirective).toHaveBeenCalledWith('lexical-gravity');
    expect(installed.getWidgetConfig).toHaveBeenCalledWith('cfg-1');
    expect(workshopInstalledLensOf(session(undefined, undefined) as never).installedLensSlug()).toBeUndefined();
    expect(workshopInstalledLensOf(session(undefined) as never).installedLensSlug()).toBeUndefined();
    expect(workshopInstalledLensOf(session({ widgetId: 'gesture-playground', draft: {} }) as never).installedLensSlug()).toBeUndefined();
  });

  it('counts files that did not read, and never names one', async () => {
    const two = await catalog(lensLibrary([aliceLens('tea-party')], 2));
    expect(two.content).toContain('2 lens files couldn\'t be read.');
    expect(two.result.metadata).toMatchObject({ unreadableFiles: 2 });
    expect((await catalog(lensLibrary([], 1))).content).toContain('1 lens file couldn\'t be read.');
    expect((await catalog(lensLibrary([aliceLens('tea-party')]))).content).not.toContain('couldn\'t be read');
    expect(`${two.content}\n${JSON.stringify(two.result.metadata)}\n${two.lines.join('\n')}`).not.toMatch(/\.json/);
  });

  it.each([
    ['no-workspace', 'this workspace has no folder'],
    ['multi-root', 'this workspace has several folders']
  ] as const)('with %s, says so in host words and still lists the built-ins', async (reason, words) => {
    const { result, content } = await catalog(unavailableLensLibrary(reason));
    expect(content).toContain(`The project's own lenses are unavailable: ${words}. Only the built-in starters are listed.`);
    expect(slugsOn(content)).toEqual(BUILT_INS.map((lens) => lens.slug));
    expect(result).toMatchObject({ status: 'success', metadata: { projectLibrary: reason, lensCount: BUILT_INS.length } });
  });

  it('a folder that cannot be read lists the built-ins as a partial result', async () => {
    const { result, content, lines } = await catalog({ listReadable: async () => { throw new Error('EIO: /workspace/SECRET-PATH'); } });
    expect(result.status).toBe('partial');
    expect(content).toContain('The project\'s lens folder could not be read just now.');
    expect(slugsOn(content)).toEqual(BUILT_INS.map((lens) => lens.slug));
    expect(lines.join('\n')).not.toContain('SECRET-PATH');
  });

  it('stops when the turn is cancelled', async () => {
    const wired = lensCapability(noProjectLenses);
    wired.controller.abort();
    await expect(wired.capability.fulfill({ capability: 'lens.catalog' })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('through the real repository', () => {
  const root = '/workspace/novel';
  const directory = path.join(root, 'prose-minion', 'lenses');
  const repository = (folders: string[], files: Record<string, string>) => new LexicalGravityLensRepository(
    createFakeFileSystem({
      readDirectory: async () => Object.keys(files).map((file) => [path.basename(file), FileType.File] as [string, FileType])
    }, files),
    createFakeWorkspace({ workspaceFolders: () => folders.map((folder) => ({ path: folder, name: path.basename(folder) })) }),
    { appendLine: jest.fn(), clear: jest.fn(), show: jest.fn() }
  );
  const files = {
    [path.join(directory, 'tea-party.json')]: JSON.stringify(aliceLens('tea-party')),
    [path.join(directory, 'croquet.json')]: JSON.stringify(aliceLens('croquet', { name: 'Croquet Ground' })),
    [path.join(directory, 'not-a-lens.json')]: '{ "UNREADABLE-FILE-TEXT": true',
    [path.join(directory, 'renamed.json')]: JSON.stringify(aliceLens('another-slug'))
  };

  it('lists the lenses that read and counts the files that did not', async () => {
    const { content, result } = await catalog(repository([root], files));
    // By name: "Alice tea-party", then "Croquet Ground".
    expect(slugsOn(content)).toEqual(['tea-party', 'croquet', ...BUILT_INS.map((lens) => lens.slug)]);
    expect(content).toContain('2 lens files couldn\'t be read.');
    expect(content).not.toMatch(/UNREADABLE-FILE-TEXT|not-a-lens|renamed/);
    expect(result.metadata).toMatchObject({ unreadableFiles: 2, projectLibrary: 'listed' });
  });

  it('answers a workspace with no folder, and one with several, from the repository\'s own refusal', async () => {
    expect((await catalog(repository([], files))).result.metadata).toMatchObject({ projectLibrary: 'no-workspace', lensCount: BUILT_INS.length });
    expect((await catalog(repository([root, '/workspace/other'], files))).result.metadata)
      .toMatchObject({ projectLibrary: 'multi-root', lensCount: BUILT_INS.length });
  });
});

describe('the pages (D17, by D10\'s rule)', () => {
  /** A library of `total` lenses in all: the built-ins, and the rest the project's. */
  const libraryOf = (total: number) => lensLibrary(aliceLenses(total - BUILT_INS.length));

  /** From page 1, send every continuation exactly as written until a page writes none. */
  async function walk(library: WorkshopLensLibraryPort) {
    const pages: Array<{ page: number; slugs: string[]; content: string }> = [];
    let request: { capability: 'lens.catalog'; page?: number } = { capability: 'lens.catalog' };
    for (;;) {
      const { result } = await catalog(library, request.page);
      const content = result.content!;
      pages.push({ page: result.metadata!.page as number, slugs: slugsOn(content), content });
      const hint = hintOf(content);
      // More is one call away exactly when a hint was written.
      expect(result.metadata!.truncated).toBe(hint !== undefined);
      if (hint === undefined) {
        return pages;
      }
      const inspection = codec.inspect(hint);
      if (inspection.kind !== 'request' || inspection.request.capability !== 'lens.catalog') {
        throw new Error(`a continuation did not decode: ${hint}`);
      }
      // Every hint makes progress.
      expect(inspection.request.page).toBeGreaterThan(pages.at(-1)!.page);
      expect(hint).toBe(workshopLensCatalogCall(inspection.request.page!));
      request = inspection.request;
      if (pages.length > 10) {
        throw new Error('the walk did not end');
      }
    }
  }

  it('is 50 lenses a page', () => {
    expect(LENS_PAGE_SIZE).toBe(50);
    expect(BUILT_INS.length).toBeGreaterThan(0);
  });

  it('at 50 lenses, is one page with no continuation', async () => {
    const pages = await walk(libraryOf(50));
    expect(pages.map(({ page, slugs }) => [page, slugs.length])).toEqual([[1, 50]]);
    expect(pages[0].content).toContain('50 lenses: the project\'s lenses first');
    expect(pages[0].content).not.toContain('The next page');
  });

  it('at 51 lenses, page 1 names page 2, which holds the one left', async () => {
    const pages = await walk(libraryOf(51));
    expect(pages.map(({ page, slugs }) => [page, slugs.length])).toEqual([[1, 50], [2, 1]]);
    expect(pages[0].content).toContain('Lenses 1–50 of 51');
    expect(pages[0].content.split('\n').at(-1)).toBe(`1 more lens. The next page: ${workshopLensCatalogCall(2)}`);
    expect(pages[1].content).toContain('Lenses 51–51 of 51');
    expect(pages[1].slugs).toEqual([BUILT_INS.at(-1)!.slug]);
  });

  it('at the full library (206), walks 5 pages and shows every lens exactly once', async () => {
    const total = LEXICAL_GRAVITY_LIBRARY_LIMITS.maximumFiles + BUILT_INS.length;
    expect(total).toBe(206);
    const library = libraryOf(total);
    const pages = await walk(library);
    expect(pages.map(({ page, slugs }) => [page, slugs.length])).toEqual([[1, 50], [2, 50], [3, 50], [4, 50], [5, 6]]);
    const seen = pages.flatMap(({ slugs }) => slugs);
    expect(new Set(seen).size).toBe(total);
    expect(seen).toEqual([...aliceLenses(total - BUILT_INS.length).map((lens) => lens.slug), ...BUILT_INS.map((lens) => lens.slug)]);
    expect(pages[2].content).toContain('Lenses 101–150 of 206');
    expect(pages[2].content.split('\n').at(-1)).toBe(`56 more lenses. The next page: ${workshopLensCatalogCall(4)}`);
    expect(pages[4].content).not.toContain('The next page');
  });

  it('answers a page past the end in words, with the last page and no call', async () => {
    const library = libraryOf(206);
    const { result, content } = await catalog(library, 9);
    expect(content.split('\n').slice(1)).toEqual(['Page 9 is past the end: 206 lenses, 5 pages.']);
    expect(hintOf(content)).toBeUndefined();
    expect(content).not.toContain('prose-minion-tool-call');
    expect(result).toMatchObject({ status: 'success', requestSummary: 'the lens library, page 9', metadata: { lensCount: 0, page: 9, pages: 5, truncated: false } });
    expect((await catalog(libraryOf(50), 2)).content).toContain('Page 2 is past the end: 50 lenses, 1 page.');
    // The widest page the field takes still answers in words.
    expect((await catalog(library, 999_999_999)).content).toContain('Page 999,999,999 is past the end: 206 lenses, 5 pages.');
  });

  it('says how many files did not read on every page', async () => {
    const library = lensLibrary(aliceLenses(60), 3);
    expect((await catalog(library, 1)).content).toContain('3 lens files couldn\'t be read.');
    expect((await catalog(library, 2)).content).toContain('3 lens files couldn\'t be read.');
  });

  it('holds the digit bound: the last page of the largest listing the host can hold fits the field', () => {
    const lastPage = Math.ceil(WORKSHOP_CAPABILITY_LARGEST_LISTING / LENS_PAGE_SIZE);
    expect(String(lastPage).length).toBeLessThanOrEqual(PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits);
    expect(workshopCapabilityPage(String(lastPage))).toEqual({ kind: 'page', page: lastPage });
    expect(codec.inspect(workshopLensCatalogCall(lastPage))).toEqual({ kind: 'request', request: { capability: 'lens.catalog', page: lastPage } });
  });
});
