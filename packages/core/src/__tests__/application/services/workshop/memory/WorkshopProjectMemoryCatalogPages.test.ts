/**
 * `memory.catalog`'s `<page>` (Everyday Conveniences, Round Two, item C;
 * ADR 2026-11-17 D10; PR #269 F-02): the field's domain through the real
 * codec and the native translator, the page boundaries, the whole walk
 * (every hint followed exactly as written), and a page past the end.
 * There is no highest page: at 2,001 notes of one kind, page 50 names page
 * 51, which decodes and holds the note left. *Alice*, with made-up ids.
 */
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { ProjectMemory, ProjectMemoryKind } from '@shared/types/projectMemory';
import type { WorkshopProjectMemoryRequest } from '@shared/types/workshopCapabilities';
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { translateWorkshopNativeToolCall } from '@/application/services/workshop/WorkshopNativeToolCallTranslator';
import {
  WORKSHOP_CAPABILITY_LARGEST_LISTING,
  workshopCapabilityPage,
  workshopCapabilityPageOf
} from '@/application/services/workshop/WorkshopCapabilityPaging';
import { listProjectMemories, type ProjectMemoryListed } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import {
  renderWorkshopProjectMemoryCatalog,
  workshopProjectMemoryCatalogCall
} from '@/application/services/workshop/memory/WorkshopProjectMemoryRenderer';
import {
  workshopProjectMemoryRequestLogSummary,
  workshopProjectMemoryRequestSummary
} from '@/application/services/workshop/memory/WorkshopProjectMemoryRequestCopy';
import { WORKSHOP_PROJECT_MEMORY_FRAMING } from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import { writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

const codec = new WorkshopCapabilityXmlCodec();
const PAGE_SIZE = PROMPT_BUDGETS.workshopProjectMemory.catalogEntries;
const call = (body = ''): string => `<prose-minion-tool-call name="memory.catalog">${body}</prose-minion-tool-call>`;
const page = (value: string, beside = ''): string => call(`${beside}<page>${value}</page>`);
const INVALID_PAGE = { kind: 'invalid', reason: 'invalid-page', field: 'page', operation: 'memory.catalog' };

const id = (index: number): string => `mem-${index.toString(16).padStart(6, '0')}`;
/** `count` notes in effect of `kind`; a higher index is newer. */
function folder(count: number, kind: ProjectMemoryKind = 'canon', from = 0): ProjectMemory[] {
  return Array.from({ length: count }, (_, index) => writerMemory({
    id: id(from + index),
    kind,
    title: `Alice note ${from + index}`,
    summary: 'A short line.',
    updated: new Date(Date.UTC(2026, 0, 1) + (from + index) * 60_000).toISOString()
  }));
}
const listed = (memories: ProjectMemory[]): ProjectMemoryListed[] => listProjectMemories(memories.map((memory) => ({ memory })));
/** The catalog's own lines, after the framing line and the line that says the catalog is live. */
const bodyLines = (content: string): string[] => content.split('\n').slice(2);
const idsOn = (content: string): string[] => [...content.matchAll(/^- (mem-[0-9a-f]{6}) /gm)].map((match) => match[1]);
/** The continuation a page wrote, exactly as written, or undefined when it wrote none. */
const hintOf = (content: string): string | undefined =>
  content.split('\n').map((line) => /The next page: (.*)$/.exec(line)?.[1]).find((hint) => hint !== undefined);

describe('the <page> field\'s domain (D10)', () => {
  it.each(['1', '51', '999999999'])('reads %s', (value) => {
    expect(codec.inspect(page(value))).toEqual({ kind: 'request', request: { capability: 'memory.catalog', page: Number(value) } });
    expect(workshopCapabilityPage(value)).toEqual({ kind: 'page', page: Number(value) });
  });

  it.each(['0', '01', '-1', '+1', '1.5', '1e3', 'two', '1 0', '١', '1000000000', '99999999999999999999'])('refuses %s as invalid-page', (value) => {
    expect(codec.inspect(page(value))).toEqual(INVALID_PAGE);
    expect(workshopCapabilityPage(value)).toEqual({ kind: 'invalid' });
  });

  it('refuses an empty field as invalid-page, and a second <page> as a duplicate', () => {
    expect(codec.inspect(page(''))).toEqual(INVALID_PAGE);
    expect(codec.inspect(page('   '))).toEqual(INVALID_PAGE);
    expect(workshopCapabilityPage('')).toEqual({ kind: 'invalid' });
    expect(codec.inspect(call('<page>1</page><page>2</page>'))).toEqual({ kind: 'invalid', reason: 'duplicate-field', field: 'page', operation: 'memory.catalog' });
  });

  it('is optional: absent leaves the request without a page, which reads as the first', () => {
    expect(codec.inspect(call())).toEqual({ kind: 'request', request: { capability: 'memory.catalog' } });
    const memories = listed(folder(3));
    expect(renderWorkshopProjectMemoryCatalog(memories)).toEqual(renderWorkshopProjectMemoryCatalog(memories, undefined, 1));
  });

  it('reads beside <kind>, in either order, and each field is still checked on its own', () => {
    const both = { kind: 'request', request: { capability: 'memory.catalog', kind: 'decision', page: 2 } };
    expect(codec.inspect(call('<kind>decision</kind><page>2</page>'))).toEqual(both);
    expect(codec.inspect(call('<page>2</page><kind>Decision</kind>'))).toEqual(both);
    expect(codec.inspect(call('\n  <kind>decision</kind>\n  <page>2</page>\n'))).toEqual(both);
    expect(codec.inspect(call('<kind>rumor</kind><page>2</page>'))).toMatchObject({ reason: 'invalid-kind', field: 'kind' });
    expect(codec.inspect(call('<kind>decision</kind><page>0</page>'))).toEqual(INVALID_PAGE);
  });

  it('belongs to memory.catalog alone', () => {
    for (const [operation, body] of [['memory.search', '<query>watch</query>'], ['memory.read', '<memory>mem-7f3c2a</memory>']]) {
      expect(codec.inspect(`<prose-minion-tool-call name="${operation}">${body}<page>2</page></prose-minion-tool-call>`))
        .toMatchObject({ kind: 'invalid', reason: 'unexpected-field', field: 'page' });
    }
  });

  it('reads a native call\'s number and its text alike, through the same parser', () => {
    const native = (args: unknown) => {
      const translation = translateWorkshopNativeToolCall({ name: 'memory_catalog', arguments: JSON.stringify(args) });
      if (translation.kind !== 'translated') {
        throw new Error(`not translated: ${translation.fault}`);
      }
      return { envelope: translation.envelope, inspection: codec.inspect(translation.envelope) };
    };
    const asNumber = native({ page: 51 });
    const asText = native({ page: '51' });
    expect(asNumber.envelope).toBe(asText.envelope);
    expect(asNumber.envelope).toContain('<page>51</page>');
    expect(asNumber.inspection).toEqual({ kind: 'request', request: { capability: 'memory.catalog', page: 51 } });
    expect(asText.inspection).toEqual(asNumber.inspection);
    expect(native({ kind: 'decision', page: 2 }).inspection).toEqual({ kind: 'request', request: { capability: 'memory.catalog', kind: 'decision', page: 2 } });
    // A native value outside the domain is refused by the same rule, never mended.
    for (const bad of [0, 1.5, -1, '01', 1_000_000_000, 'two']) {
      expect([bad, native({ page: bad }).inspection]).toEqual([bad, INVALID_PAGE]);
    }
  });

  it('holds the digit bound: the last page of the largest listing the host can hold fits the field, for every page size that uses it', () => {
    // Each page size that reads `<page>` joins this list; a smaller one added later must still fit.
    // eslint-disable-next-line @typescript-eslint/naming-convention -- keyed by the operation's own name.
    const pageSizes = { 'memory.catalog': PAGE_SIZE, 'lens.catalog': PROMPT_BUDGETS.workshopLens.catalogItems };
    expect(WORKSHOP_CAPABILITY_LARGEST_LISTING).toBe(2 ** 32 - 1);
    for (const [operation, size] of Object.entries(pageSizes)) {
      const lastPage = Math.ceil(WORKSHOP_CAPABILITY_LARGEST_LISTING / size);
      expect([operation, String(lastPage).length <= PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits]).toEqual([operation, true]);
      expect([operation, workshopCapabilityPage(String(lastPage))]).toEqual([operation, { kind: 'page', page: lastPage }]);
    }
    expect(Math.ceil(WORKSHOP_CAPABILITY_LARGEST_LISTING / PAGE_SIZE)).toBe(107_374_183);
    // The widest page the field takes is a safe integer, so no page is rounded on the way in.
    expect(Number.isSafeInteger(10 ** PROMPT_BUDGETS.workshopCapabilityPaging.pageDigits - 1)).toBe(true);
  });

  it('writes a next page exactly when a later page exists', () => {
    expect(workshopCapabilityPageOf(0, 40, 1)).toEqual({ pages: 0, pastEnd: false, start: 0, end: 0 });
    expect(workshopCapabilityPageOf(0, 40, 2)).toEqual({ pages: 0, pastEnd: true, start: 0, end: 0 });
    expect(workshopCapabilityPageOf(40, 40, 1)).toEqual({ pages: 1, pastEnd: false, start: 0, end: 40 });
    expect(workshopCapabilityPageOf(41, 40, 1)).toEqual({ pages: 2, pastEnd: false, start: 0, end: 40, next: 2 });
    expect(workshopCapabilityPageOf(41, 40, 2)).toEqual({ pages: 2, pastEnd: false, start: 40, end: 41 });
    expect(workshopCapabilityPageOf(41, 40, 3)).toEqual({ pages: 2, pastEnd: true, start: 41, end: 41 });
    expect(workshopCapabilityPageOf(WORKSHOP_CAPABILITY_LARGEST_LISTING, 40, 107_374_182).next).toBe(107_374_183);
    expect(workshopCapabilityPageOf(WORKSHOP_CAPABILITY_LARGEST_LISTING, 40, 107_374_183).next).toBeUndefined();
  });
});

describe('the page boundaries, every note of one kind', () => {
  it('0 notes: page 1 says none is in effect, with no hint', () => {
    for (const kind of [undefined, 'canon'] as const) {
      const rendered = renderWorkshopProjectMemoryCatalog([], kind, 1);
      expect(bodyLines(rendered.content)).toEqual([kind ? 'No note of kind canon is in effect.' : 'No note is in effect.']);
      expect(hintOf(rendered.content)).toBeUndefined();
      expect(rendered).toMatchObject({ shown: 0, notShown: 0, page: 1, pages: 0 });
    }
  });

  it.each([[40, 1], [80, 2]])('%i notes: page %i is full and writes no hint', (count, last) => {
    const memories = listed(folder(count));
    const rendered = renderWorkshopProjectMemoryCatalog(memories, 'canon', last);
    expect(idsOn(rendered.content)).toHaveLength(PAGE_SIZE);
    expect(hintOf(rendered.content)).toBeUndefined();
    expect(rendered).toMatchObject({ shown: PAGE_SIZE, notShown: 0, page: last, pages: last });
  });

  it.each([[41, 1], [81, 2]])('%i notes: page %i hints to the next, which decodes, holds one note and writes no hint', (count, full) => {
    const memories = listed(folder(count));
    const rendered = renderWorkshopProjectMemoryCatalog(memories, 'canon', full);
    expect(idsOn(rendered.content)).toHaveLength(PAGE_SIZE);
    expect(rendered).toMatchObject({ shown: PAGE_SIZE, notShown: 1, page: full, pages: full + 1 });
    const hint = hintOf(rendered.content)!;
    expect(hint).toBe(`<prose-minion-tool-call name="memory.catalog"><kind>canon</kind><page>${full + 1}</page></prose-minion-tool-call>`);
    expect(codec.inspect(hint)).toEqual({ kind: 'request', request: { capability: 'memory.catalog', kind: 'canon', page: full + 1 } });

    const last = renderWorkshopProjectMemoryCatalog(memories, 'canon', full + 1);
    // The oldest note is the one left.
    expect(idsOn(last.content)).toEqual([id(0)]);
    expect(hintOf(last.content)).toBeUndefined();
    expect(bodyLines(last.content)[0]).toBe(`Note ${count} of ${count} in effect of kind canon, pinned first, then newest:`);
  });

  it('2,001 notes: page 50 hints to page 51, which decodes, holds the one note left and writes no hint (PR #269 F-02)', () => {
    const memories = listed(folder(2_001));
    const fifty = renderWorkshopProjectMemoryCatalog(memories, 'canon', 50);
    expect(fifty).toMatchObject({ shown: 40, notShown: 1, page: 50, pages: 51 });
    expect(bodyLines(fifty.content)[0]).toBe('Notes 1,961–2,000 of 2,001 in effect of kind canon, pinned first, then newest:');
    const hint = hintOf(fifty.content)!;
    expect(hint).toBe('<prose-minion-tool-call name="memory.catalog"><kind>canon</kind><page>51</page></prose-minion-tool-call>');
    const decoded = codec.inspect(hint);
    expect(decoded).toEqual({ kind: 'request', request: { capability: 'memory.catalog', kind: 'canon', page: 51 } });

    const request = (decoded as { request: Extract<WorkshopProjectMemoryRequest, { capability: 'memory.catalog' }> }).request;
    const last = renderWorkshopProjectMemoryCatalog(memories, request.kind, request.page);
    expect(idsOn(last.content)).toEqual([id(0)]);
    expect(hintOf(last.content)).toBeUndefined();
    expect(last).toMatchObject({ shown: 1, notShown: 0, page: 51, pages: 51 });
  });

  it('names the range on a catalog of several pages, and reads as it always has on a catalog of one', () => {
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(93)), undefined, 2).content)[0])
      .toBe('Notes 41–80 of 93 in effect, pinned first, then newest:');
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(93)), undefined, 1).content).at(-1))
      .toBe('53 more notes in effect. The next page: <prose-minion-tool-call name="memory.catalog"><page>2</page></prose-minion-tool-call>');
    // One page: today's header, and no line about more.
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(3))).content)[0]).toBe('3 notes in effect, pinned first, then newest:');
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(1)), 'canon').content)[0]).toBe('1 note in effect of kind canon, pinned first, then newest:');
    expect(renderWorkshopProjectMemoryCatalog(listed(folder(40))).content).not.toMatch(/more note|memory\.search to find them/);
  });

  it('keeps the pinned notes first across pages, and the line about notes not in effect on every page', () => {
    const memories = listed([
      ...folder(45),
      writerMemory({ id: 'mem-aaaaaa', title: 'Structure first', pinned: true, updated: '2020-01-01T00:00:00Z' }),
      writerMemory({ id: 'mem-bbbbbb', title: 'Put away', status: 'archived' })
    ]);
    const first = renderWorkshopProjectMemoryCatalog(memories, undefined, 1);
    const second = renderWorkshopProjectMemoryCatalog(memories, undefined, 2);
    expect(idsOn(first.content)[0]).toBe('mem-aaaaaa');
    expect(idsOn(second.content)).not.toContain('mem-aaaaaa');
    const notListed = 'Not listed: 0 superseded notes and 1 archived note; memory.search with <status>all</status> finds them.';
    expect(bodyLines(first.content).at(-1)).toBe(notListed);
    expect(bodyLines(second.content).at(-1)).toBe(notListed);
    expect(first.content.startsWith(`${WORKSHOP_PROJECT_MEMORY_FRAMING}\n`)).toBe(true);
  });
});

