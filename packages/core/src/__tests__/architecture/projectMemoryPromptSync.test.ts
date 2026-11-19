/**
 * Guard the project-memory grammar prompt (ADR 2026-11-04 D1, D11) against
 * drift from the code it teaches, as transcriptRecallPromptSync does for
 * recall:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS, and it quotes no
 *   other number;
 * - every XML example decodes through the real codec to the request the
 *   prose describes, and an example shown as refused gets the reason the
 *   prose names;
 * - the kinds and statuses it names are the closed lists;
 * - the provenance hint a read renders decodes, exactly as written, as a
 *   `transcript.read` of the turns it names;
 * - the start-of-conversation block it describes is the renderer's: every
 *   element the frame writes is named, and no other (ADR 2026-11-17 D8,
 *   D11);
 * - the catalog's continuation line is the form the prompt teaches, and it
 *   decodes, exactly as written, as the next page (D10). The prompt names
 *   no highest page and no token number.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';
import { WORKSHOP_MEMORY_SEARCH_STATUSES } from '@shared/types/workshopCapabilities';
import { WorkshopCapabilityXmlCodec, type WorkshopCapabilityInspection } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { projectMemoryProvenanceLine } from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import { workshopPersonaSystemPromptPaths, WORKSHOP_HOST_BASE_PROMPT_PATH, getWorkshopPersona } from '@shared/constants/workshopPersonas';
import { projectMemoryBody } from '@shared/types/projectMemory';
import { listProjectMemories } from '@/application/services/workshop/memory/ProjectMemoryLibraryContracts';
import { renderProjectMemoryFrame } from '@/application/services/workshop/memory/ProjectMemoryCatalogFrame';
import { renderWorkshopProjectMemoryCatalog } from '@/application/services/workshop/memory/WorkshopProjectMemoryRenderer';
import { neutralizeReservedPersonaPromptDelimiters } from '@/utils/workshopPromptFrames';
import { writerMemory } from '@/__tests__/application/services/workshop/memory/projectMemoryLibraryHost';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/project-memory-capability.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopProjectMemory;
const codec = new WorkshopCapabilityXmlCodec();
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('project-memory prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/A catalog shows ([\d,]+) notes a page/, [budgets.catalogEntries]],
    [/`<query>` is required, at most ([\d,]+) characters/, [budgets.queryCharacters]],
    [/One read names at most ([\d,]+) notes, each once/, [budgets.readMemories]],
    [/at most ([\d,]+) `memory\.read` calls in one user turn/, [budgets.readsPerTurn]],
    [/One read holds at most ([\d,]+) characters/, [budgets.readCharacters]]
  ];

  it.each(pinned)('quotes %s from PROMPT_BUDGETS', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(number)).toEqual(expected);
  });

  it('holds the codec\'s field bounds to the same budgets (ADR 2026-11-04 D4)', () => {
    expect(PROJECT_MEMORY_FIELD_CHARACTERS).toEqual({
      title: budgets.titleCharacters, summary: budgets.summaryCharacters, body: budgets.bodyCharacters
    });
  });

  it('quotes no number it does not pin', () => {
    // Code spans quote ids and tags, which are examples, not limits.
    const unpinned = [...pinned.map(([pattern]) => pattern), /`[^`\n]*`/]
      .reduce((text, pattern) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('names the closed kinds and search statuses, and only those', () => {
    expect(prose).toContain(`${PROJECT_MEMORY_KINDS.slice(0, -1).join(', ')}, or ${PROJECT_MEMORY_KINDS.at(-1)}`);
    expect(prose).toContain('active (the default, the notes in effect), superseded, archived, or all');
    expect(WORKSHOP_MEMORY_SEARCH_STATUSES).toEqual(['active', 'superseded', 'archived', 'all']);
  });

  it('teaches what each kind means, every kind once, in the closed list\'s order (Slice 6a)', () => {
    const section = /### What each kind means\n([\s\S]*?)\n### /.exec(prose)![1];
    const taught = [...section.matchAll(/^- An? `([a-z-]+)`/gm)].map((match) => match[1]);
    const named = [...section.matchAll(/`([a-z-]+)`/g)].map((match) => match[1]);
    expect([...new Set(named)]).toEqual([...PROJECT_MEMORY_KINDS]);
    expect(taught).toEqual(['decision', 'theme', 'idea', 'open-thread', 'preference']);
  });

  it('describes an idea as unsettled: never canon, never a decision, superseded when chosen', () => {
    const idea = /^- An `idea` (.*)$/m.exec(prose)![1];
    expect(idea).toContain('has not chosen');
    expect(idea).toContain('It is unsettled: never treat it as canon or as a decision');
    expect(idea).toContain('the decision or canon note that records it supersedes the idea');
    expect(prose).toContain('An idea is a candidate answer or direction; an open thread is the question itself.');
    expect(prose).toContain('Canon is what happens; a theme is what it means.');
  });
});

describe('project-memory prompt examples, through the real codec', () => {
  const blocks = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((block) => ({
    xml: block[1].trim(),
    lead: PROMPT.slice(0, block.index).trimEnd().split('\n').at(-1)!
  }));
  const expected: WorkshopCapabilityInspection[] = [
    { kind: 'request', request: { capability: 'memory.catalog', kind: 'decision' } },
    { kind: 'request', request: { capability: 'memory.catalog', kind: 'decision', page: 2 } },
    { kind: 'invalid', reason: 'invalid-page', field: 'page', operation: 'memory.catalog' },
    { kind: 'request', request: { capability: 'memory.search', query: 'watch time tea party', status: 'all' } },
    { kind: 'request', request: { capability: 'memory.read', memories: ['mem-7f3c2a', 'mem-1a9e04'] } },
    { kind: 'invalid', reason: 'duplicate-memory', field: 'memory', operation: 'memory.read' }
  ];

  it('shows exactly the examples this test decodes', () => {
    expect(blocks).toHaveLength(expected.length);
  });

  it.each(expected.map((inspection, index) => [index + 1, inspection] as const))(
    'example %i decodes to the request it describes, or the refusal it names',
    (ordinal, inspection) => {
      const { xml, lead } = blocks[ordinal - 1];
      expect(codec.inspect(xml)).toEqual(inspection);
      const named = /refused as `([a-z-]+)`/.exec(lead)?.[1];
      expect(named).toBe(inspection.kind === 'invalid' ? inspection.reason : undefined);
    }
  );
});

describe('the start-of-conversation block, as the prompt describes it (ADR 2026-11-17 D8, D11)', () => {
  const section = /### What the start of the conversation shows\n([\s\S]*?)\n### /.exec(PROMPT)![1];
  const big = (index: number) => writerMemory({
    id: `mem-00a00${index}`,
    pinned: true,
    created: `2026-10-0${index}T00:00:00Z`,
    title: `Pinned ${index}`,
    body: projectMemoryBody(Array.from({ length: 1_000 }, (_, word) => `word${word}`).join(' '))
  });
  // A frame that holds every element: bodies that load and do not, a full list, titles, and both counts.
  const frame = renderProjectMemoryFrame({
    memories: listProjectMemories([
      big(1), big(2), big(3), big(4),
      ...Array.from({ length: 6 }, (_, index) => writerMemory({ id: `mem-00000${index}`, title: `Alice note ${index}` })),
      writerMemory({ id: 'mem-0000aa', title: 'Put away', status: 'archived' })
    ].map((memory) => ({ memory }))),
    unreadable: 0,
    conflicts: 0
  }, { builtOn: '2026-11-17', budgets: { pinnedTokens: 5_000, catalogTokens: 2_000, catalogEntries: 1, titleTokens: 60 } })!;

  it('names every element the frame writes, and no element it does not', () => {
    const written = [...new Set([...frame.text.matchAll(/^ *<([a-z-]+)[ >]/gm)].map((match) => match[1]))];
    expect(written).toEqual(['project-memory', 'pinned', 'entry', 'title-only', 'unlisted', 'more']);
    const named = [...new Set([...section.matchAll(/`<([a-z-]+)>`/g)].map((match) => match[1]))];
    // `<gone>` and the update block are the update note's; `<status>` is the search field it points to.
    expect(named.filter((name) => !['project-memory-update', 'gone', 'status'].includes(name))).toEqual(written);
    for (const name of written) {
      expect(neutralizeReservedPersonaPromptDelimiters(`<${name} id="x">`)).not.toContain(`<${name}`);
    }
  });

  it('describes the marks and the counts the frame writes', () => {
    expect(frame.text).toMatch(/<entry [^>]*pinned="not-loaded">/);
    expect(frame.text).toMatch(/<title-only [^>]*pinned="not-loaded">/);
    expect(section.match(/`pinned="not-loaded"`/g)).toHaveLength(2);
    expect(section).toContain('A `<title-only>` line carries only a note\'s id, kind and title');
    expect(frame.text).toMatch(/<title-only id="mem-[0-9a-f]{6}" kind="[a-z-]+"( pinned="not-loaded")?>[^<]*<\/title-only>/);
    // What each count means, and where the rest are found: the frame's own lines say the same.
    expect(section).toContain('`<unlisted>` counts notes in effect that the block shows in no form; `memory.catalog` pages through every note in effect.');
    expect(frame.text).toContain('More notes in effect, older: memory.catalog pages through them.</unlisted>');
    expect(section).toContain('`<more>` counts superseded and archived notes, which are not in effect; `memory.search` with `<status>all</status>` finds them.');
    expect(frame.text).toContain('Superseded or archived notes, not in effect: memory.search with status all.</more>');
    // A conversation from before the tier keeps its frame, where `<more>` counted both (ADR 2026-11-17, consequences).
    expect(section).toContain('In an older conversation, `<more>` may count both together.');
  });

  it('says a title is a reason to read, and still says not to look routinely', () => {
    const when = /### When to look\n([\s\S]*?)\n### /.exec(PROMPT)![1];
    expect(when).toContain('A title that bears on what the writer raised is a reason to read that note.');
    expect(when).toContain('Do not look routinely');
  });

  it('names no token number and no highest page: the size is the writer\'s setting, and there is no last page to name', () => {
    expect(prose).not.toMatch(/token/i);
    expect(section).toContain('How much the block lists is the writer\'s setting.');
    for (const size of Object.values(budgets.listSizes)) {
      expect(prose).not.toContain(size.catalogTokens.toLocaleString('en-US'));
    }
    expect(prose).not.toMatch(/at most [\d,]+ pages|pages? [\d,]+ (?:is|are) the last|highest page/i);
    expect(prose).toContain('Never guess a page number');
  });
});

describe('the catalog\'s continuation, followed as written (ADR 2026-11-17 D10)', () => {
  const memories = listProjectMemories(Array.from({ length: budgets.catalogEntries * 2 + 1 }, (_, index) => ({
    memory: writerMemory({ id: `mem-${index.toString(16).padStart(6, '0')}`, kind: 'decision', title: `Alice note ${index}` })
  })));
  const hintOf = (content: string) => /The next page: (.*)$/m.exec(content)?.[1];

  it('is written in the words the prompt teaches, as one complete call that keeps its kind', () => {
    expect(prose).toContain('the result ends its list with "The next page:" and that page\'s whole call');
    expect(prose).toContain('keeping its `<kind>` when it has one');
    const first = renderWorkshopProjectMemoryCatalog(memories, 'decision');
    const hint = hintOf(first.content)!;
    expect(hint).toBe('<prose-minion-tool-call name="memory.catalog"><kind>decision</kind><page>2</page></prose-minion-tool-call>');
    // The hint is the taught example, written on one line.
    const taught = /```xml\n(<prose-minion-tool-call name="memory\.catalog">\s*<kind>decision<\/kind>\s*<page>2<\/page>\s*<\/prose-minion-tool-call>)\n```/.exec(PROMPT)![1];
    expect(taught.replace(/\s*\n\s*/g, '')).toBe(hint);
    expect(codec.inspect(hint)).toEqual(codec.inspect(taught));
  });

  it('decodes at every page, with and without a kind, and the last page and a page past the end write none', () => {
    for (const kind of [undefined, 'decision'] as const) {
      const pages = [1, 2].map((page) => renderWorkshopProjectMemoryCatalog(memories, kind, page));
      expect(pages.map((page) => codec.inspect(hintOf(page.content)!))).toEqual([
        { kind: 'request', request: { capability: 'memory.catalog', ...(kind ? { kind } : {}), page: 2 } },
        { kind: 'request', request: { capability: 'memory.catalog', ...(kind ? { kind } : {}), page: 3 } }
      ]);
      expect(hintOf(renderWorkshopProjectMemoryCatalog(memories, kind, 3).content)).toBeUndefined();
      const past = renderWorkshopProjectMemoryCatalog(memories, kind, 4);
      expect(hintOf(past.content)).toBeUndefined();
      // As the prompt says: a page past the end says how many notes and pages there are.
      expect(past.content).toMatch(/Page 4 is past the end: 81 notes in effect(?: of kind decision)?, 3 pages\.$/);
    }
    expect(prose).toContain('the last page gives no call, and a page past the end says how many notes and pages there are');
  });
});

