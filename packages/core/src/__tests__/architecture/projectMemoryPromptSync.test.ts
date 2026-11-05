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
 *   `transcript.read` of the turns it names.
 */
import * as fs from 'fs';
import * as path from 'path';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import { PROJECT_MEMORY_FIELD_CHARACTERS, PROJECT_MEMORY_KINDS } from '@shared/types/projectMemory';
import { WORKSHOP_MEMORY_SEARCH_STATUSES } from '@shared/types/workshopCapabilities';
import { WorkshopCapabilityXmlCodec, type WorkshopCapabilityInspection } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { projectMemoryProvenanceLine } from '@/application/services/workshop/memory/WorkshopProjectMemoryCopy';
import { workshopPersonaSystemPromptPaths, WORKSHOP_HOST_BASE_PROMPT_PATH, getWorkshopPersona } from '@shared/constants/workshopPersonas';

const PROMPT = fs.readFileSync(path.resolve(__dirname,
  '../../../resources/system-prompts/workshop-personas/project-memory-capability.md'), 'utf8');
const budgets = PROMPT_BUDGETS.workshopProjectMemory;
const codec = new WorkshopCapabilityXmlCodec();
const number = (quoted: string): number => Number(quoted.replace(/,/g, ''));
const prose = PROMPT.replace(/```[\s\S]*?```/g, '');

describe('project-memory prompt ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
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
});

describe('project-memory prompt examples, through the real codec', () => {
  const blocks = [...PROMPT.matchAll(/```xml\n([\s\S]*?)```/g)].map((block) => ({
    xml: block[1].trim(),
    lead: PROMPT.slice(0, block.index).trimEnd().split('\n').at(-1)!
  }));
  const expected: WorkshopCapabilityInspection[] = [
    { kind: 'request', request: { capability: 'memory.catalog', kind: 'decision' } },
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
