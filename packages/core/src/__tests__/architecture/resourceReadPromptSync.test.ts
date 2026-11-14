/**
 * Guard the `resource.*` half of the capability instruction (ADR 2026-11-14
 * D8) against drift from the code it teaches, as transcriptRecallPromptSync
 * does for recall:
 *
 * - every number it quotes is pinned to PROMPT_BUDGETS, and it quotes no
 *   other number;
 * - every XML form it shows decodes through the real codec to the request
 *   the prose describes, and every refusal it names is the reason the codec
 *   gives;
 * - the continuation form it teaches is the form the read's renderer
 *   writes, and every hint a real read emits decodes alone, exactly as
 *   written, to a read that makes progress.
 */

import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import {
  createWorkshopCapabilityInstruction,
  WorkshopCapabilityXmlCodec,
  type WorkshopCapabilityInspection
} from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import {
  WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE,
  workshopResourceInstructionLines
} from '@/application/services/workshop/WorkshopResourceInstruction';
import {
  aliceCapability,
  aliceLines,
  decodeHint,
  hintsIn,
  manuscript,
  windowWith
} from '@/__tests__/application/services/workshop/resource/resourceReadFixtures';

const budgets = PROMPT_BUDGETS.workshopResource;
const codec = new WorkshopCapabilityXmlCodec();
const GROUPS = [{ group: 'chapters' as const, fileCount: 12 }, { group: 'characters' as const, fileCount: 4 }];
const LINES = workshopResourceInstructionLines(GROUPS);
const isXml = (line: string): boolean => line.trimStart().startsWith('<');
/** The instruction's prose: no XML line, and not the catalog's own file counts. */
const prose = LINES.filter((line) => !isXml(line) && !line.startsWith('Available groups and file counts:')).join('\n');

/** Each XML form the instruction shows: a call over several lines, or whole on one. */
function taughtCalls(): string[] {
  const calls: string[] = [];
  let open: string[] | undefined;
  for (const line of LINES) {
    if (open) {
      open.push(line);
      if (line.startsWith('</prose-minion-tool-call>')) {
        calls.push(open.join('\n'));
        open = undefined;
      }
    } else if (line.startsWith('<prose-minion-tool-call ')) {
      if (line.endsWith('</prose-minion-tool-call>')) {
        calls.push(line);
      } else {
        open = [line];
      }
    }
  }
  return calls;
}

describe('resource instruction ↔ PROMPT_BUDGETS', () => {
  const pinned: ReadonlyArray<readonly [RegExp, number[]]> = [
    [/One read may name up to (\d+) files\./, [budgets.readPaths]],
    [/Resource ceilings are (\d+) catalog entries, (\d+) search matches, and (\d+) read bytes for a read of one file\. A read naming more shares (\d+) read bytes fairly between its files\./,
      [budgets.catalogItems, budgets.searchMatches, budgets.readBytes, budgets.readBytesMulti]],
    [/Search scans at most (\d+) files, (\d+) source bytes per file, and (\d+) source bytes total;/,
      [budgets.searchFiles, budgets.searchFileBytes, budgets.searchTotalBytes]],
    [/Reads refuse source files larger than (\d+) bytes before loading them\./, [budgets.readSourceBytes]],
    [/Reads use a (\d+)-line default window from line 1 of each file\./, [budgets.readDefaultLines]],
    [/but the (\d+)-byte hard ceiling cannot be overridden;/, [budgets.readBytes]],
    [/A read is refused, with the room it had, when that holds less than (\d+) bytes for each file;/, [budgets.readMinimumBytes]],
    [/When the size of your context window is unknown, the file reads of one user turn share (\d+) bytes instead\./, [budgets.readBytesMulti]],
    [/Search queries may contain at most (\d+) characters and paths at most (\d+) characters\./,
      [budgets.queryCharacters, budgets.pathCharacters]]
  ];

  it.each(pinned)('quotes %s from PROMPT_BUDGETS', (pattern, expected) => {
    const match = pattern.exec(prose);
    expect(match).not.toBeNull();
    expect(match!.slice(1).map(Number)).toEqual(expected);
  });

  it('quotes no number it does not pin', () => {
    const unpinned = pinned.reduce((text, [pattern]) => text.replace(new RegExp(pattern.source, 'g'), ''), prose);
    expect(unpinned.match(/\d[\d,.]*/g)).toBeNull();
  });

  it('says how the read is fitted, in the renderer\'s own words', async () => {
    expect(prose).toContain('Every read is also fitted to your context window: it delivers at most half the room left, and says so at its top when that limited it.');
    const { read } = aliceCapability([manuscript('alice-ch1.md', aliceLines(2_000, 99))]);
    const limited = await read(['alice-ch1.md'], { endLine: 2_000, window: windowWith(8_000) });
    expect(limited.content).toMatch(/^This read was limited to [\d,]+ bytes, half the room left in your context window\./);
  });

  it('is the text the capability instruction carries, and only with configured files', () => {
    expect(createWorkshopCapabilityInstruction(GROUPS).endsWith(LINES.join('\n'))).toBe(true);
    const unavailable = createWorkshopCapabilityInstruction([]);
    expect(unavailable).toContain('Do not call resource.catalog, resource.search, or resource.read.');
    expect(unavailable).not.toContain('name="resource.read"');
  });
});