/** From page 1, follow every hint as written; fail on one that does not decode or does not move forward. */
function walk(memories: ProjectMemoryListed[], kind?: ProjectMemoryKind): { pages: number[]; ids: string[] } {
  const pages: number[] = [];
  const ids: string[] = [];
  let request: Extract<WorkshopProjectMemoryRequest, { capability: 'memory.catalog' }> = { capability: 'memory.catalog', ...(kind ? { kind } : {}) };
  for (let step = 0; step < 200; step += 1) {
    const rendered = renderWorkshopProjectMemoryCatalog(memories, request.kind, request.page);
    pages.push(rendered.page);
    ids.push(...idsOn(rendered.content));
    const hint = hintOf(rendered.content);
    // A hint exactly when a later page exists.
    expect(hint !== undefined).toBe(rendered.page < rendered.pages);
    if (hint === undefined) {
      return { pages, ids };
    }
    expect(hint).not.toContain('\n');
    const decoded = codec.inspect(hint);
    if (decoded.kind !== 'request' || decoded.request.capability !== 'memory.catalog') {
      throw new Error(`a hint did not decode: ${hint} -> ${JSON.stringify(decoded)}`);
    }
    // The hint keeps the kind asked, and names a later page.
    expect(decoded.request.kind).toBe(kind);
    expect(decoded.request.page).toBe(rendered.page + 1);
    request = decoded.request;
  }
  throw new Error('the walk did not end');
}

