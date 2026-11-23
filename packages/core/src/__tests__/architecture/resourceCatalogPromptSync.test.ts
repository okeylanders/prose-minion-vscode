/**
 * The group inventory's continuations (ADR 2026-11-20 S46, S48), held to
 * the codec as recall's and lens's are:
 *
 * - the page form the instruction teaches is the catalog's own call, and it
 *   decodes to the page it names;
 * - every continuation a real catalog writes decodes alone, exactly as
 *   written, to the next page of the same catalog: the same group and the
 *   same patterns, an `&` or `<` in a pattern included, and the longest list
 *   the rule allows;
 * - a catalog writes a continuation exactly when a later page exists.
 *
 * The real resolver walks a made-up *Alice* project.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots and setting keys, keyed by their paths and names. */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { LogSink } from '@/platform';
import type { WorkshopCapabilityRequest } from '@shared/types/workshopCapabilities';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import { workshopResourceCatalogCall } from '@/application/services/workshop/WorkshopResourceCatalog';
import { WORKSHOP_RESOURCE_CATALOG_PAGE_EXAMPLE, workshopResourceInstructionLines } from '@/application/services/workshop/WorkshopResourceInstruction';
import { aliceProject } from '../application/services/contextPaths/aliceProject';

type CatalogRequest = Extract<WorkshopCapabilityRequest, { capability: 'resource.catalog' }>;

const codec = new WorkshopCapabilityXmlCodec();
const pageSize = PROMPT_BUDGETS.workshopResource.catalogItems;

function catalogOver(files: readonly string[]) {
  const alice = aliceProject({
    roots: { '/alice': [...files] },
    settings: { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.manuscript': 'Drafts/**' }
  });
  const resolver = new ContextResourceResolver(alice.settings, alice.fileSystem, alice.workspace, alice.log);
  const capability = new WorkshopResourceCapability(resolver, { appendLine: jest.fn() } as unknown as LogSink,
    { requestId: 'host-1', personaId: 'jill', signal: new AbortController().signal });
  return (request: Omit<CatalogRequest, 'capability'>) => capability.fulfill({ capability: 'resource.catalog', ...request });
}

const hintOf = (content: string | undefined): string | undefined =>
  /The next page: (<prose-minion-tool-call name="resource\.catalog">.*<\/prose-minion-tool-call>)$/m.exec(content ?? '')?.[1];

function decoded(call: string): CatalogRequest {
  const inspection = codec.inspect(call);
  if (inspection.kind !== 'request' || inspection.request.capability !== 'resource.catalog') {
    throw new Error(`did not decode: ${JSON.stringify(inspection)}`);
  }
  return inspection.request;
}

describe('the catalog\'s page form, taught and written', () => {
  it('teaches the catalog\'s own call, and it decodes to the page it names', () => {
    expect(workshopResourceInstructionLines([{ group: 'chapters', fileCount: 1 }])).toContain(WORKSHOP_RESOURCE_CATALOG_PAGE_EXAMPLE);
    expect(WORKSHOP_RESOURCE_CATALOG_PAGE_EXAMPLE).toBe(workshopResourceCatalogCall({ group: 'chapters', page: 2 }));
    expect(decoded(WORKSHOP_RESOURCE_CATALOG_PAGE_EXAMPLE)).toEqual({ capability: 'resource.catalog', group: 'chapters', page: 2 });
  });

  const files = (folder: string, count: number): string[] => Array.from({ length: count }, (_, index) => `${folder}/chapter-${index + 1}.md`);
  const cases: ReadonlyArray<readonly [string, readonly string[], Omit<CatalogRequest, 'capability'>]> = [
    ['every group', files('Drafts', pageSize + 1), {}],
    ['one group', files('Drafts', pageSize * 2 + 1), { group: 'chapters' }],
    ['a narrowed group', [...files('Drafts/book-1', pageSize + 2), ...files('Drafts/book-2', 4)], { group: 'chapters', match: ['Drafts/book-1/*.md', 'Drafts/book-2/chapter-1.md'] }],
    ['a pattern holding an ampersand and a bracket', files('Drafts/tea & <cakes>', pageSize + 1), { group: 'manuscript', match: ['Drafts/tea & <cakes>/*.md'] }]
  ];

  it.each(cases)('writes, for %s, a continuation that decodes alone to the next page of the same catalog', async (_what, project, request) => {
    const catalog = catalogOver(project);
    let page = request.page ?? 1;
    for (;;) {
      const result = await catalog({ ...request, page });
      const hint = hintOf(result.content);
      const pages = result.metadata?.pages as number;
      // Exactly when a later page exists.
      expect(hint !== undefined).toBe(page < pages);
      if (!hint) {
        break;
      }
      expect(decoded(hint)).toEqual({ capability: 'resource.catalog', group: request.group, ...(request.match ? { match: request.match } : {}), page: page + 1 });
      page += 1;
    }
    expect(page).toBeGreaterThan(1);
  });

  it('writes the longest list the rule allows in one <match> that decodes', () => {
    const { matchPatterns, patternCharacters } = PROMPT_BUDGETS.contextPaths;
    const longest = Array.from({ length: matchPatterns }, (_, index) => `${index}/${'a'.repeat(patternCharacters - 5)}.md`);
    expect(longest.every((pattern) => pattern.length === patternCharacters)).toBe(true);
    const call = workshopResourceCatalogCall({ group: 'chapters', match: longest, page: 9 });
    expect(decoded(call)).toEqual({ capability: 'resource.catalog', group: 'chapters', match: longest, page: 9 });
  });
});

describe('the help reference (S48)', () => {
  const help = fs.readFileSync(path.resolve(__dirname, '../../../resources/help/workshop.md'), 'utf8');
  const section = help.split('\n## ').find((part) => part.startsWith('A passage search a persona asks for'))!;

  it('states a narrowing\'s pattern count and the inventory\'s page size from their bounds', () => {
    expect(/narrow a group with up to (\d+) patterns/.exec(section)?.[1]).toBe(String(PROMPT_BUDGETS.contextPaths.matchPatterns));
    expect(/(\d+) to a page/.exec(section)?.[1]).toBe(String(pageSize));
  });
});
