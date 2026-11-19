/**
 * The `locations.*` family over the real *Alice* project, scan, checker and
 * resolver (ADR 2026-11-19 D26, D28): what each call answers, paging to the
 * end with every hint decoding as written, a check that writes nothing, and
 * logs that carry no name, path or pattern.
 */
import { WorkshopCapabilityXmlCodec } from '@/application/services/workshop/WorkshopCapabilityXmlCodec';
import { WorkshopLocationsCapability } from '@/application/services/workshop/locations/WorkshopLocationsCapability';
import { ProjectFolderScan } from '@/application/services/contextPaths/ProjectFolderScan';
import { PROMPT_BUDGETS } from '@shared/constants/promptBudgets';
import type { WorkshopLocationsRequest } from '@shared/types/workshopCapabilities';
import { aliceChecker } from '@/__tests__/application/services/contextPaths/aliceChecker';
import { ALICE_NAMES } from '@/__tests__/application/services/contextPaths/aliceProject';

const codec = new WorkshopCapabilityXmlCodec();

function family(options: Parameters<typeof aliceChecker>[0] = {}) {
  const alice = aliceChecker(options);
  const lines: string[] = [];
  const log = { appendLine: (line: string) => { lines.push(line); }, show: () => undefined, clear: () => undefined };
  const scan = new ProjectFolderScan(alice.project.fileSystem, alice.project.workspace, log);
  const capability = new WorkshopLocationsCapability({ scan, checker: alice.checker }, log, {
    requestId: 'req-1', personaId: 'jill', signal: new AbortController().signal
  });
  return { ...alice, capability, lines };
}

function request(xml: string): WorkshopLocationsRequest {
  const inspected = codec.inspect(xml);
  if (inspected.kind !== 'request') {
    throw new Error(`Did not decode: ${JSON.stringify(inspected)}`);
  }
  return inspected.request as WorkshopLocationsRequest;
}

function expectNoNames(lines: readonly string[]): void {
  for (const name of ALICE_NAMES) {
    expect(lines.join('\n')).not.toContain(name);
  }
}

describe('locations.current', () => {
  it('lists every group with its patterns, level and count, and logs counts only', async () => {
    const { capability, lines } = family();
    const result = await capability.fulfill({ capability: 'locations.current' });
    expect(result.status).toBe('success');
    expect(result.content).toContain('- characters (Characters) · from the writer\'s own settings, for every project · patterns `characters/**/*` · 0 files');
    expect(result.content).toContain('- themes (Themes) · from the writer\'s own settings, for every project · no patterns · 0 files');
    expect(result.metadata).toMatchObject({ outcome: 'current', groups: 8, groupsUncounted: 0 });
    expectNoNames(lines);
  });

  it('says a group the workspace sets can\'t be applied, and a failed search can\'t be counted', async () => {
    const { capability } = family({
      levels: { 'contextPaths.chapters': 'workspace' },
      failingGlobs: ['locations/**/*']
    });
    const result = await capability.fulfill({ capability: 'locations.current' });
    expect(result.status).toBe('partial');
    expect(result.content).toContain('chapters (Draft Chapters & Outlines) · from this workspace\'s settings file, which Apply can\'t change');
    expect(result.content).toContain('patterns `locations/**/*` · couldn\'t be counted completely');
  });

  it('answers in host words when no folder is open', async () => {
    const { capability } = family({ roots: {} });
    const result = await capability.fulfill({ capability: 'locations.current' });
    expect(result.status).toBe('failed');
    expect(result.metadata).toMatchObject({ outcome: 'no-workspace' });
    expect(result.content).toContain('No project folder is open');
  });
});

