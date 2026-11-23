/**
 * A pair resolves to the file the group inventory lists for it (ADR
 * 2026-11-20 S50, as amended after PR #298). With overlapping groups the
 * browse listing keeps a shared file under the first group only, and it
 * merges files whose paths differ only by case or by workspace folder,
 * while `resource.catalog` lists every file of a group apart. Every reader
 * of `{ group, path }` (`resource.read`, `history.*` and the Read in
 * reader) names the file from the group's authoritative listing first, then
 * finds its browse entry by host identity; two files there, or a file the
 * browse listing merged away, are ambiguous, never another file. Only a
 * listing that cannot be read falls back to the browse listing alone. A
 * path in no group still misses. Two pairs naming one file in a read are
 * read once (S53). The real resolver walks a made-up *Alice* project.
 */
/* eslint-disable @typescript-eslint/naming-convention -- made-up roots, setting keys and files, keyed by their paths and names. */
import type { LogSink } from '@/platform';
import { DEFAULT_CONTEXT_GROUPS } from '@/domain/models/ContextGeneration';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { resolveConfiguredResource } from '@/application/services/ConfiguredResourceLookup';
import { WorkshopResourceCapability } from '@/application/services/workshop/WorkshopResourceCapability';
import { readWorkshopReadInResource, resolveWorkshopReadInResource } from '@/application/services/workshop/WorkshopReadInResource';
import { aliceProject, type AliceProjectOptions } from '../../contextPaths/aliceProject';
import { aliceCommits, fakeHistory, historyCapability } from '../history/historyFixtures';

const SHARED = 'Drafts/chapter-1.md';
const BOOK = [SHARED, 'Drafts/chapter-2.md', 'Drafts/outline.md', 'Notes/lore.md'];
// `chapters` comes before `manuscript`, so the browse listing keeps the shared chapters under `chapters`.
const SETTINGS = { 'contextPaths.chapters': 'Drafts/**', 'contextPaths.manuscript': 'Drafts/chapter-*.md' };
const TEXT = 'Alice was beginning to get very tired of sitting by her sister on the bank.';

function project(options: Partial<AliceProjectOptions> = {}) {
  const alice = aliceProject({ roots: { '/alice': BOOK }, settings: { ...SETTINGS }, ...options });
  const fileSystem = { ...alice.fileSystem, readFile: async (filePath: string) => new TextEncoder().encode(`${TEXT}\n(${filePath.split('/').pop()})`) };
  const resolver = new ContextResourceResolver(alice.settings, fileSystem, alice.workspace, alice.log);
  const listGroupFiles = jest.spyOn(resolver, 'listGroupFiles');
  const browse = async () => (await resolver.createProvider([...DEFAULT_CONTEXT_GROUPS])).listResources();
  return { alice, resolver, listGroupFiles, browse };
}

function resourceCapability(resolver: ContextResourceResolver) {
  const lines: string[] = [];
  const capability = new WorkshopResourceCapability(resolver, { appendLine: (line: string) => { lines.push(line); } } as unknown as LogSink,
    { requestId: 'host-1', personaId: 'jill', signal: new AbortController().signal });
  return { capability, lines };
}

async function readerCatalog(resolver: ContextResourceResolver) {
  const provider = await resolver.createProvider([...DEFAULT_CONTEXT_GROUPS]);
  return {
    entries: () => provider.listResources(),
    readText: async (summary: { group: string; path: string }) =>
      (await provider.loadResources([summary.path])).find((entry) => entry.group === summary.group && entry.path === summary.path)?.content
  };
}

describe('the browse listing and the inventory disagree on a shared file', () => {
  it('the browse listing keeps it under the first group; the second group\'s inventory lists it', async () => {
    const { resolver, browse } = project();
    expect((await browse()).filter((entry) => entry.path === SHARED).map((entry) => entry.group)).toEqual(['chapters']);
    const inventory = await resourceCapability(resolver).capability.fulfill({ capability: 'resource.catalog', group: 'manuscript' });
    expect(inventory.content).toContain(`- [manuscript] \`${SHARED}\``);
  });
});