describe('the walk: from page 1, following every hint exactly as written', () => {
  it.each([0, 1, 39, 40, 41, 80, 81, 2_001])('%i notes of one kind: the pages strictly increase, the walk ends, and every note is seen once', (count) => {
    const memories = listed(folder(count));
    const expectedPages = Array.from({ length: Math.max(1, Math.ceil(count / PAGE_SIZE)) }, (_, index) => index + 1);
    for (const kind of [undefined, 'canon'] as const) {
      const walked = walk(memories, kind);
      expect(walked.pages).toEqual(expectedPages);
      expect(walked.ids).toHaveLength(count);
      expect(new Set(walked.ids).size).toBe(count);
      // Newest first throughout: the catalog's order is one order across pages.
      expect(walked.ids).toEqual(Array.from({ length: count }, (_, index) => id(count - 1 - index)));
    }
  });

  it('a mixed-kind folder, with and without <kind>: each walk sees every matching note in effect once, and no other', () => {
    const mixed = [
      ...folder(95, 'canon', 0),
      ...folder(41, 'decision', 0x1000),
      ...folder(3, 'idea', 0x2000),
      writerMemory({ id: 'mem-aaaaaa', kind: 'decision', pinned: true, title: 'Pinned decision' }),
      writerMemory({ id: 'mem-bbbbbb', kind: 'decision', status: 'archived', title: 'Archived decision' }),
      writerMemory({ id: 'mem-cccccc', kind: 'canon', title: 'Replaced' }),
      writerMemory({ id: 'mem-dddddd', kind: 'canon', title: 'Replaces', supersedes: ['mem-cccccc'] })
    ];
    const memories = listed(mixed);
    const inEffect = (kind?: ProjectMemoryKind) => mixed
      .filter((memory) => memory.status === 'active' && memory.id !== 'mem-cccccc' && (!kind || memory.kind === kind))
      .map((memory) => memory.id).sort();

    const all = walk(memories);
    expect(all.pages).toEqual([1, 2, 3, 4]);
    expect([...all.ids].sort()).toEqual(inEffect());
    expect(all.ids[0]).toBe('mem-aaaaaa');

    const decisions = walk(memories, 'decision');
    expect(decisions.pages).toEqual([1, 2]);
    expect([...decisions.ids].sort()).toEqual(inEffect('decision'));

    const canon = walk(memories, 'canon');
    expect(canon.pages).toEqual([1, 2, 3]);
    expect([...canon.ids].sort()).toEqual(inEffect('canon'));

    expect(walk(memories, 'idea')).toEqual({ pages: [1], ids: [id(0x2002), id(0x2001), id(0x2000)] });
    expect(walk(memories, 'theme')).toEqual({ pages: [1], ids: [] });
  });
});