describe('the provenance hint, followed as written', () => {
  const SESSION = '6b0f3c9e-2c1d-4e8a-9a51-0d6f2b7c9e11';

  it('decodes as the transcript.read of the turns it names', () => {
    const line = projectMemoryProvenanceLine({
      kind: 'recallable', sessionId: SESSION, title: 'Chapter 3 tea party', positions: [41, 38, 39, 40, 52], missingTurns: 0
    })!;
    const hint = /Check it with transcript\.read: (.*)$/.exec(line)![1];
    expect(codec.inspect(`<prose-minion-tool-call name="transcript.read">${hint}</prose-minion-tool-call>`)).toEqual({
      kind: 'request',
      request: { capability: 'transcript.read', sessions: [{ sessionId: SESSION, turns: [{ from: 38, to: 41 }, { from: 52, to: 52 }] }] }
    });
  });

  it('names no more ranges than a read accepts', () => {
    const positions = Array.from({ length: 32 }, (_, index) => index * 3 + 1);
    const line = projectMemoryProvenanceLine({ kind: 'recallable', sessionId: SESSION, title: 'Long', positions, missingTurns: 0 })!;
    const hint = /Check it with transcript\.read: (.*)$/.exec(line)![1];
    const decoded = codec.inspect(`<prose-minion-tool-call name="transcript.read">${hint}</prose-minion-tool-call>`);
    expect(decoded.kind).toBe('request');
    expect((decoded as Extract<WorkshopCapabilityInspection, { kind: 'request' }>).request).toMatchObject({
      sessions: [{ turns: expect.arrayContaining([{ from: 1, to: 1 }]) }]
    });
    // The rest are never dropped silently (PR #197 N-01).
    expect(line).toContain(`source: "Long", turns 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, and 22 more ranges (${positions.slice(10).join(', ')}).`);
  });
});