describe('resolving a pair: the group\'s own listing names the file, the browse listing loads it', () => {
  it('a pair the browse listing also holds is named from the group\'s listing first', async () => {
    const { resolver, listGroupFiles, browse } = project();
    const lookup = await resolveConfiguredResource(await browse(), 'chapters', SHARED, resolver);
    expect(lookup).toMatchObject({ kind: 'found', resource: { group: 'chapters', path: SHARED } });
    expect(listGroupFiles).toHaveBeenCalledWith(['chapters']);
  });

  it('a miss the second group\'s listing holds resolves to the browse entry for the same file, by host identity', async () => {
    const { resolver, listGroupFiles, browse } = project();
    const lookup = await resolveConfiguredResource(await browse(), 'manuscript', SHARED, resolver);
    expect(lookup).toMatchObject({ kind: 'found', resource: { group: 'chapters', path: SHARED, absolutePath: `/alice/${SHARED}` } });
    expect(listGroupFiles).toHaveBeenCalledWith(['manuscript']);
    // A unique match ignoring letter case resolves too.
    expect(await resolveConfiguredResource(await browse(), 'manuscript', 'drafts/CHAPTER-1.md', resolver)).toMatchObject({ kind: 'found' });
  });

  it('a path in no configured group, or in another group only, still misses: containment is unchanged', async () => {
    const { resolver, browse } = project();
    expect(await resolveConfiguredResource(await browse(), 'manuscript', 'Notes/lore.md', resolver)).toEqual({ kind: 'missing' });
    // `outline.md` is a file of chapters, never of manuscript.
    expect(await resolveConfiguredResource(await browse(), 'manuscript', 'Drafts/outline.md', resolver)).toEqual({ kind: 'missing' });
    expect(await resolveConfiguredResource(await browse(), 'manuscript', '../outside.md', resolver)).toEqual({ kind: 'missing' });
  });

  it('the same path in two workspace folders is ambiguous, never the first folder\'s, even where the browse listing holds one', async () => {
    const { resolver, browse } = project({ roots: { '/alice': BOOK, '/looking-glass': [SHARED] } });
    // The browse listing merged the two into one entry, under the first group.
    expect((await browse()).filter((entry) => entry.path === SHARED)).toHaveLength(1);
    expect(await resolveConfiguredResource(await browse(), 'chapters', SHARED, resolver)).toEqual({ kind: 'ambiguous' });
    expect(await resolveConfiguredResource(await browse(), 'manuscript', SHARED, resolver)).toEqual({ kind: 'ambiguous' });
  });

  it('case-distinct files in one group: each exact path is its own file, never its sibling, and a folded path names neither', async () => {
    const { resolver, browse } = project({ roots: { '/alice': ['Drafts/Ch1.md', 'Drafts/ch1.md'] } });
    // The browse listing case-folds, so it keeps only the first of the two.
    const entries = (await browse()).filter((entry) => entry.path.toLowerCase() === 'drafts/ch1.md');
    expect(entries.map((entry) => entry.path)).toEqual(['Drafts/Ch1.md']);
    // A unique exact match beside a case sibling resolves to itself.
    expect(await resolveConfiguredResource(await browse(), 'chapters', 'Drafts/Ch1.md', resolver))
      .toMatchObject({ kind: 'found', resource: { path: 'Drafts/Ch1.md', absolutePath: '/alice/Drafts/Ch1.md' } });
    // The sibling the browse listing merged away is never read as the other file.
    expect(await resolveConfiguredResource(await browse(), 'chapters', 'Drafts/ch1.md', resolver)).toEqual({ kind: 'ambiguous' });
    // No exact match and two folded ones: ambiguous.
    expect(await resolveConfiguredResource(await browse(), 'chapters', 'drafts/CH1.md', resolver)).toEqual({ kind: 'ambiguous' });
  });

  it('a listing that cannot be read falls back to the browse listing alone, as before Slice 5', async () => {
    const { resolver, browse } = project();
    jest.spyOn(resolver, 'listGroupFiles').mockRejectedValue(new Error('scan failed'));
    // A pair the browse listing holds still reads; one it does not hold misses, as it did.
    expect(await resolveConfiguredResource(await browse(), 'chapters', SHARED, resolver)).toMatchObject({ kind: 'found', resource: { group: 'chapters' } });
    expect(await resolveConfiguredResource(await browse(), 'manuscript', SHARED, resolver)).toEqual({ kind: 'missing' });
  });
});