describe('resource instruction forms, through the real codec', () => {
  const expected: WorkshopCapabilityInspection[] = [
    { kind: 'request', request: { capability: 'resource.catalog', group: 'characters' } },
    { kind: 'request', request: { capability: 'resource.search', query: 'Raven', group: 'characters' } },
    {
      kind: 'request',
      request: { capability: 'resource.read', files: [{ group: 'characters', path: 'characters/raven.md' }], startLine: 1, endLine: 400 }
    },
    {
      kind: 'request',
      request: {
        capability: 'resource.read',
        files: [
          { group: 'chapters', path: 'chapters/chapter-01.md' },
          { group: 'chapters', path: 'chapters/chapter-02.md' },
          { group: 'characters', path: 'characters/raven.md' }
        ]
      }
    },
    {
      kind: 'request',
      request: { capability: 'resource.read', files: [{ group: 'chapters', path: 'chapters/chapter-02.md' }], startLine: 212 }
    }
  ];

  it('shows exactly the forms this test decodes', () => {
    expect(taughtCalls()).toHaveLength(expected.length);
  });

  it.each(expected.map((inspection, index) => [index + 1, inspection] as const))(
    'form %i decodes to the request it describes',
    (ordinal, inspection) => {
      expect(codec.inspect(taughtCalls()[ordinal - 1])).toEqual(inspection);
    }
  );

  it('shows the default window it states', () => {
    expect(taughtCalls()[2]).toContain(`<endLine>${budgets.readDefaultLines}</endLine>`);
  });

  it('names the refusals the codec gives', () => {
    const read = (body: string): string => `<prose-minion-tool-call name="resource.read"><group>chapters</group>${body}</prose-minion-tool-call>`;
    const reason = (call: string): string | undefined => {
      const inspection = codec.inspect(call);
      return inspection.kind === 'invalid' ? inspection.reason : undefined;
    };
    const named = [...prose.matchAll(/refused as ([a-z-]+)/g)].map(([, name]) => name);

    expect(named).toEqual(['duplicate-path', 'ambiguous-lines']);
    // "the same file twice, even in different letter case"
    expect(reason(read('<path>chapters/chapter-01.md</path><path>chapters/chapter-01.md</path>'))).toBe('duplicate-path');
    expect(reason(read('<path>chapters/Chapter-01.md</path><path>chapters/chapter-01.md</path>'))).toBe('duplicate-path');
    // "accepted only beside exactly one <path>"
    expect(reason(read('<path>chapters/chapter-01.md</path><path>chapters/chapter-02.md</path><startLine>1</startLine>'))).toBe('ambiguous-lines');
    expect(reason(read('<path>chapters/chapter-01.md</path><endLine>40</endLine>'))).toBeUndefined();
    // "up to N files"
    const paths = (count: number): string => Array.from({ length: count }, (_, index) => `<path>chapters/chapter-${index}.md</path>`).join('');
    expect(reason(read(paths(budgets.readPaths)))).toBeUndefined();
    expect(reason(read(paths(budgets.readPaths + 1)))).toBe('too-many-paths');
    // "<group> is required once"
    expect(reason('<prose-minion-tool-call name="resource.read"><path group="chapters">chapters/chapter-01.md</path></prose-minion-tool-call>'))
      .toBe('missing-field');
  });

  it('teaches that two continuations written together are refused, and they are', () => {
    expect(prose).toContain('Each continuation is its own call: two written together are two calls, and are refused.');
    expect(codec.inspect(`${WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE}\n${WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE}`))
      .toMatchObject({ kind: 'invalid', reason: 'mixed-content', callMarkerCount: 2 });
  });

  it('still decodes the call a conversation frozen before this grammar was taught', () => {
    // The earlier instruction's only read form: one group, one path, optional lines.
    expect(codec.inspect([
      '<prose-minion-tool-call name="resource.read">',
      '  <group>characters</group>',
      '  <path>characters/raven.md</path>',
      '  <startLine>1</startLine>',
      '  <endLine>400</endLine>',
      '</prose-minion-tool-call>'
    ].join('\n'))).toEqual(expected[2]);
  });
});