describe('locations.folders', () => {
  it('lists folders by name with their counts, never contents', async () => {
    const { capability, lines } = family();
    const result = await capability.fulfill({ capability: 'locations.folders' });
    expect(result.content).toContain('- Cast · 3 .md, 0 .txt · Alice.md, Mad Hatter.md, Queen of Hearts.md');
    expect(result.content).toContain('- . · 1 .md, 0 .txt · synopsis.md');
    expect(result.content).not.toContain('The next page:');
    expectNoNames(lines);
  });

  it('pages to the end, each hint decoding as written to the next page, and a page past the end in words', async () => {
    const many = Array.from({ length: PROMPT_BUDGETS.contextPaths.foldersPerPage * 2 + 3 }, (_, index) => `Shelf ${String(index).padStart(3, '0')}/note.md`);
    const { capability } = family({ roots: { '/alice': many } });
    let next: WorkshopLocationsRequest | undefined = { capability: 'locations.folders' };
    const pages: number[] = [];
    let shown = 0;
    while (next) {
      const result = await capability.fulfill(next);
      pages.push((result.metadata as { page: number }).page);
      shown += (result.metadata as { foldersShown: number }).foldersShown;
      const hint = /The next page: (.*)$/m.exec(result.content!)?.[1];
      next = hint ? request(hint) : undefined;
      if (next?.capability === 'locations.folders') {
        expect(next.page).toBe(pages.at(-1)! + 1);
      }
    }
    expect(pages).toEqual([1, 2, 3]);
    // Every folder holding a file, plus the top folder that holds them.
    expect(shown).toBe(many.length + 1);
    const past = await capability.fulfill({ capability: 'locations.folders', page: 9 });
    expect(past.content).toContain('Page 9 is past the end: 104 folders, 3 pages.');
    expect(past.content).not.toContain('<prose-minion-tool-call');
  });
});

describe('locations.check', () => {
  it('runs proposed patterns through the checker and writes nothing', async () => {
    const { capability, project, lines } = family();
    const result = await capability.fulfill(request(
      '<prose-minion-tool-call name="locations.check">' +
      '<pattern group="characters">Cast/**/*</pattern>' +
      '<pattern group="characters">People/**/*</pattern>' +
      '<pattern group="locations">../Wonderland/**</pattern>' +
      '</prose-minion-tool-call>'
    ));
    expect(result.content).toContain('- characters (Characters) · 3 files in all · Apply would offer this group.');
    expect(result.content).toContain('  Kept: `Cast/**/*` · 3 files');
    expect(result.content).toContain('  Left out: `People/**/*` · matches no file');
    expect(result.content).toContain('  Left out: `../Wonderland/**` · climbs out of the project with ..');
    expect(result.content).toContain('Nothing was written');
    expect(result.metadata).toMatchObject({ outcome: 'check', patterns: 3, kept: 1, unmatched: 1, refused: 1, incomplete: 0 });
    expect(project.settings.writes).toEqual([]);
    expectNoNames(lines);
  });
});

describe('the codec (D26)', () => {
  const call = (name: string, body: string) => `<prose-minion-tool-call name="${name}">${body}</prose-minion-tool-call>`;
  const pattern = (value: string, group = 'characters') => `<pattern group="${group}">${value}</pattern>`;

  it('refuses each malformed request by its reason, naming the operation', () => {
    const cases: Array<[string, string]> = [
      [call('locations.current', '<page>1</page>'), 'unexpected-field'],
      [call('locations.folders', '<page></page>'), 'invalid-page'],
      [call('locations.check', ''), 'missing-field'],
      [call('locations.check', pattern('a').repeat(PROMPT_BUDGETS.contextPaths.checkPatterns + 1)), 'too-many-patterns'],
      [call('locations.check', pattern('a'.repeat(PROMPT_BUDGETS.contextPaths.patternCharacters + 1))), 'oversized-input'],
      [call('locations.check', '<pattern group="characters"></pattern>'), 'empty-field'],
      [call('locations.check', '<pattern group="characters" kind="x">a</pattern>'), 'field-attributes']
    ];
    for (const [xml, reason] of cases) {
      expect([xml.slice(0, 60), codec.inspect(xml)]).toEqual([xml.slice(0, 60), expect.objectContaining({ kind: 'invalid', reason })]);
    }
  });

  it('reads up to the bound, each pattern with its group, as written', () => {
    const many = Array.from({ length: PROMPT_BUDGETS.contextPaths.checkPatterns }, (_, index) => pattern(`Shelf ${index}/*`, index % 2 ? 'locations' : 'characters')).join('');
    const decoded = request(call('locations.check', many));
    expect(decoded).toMatchObject({ capability: 'locations.check' });
    expect((decoded as Extract<WorkshopLocationsRequest, { capability: 'locations.check' }>).patterns[1]).toEqual({ group: 'locations', pattern: 'Shelf 1/*' });
  });
});
