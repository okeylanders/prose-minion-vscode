/**
 * A pair the group inventory lists always resolves (ADR 2026-11-20 S50).
 * With overlapping groups, the browse listing keeps a shared file under the
 * first group only, while `resource.catalog` lists it under each. Every
 * reader of `{ group, path }` (`resource.read`, `history.*` and the Read in
 * reader) tries the browse listing first and, only on a miss, the group's
 * authoritative listing, resolving to the browse entry for the same file.
 * A path in no group still misses. The real resolver walks a made-up
 * *Alice* project.
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

describe('resolving a pair: the browse listing first, the group\'s own listing only on a miss', () => {
  it('a browse hit never consults the authoritative listing', async () => {
    const { resolver, listGroupFiles, browse } = project();
    const lookup = await resolveConfiguredResource(await browse(), 'chapters', SHARED, resolver);
    expect(lookup).toMatchObject({ kind: 'found', resource: { group: 'chapters', path: SHARED } });
    expect(listGroupFiles).not.toHaveBeenCalled();
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

  it('the same path in two workspace folders is ambiguous, never the first folder\'s', async () => {
    const { resolver, browse } = project({ roots: { '/alice': BOOK, '/looking-glass': [SHARED] } });
    expect(await resolveConfiguredResource(await browse(), 'manuscript', SHARED, resolver)).toEqual({ kind: 'ambiguous' });
  });

  it('a listing that cannot be read misses, as the pair did before', async () => {
    const { resolver, browse } = project();
    jest.spyOn(resolver, 'listGroupFiles').mockRejectedValueOnce(new Error('scan failed'));
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

  it('a read of several files lists each group once, and a browse hit not at all', async () => {
    const { resolver, listGroupFiles } = project();
    const { capability } = resourceCapability(resolver);
    const read = await capability.fulfill({
      capability: 'resource.read',
      files: [{ group: 'manuscript', path: SHARED }, { group: 'manuscript', path: 'Drafts/chapter-2.md' }, { group: 'chapters', path: 'Drafts/outline.md' }]
    });
    expect(read.status).toBe('success');
    expect(listGroupFiles.mock.calls).toEqual([[['manuscript']]]);
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