describe('resource instruction continuation, against the renderer', () => {
  /** The taught form as a whole-line pattern: any group, any path, any line. */
  const form = new RegExp(`^${
    WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace('<group>chapters</group>', '<group>[A-Za-z]+</group>')
      .replace('<path>chapters/chapter-02\\.md</path>', '<path>[^<>]+</path>')
      .replace('<startLine>212</startLine>', '<startLine>[1-9]\\d*</startLine>')
  }$`);
  const longLine = (bytes: number): string => 'curiouser and curiouser '.repeat(Math.ceil(bytes / 24)).slice(0, bytes);

  /** Real reads that end each way a read can end with a hint. */
  const reads: ReadonlyArray<readonly [string, () => Promise<{ hints: string[]; startLines: number[] }>]> = [
    ['the byte ceiling', async () => {
      const { read } = aliceCapability([manuscript('alice-ch1.md', aliceLines(2_000, 99))]);
      return collect(await read(['alice-ch1.md'], { endLine: 2_000 }));
    }],
    ['the default window', async () => {
      const { read } = aliceCapability([manuscript('alice-ch1.md', aliceLines(900))]);
      return collect(await read(['alice-ch1.md'], { startLine: 101 }));
    }],
    ['the window fit, over several files', async () => {
      const { read } = aliceCapability([
        manuscript('alice-ch1.md', aliceLines(2_000, 99)),
        { group: 'characters', path: 'cast/tweedledum & tweedledee.md', content: aliceLines(2_000, 99) }
      ]);
      return collect(await read(['alice-ch1.md', { group: 'characters', path: 'cast/tweedledum & tweedledee.md' }], { window: windowWith(12_000) }));
    }],
    ['a line over its share, which fits alone', async () => {
      const files = Array.from({ length: 5 }, (_, index) => manuscript(`alice-ch${index + 1}.md`, `${longLine(60 * 1024)}\nMore.`));
      const { read } = aliceCapability(files);
      return collect(await read(files.map((file) => file.path)));
    }],
    ['a line no read of one file holds, passed over', async () => {
      const { read } = aliceCapability([manuscript('alice-ch1.md', `${longLine(70 * 1024)}\nMore.`)]);
      return collect(await read(['alice-ch1.md']));
    }]
  ];

  function collect(result: Parameters<typeof hintsIn>[0]): { hints: string[]; startLines: number[] } {
    const hints = hintsIn(result);
    return { hints, startLines: hints.map((hint) => decodeHint(hint).startLine!) };
  }

  it.each(reads)('writes the taught form at %s, and it decodes alone as written', async (_label, run) => {
    const { hints } = await run();

    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint).toMatch(form);
      const request = decodeHint(hint);
      // The plain one-path form: one file, a start line, nothing else.
      expect(Object.keys(request).sort()).toEqual(['capability', 'files', 'startLine']);
      expect(request.files).toHaveLength(1);
    }
  });

  it('names where each read stopped', async () => {
    const startLines = Object.fromEntries(await Promise.all(reads.map(async ([label, run]) => [label, (await run()).startLines] as const)));

    expect(startLines['the default window']).toEqual([101 + budgets.readDefaultLines]);
    expect(startLines['a line over its share, which fits alone']).toEqual([1, 1, 1, 1, 1]);
    expect(startLines['a line no read of one file holds, passed over']).toEqual([2]);
    expect(startLines['the byte ceiling']).toEqual([Math.floor((budgets.readBytes + 1) / 100) + 1]);
    expect(startLines['the window fit, over several files']).toHaveLength(2);
  });

  it('is the example the instruction shows, written by the renderer itself', () => {
    expect(LINES).toContain(WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE);
    expect(WORKSHOP_RESOURCE_CONTINUATION_EXAMPLE).toMatch(form);
    expect(prose).toContain('A file that stopped early ends its section with a complete call on one line, in this form:');
    expect(prose).toContain('Send that line alone, exactly as written, to continue that file.');
    expect(prose).toContain('is reported as line-too-long');
  });
});