describe('when the prompt is taught (ADR 2026-11-04 D8)', () => {
  const jill = getWorkshopPersona('jill')!;
  const behavior = { interactionMode: 'conversational', expressionLevel: 'subtle', relationalDepth: 'reserved' } as const;

  it('adds the grammar to a participant prompt only while project memory is open', () => {
    const off = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior);
    const on = workshopPersonaSystemPromptPaths(WORKSHOP_HOST_BASE_PROMPT_PATH, jill, behavior, { projectMemory: true });
    expect(off).not.toContain('workshop-personas/project-memory-capability.md');
    // The proposal trailer (Slice 3) is taught beside it, under the same condition.
    expect(on.filter((entry) => !off.includes(entry))).toEqual([
      'workshop-personas/project-memory-capability.md',
      'workshop-personas/project-memory-proposals.md'
    ]);
    // It follows recall's grammar.
    expect(on.indexOf('workshop-personas/project-memory-capability.md'))
      .toBe(on.indexOf('workshop-personas/transcript-recall-capability.md') + 1);
  });

  it('never adds it to a prompt that is not a participant\'s', () => {
    expect(workshopPersonaSystemPromptPaths('workshop-tools/x.md', jill, behavior, { projectMemory: true }))
      .not.toContain('workshop-personas/project-memory-capability.md');
  });
});