describe('a page past the end', () => {
  it.each([4, 999_999_999])('page %i of 93 notes answers in words, with the count and the last page, and no hint', (past) => {
    const rendered = renderWorkshopProjectMemoryCatalog(listed(folder(93)), undefined, past);
    expect(bodyLines(rendered.content)).toEqual([`Page ${past.toLocaleString('en-US')} is past the end: 93 notes in effect, 3 pages.`]);
    expect(hintOf(rendered.content)).toBeUndefined();
    expect(rendered).toMatchObject({ shown: 0, notShown: 0, page: past, pages: 3 });
  });

  it('says the kind asked, and one page as one', () => {
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(7, 'decision')), 'decision', 2).content))
      .toEqual(['Page 2 is past the end: 7 notes in effect of kind decision, 1 page.']);
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(1)), undefined, 2).content))
      .toEqual(['Page 2 is past the end: 1 note in effect, 1 page.']);
  });

  it.each([2, 999_999_999])('with no note in effect, page %i says so, with no hint', (past) => {
    const rendered = renderWorkshopProjectMemoryCatalog([], undefined, past);
    expect(bodyLines(rendered.content)).toEqual([`Page ${past.toLocaleString('en-US')} is past the end: no note in effect.`]);
    expect(hintOf(rendered.content)).toBeUndefined();
    expect(bodyLines(renderWorkshopProjectMemoryCatalog(listed(folder(3, 'idea')), 'theme', 2).content)[0])
      .toBe('Page 2 is past the end: no note of kind theme in effect.');
  });

  it('the page after the last is past the end at every boundary count', () => {
    for (const count of [40, 41, 80, 81, 2_001]) {
      const pages = Math.ceil(count / PAGE_SIZE);
      const rendered = renderWorkshopProjectMemoryCatalog(listed(folder(count)), 'canon', pages + 1);
      expect(bodyLines(rendered.content)).toEqual([
        `Page ${pages + 1} is past the end: ${count.toLocaleString('en-US')} notes in effect of kind canon, ${pages} ${pages === 1 ? 'page' : 'pages'}.`
      ]);
      expect(hintOf(rendered.content)).toBeUndefined();
    }
  });
});