describe('every reader resolves the second group\'s pair', () => {
  it('resource.read reads it, and its card opens in the Read in reader', async () => {
    const { resolver } = project();
    const { capability, lines } = resourceCapability(resolver);
    const read = await capability.fulfill({ capability: 'resource.read', files: [{ group: 'manuscript', path: SHARED }] });
    expect(read.status).toBe('success');
    expect(read.content).toContain(TEXT);
    const rows = capability.deliveredSources(read);
    expect(rows).toHaveLength(1);
    const pair = rows[0].configuredResource!;
    // The read resolves to the browse entry, so its card names the file by the group the browse listing keeps it in.
    expect(pair).toEqual({ group: 'chapters', path: SHARED });
    // The card's recorded pair opens in the reader, and is the same text the read delivered.
    const opened = await readWorkshopReadInResource(await readerCatalog(resolver), resolver, pair.group, pair.path);
    expect(opened).toMatchObject({ kind: 'content', resource: { path: SHARED } });
    expect(opened.kind === 'content' && opened.fingerprint).toBe(rows[0].sourceFingerprint);
    expect(lines.join('\n')).not.toContain('Notes/');
  });

  it('the Read in reader resolves the second group\'s pair itself, and refuses a path in no group', async () => {
    const { resolver } = project();
    const catalog = await readerCatalog(resolver);
    expect(await readWorkshopReadInResource(catalog, resolver, 'manuscript', SHARED)).toMatchObject({ kind: 'content', resource: { path: SHARED } });
    expect(await resolveWorkshopReadInResource(catalog.entries(), resolver, 'manuscript', 'Notes/lore.md')).toEqual({ kind: 'refused', reason: 'not-configured' });
  });

  it('a read of several files lists each group it names once', async () => {
    const { resolver, listGroupFiles } = project();
    const { capability } = resourceCapability(resolver);
    const read = await capability.fulfill({
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: SHARED }, { group: 'manuscript', path: 'Drafts/chapter-2.md' }, { group: 'chapters', path: 'Drafts/outline.md' }]
    });
    expect(read.status).toBe('success');
    expect(listGroupFiles.mock.calls).toEqual([[['manuscript']], [['chapters']]]);
  });

  it('resource.read of a case sibling reads that file\'s own text, or refuses, never the other\'s', async () => {
    const { resolver } = project({ roots: { '/alice': ['Drafts/Ch1.md', 'Drafts/ch1.md'] } });
    const { capability } = resourceCapability(resolver);
    const exact = await capability.fulfill({ capability: 'resource.read', files: [{ group: 'chapters', path: 'Drafts/Ch1.md' }] });
    expect(exact.content).toContain('(Ch1.md)');
    const sibling = await capability.fulfill({ capability: 'resource.read', files: [{ group: 'chapters', path: 'Drafts/ch1.md' }] });
    expect(sibling.status).toBe('rejected');
    expect(sibling.content ?? '').not.toContain('(Ch1.md)');
  });

  it('history.log reads the second group\'s pair', async () => {
    const { resolver, browse } = project();
    const harness = historyCapability({ history: fakeHistory({ commits: aliceCommits(2) }), resources: await browse(), groupFiles: resolver });
    const result = await harness.capability.fulfill({ capability: 'history.log', file: { kind: 'configured', group: 'manuscript', path: SHARED } });
    expect(result.status).toBe('success');
    expect(harness.history.logCalls.map((call) => call.fsPath)).toEqual([`/alice/${SHARED}`]);
    const outside = await harness.capability.fulfill({ capability: 'history.log', file: { kind: 'configured', group: 'manuscript', path: 'Notes/lore.md' } });
    expect(outside.status).not.toBe('success');
    // Logs carry counts and closed outcomes: no path.
    expect(harness.lines.join('\n')).not.toMatch(/Drafts|Notes|chapter-1/);
  });

  it('the resolver logs counts only', async () => {
    const { resolver, alice, browse } = project();
    await resolveConfiguredResource(await browse(), 'manuscript', SHARED, resolver);
    expect(alice.lines.join('\n')).not.toMatch(/Drafts|Notes|chapter/);
  });
});

describe('two pairs naming one file in a read (S53)', () => {
  it('the later pair is its own same-file outcome: no text, no manifest row, no share, and no continuation names it', async () => {
    const { resolver } = project();
    const { capability } = resourceCapability(resolver);
    const read = await capability.fulfill({
      capability: 'resource.read',
      files: [{ group: 'chapters', path: SHARED }, { group: 'manuscript', path: SHARED }]
    });
    expect(read.status).toBe('partial');
    // One section of text, one manifest row.
    expect(read.content!.split(TEXT)).toHaveLength(2);
    expect(read.content).toContain('Not read: The requested path names the same file as an earlier path in this read, so it is read once, there.');
    const rows = capability.deliveredSources(read);
    expect(rows.map((row) => row.configuredResource)).toEqual([{ group: 'chapters', path: SHARED }]);
    const files = read.metadata!.files as Array<Record<string, unknown>>;
    expect(files[1]).toEqual({ group: 'manuscript', path: SHARED, outcome: 'same-file' });
    expect(files[1]).not.toHaveProperty('startLine');
    expect(read.metadata).toMatchObject({ filesNamed: 2, filesRead: 1 });
    expect(read.content).not.toMatch(/<group>manuscript<\/group>/);
  });
});