describe('what the card and the log say of a page', () => {
  it('names the page on the card past the first, and logs it as a count, never a title', () => {
    expect(workshopProjectMemoryRequestSummary({ capability: 'memory.catalog' })).toBe('project notes');
    expect(workshopProjectMemoryRequestSummary({ capability: 'memory.catalog', page: 1 })).toBe('project notes');
    expect(workshopProjectMemoryRequestSummary({ capability: 'memory.catalog', kind: 'decision', page: 3 })).toBe('decision notes, page 3');
    expect(workshopProjectMemoryRequestLogSummary({ capability: 'memory.catalog' })).toBe('kind=all; page=1');
    expect(workshopProjectMemoryRequestLogSummary({ capability: 'memory.catalog', kind: 'idea', page: 51 })).toBe('kind=idea; page=51');
  });

  it('builds the call a continuation names: complete, on one line, keeping the kind', () => {
    expect(workshopProjectMemoryCatalogCall(3, 'decision'))
      .toBe('<prose-minion-tool-call name="memory.catalog"><kind>decision</kind><page>3</page></prose-minion-tool-call>');
    expect(workshopProjectMemoryCatalogCall(2)).toBe('<prose-minion-tool-call name="memory.catalog"><page>2</page></prose-minion-tool-call>');
  });
});
