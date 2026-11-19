/**
 * The resolver's `matchPatterns` seam (ADR 2026-11-19 D22, D22a): the
 * catalog's own walk over patterns passed in, never read from settings;
 * `matched`, `unmatched` and `incomplete` kept apart; counts-only logs; and
 * the settings path unchanged. *Alice*.
 */
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { aliceProject, ALICE_NAMES } from '../../application/services/contextPaths/aliceProject';

const ROOT = '/alice';
const FILES = [
  'Cast/Alice.md',
  'Cast/Mad Hatter.md',
  'Cast/portrait.png',
  'Wonderland/Rabbit Hole.md',
  'Wonderland/notes.txt',
  'Linked/Queen.md',
  'node_modules/pkg/readme.md',
  'synopsis.md'
];

function resolverFor(options: Partial<Parameters<typeof aliceProject>[0]> = {}) {
  const project = aliceProject({ roots: { [ROOT]: FILES }, links: ['Linked'], ...options });
  const resolver = new ContextResourceResolver(project.settings, project.fileSystem, project.workspace, project.log);
  return { project, resolver };
}

describe('ContextResourceResolver.matchPatterns', () => {
  it('matches the given patterns, in order, with the catalog\'s rules: .md/.txt only, links and exclusions refused', async () => {
    const { resolver } = resolverFor();
    const result = await resolver.matchPatterns({
      characters: ['Cast/**/*', 'People/**/*'],
      locations: ['Wonderland/**/*', 'Linked/**/*'],
      projectBrief: ['synopsis.md']
    });
    expect(result?.characters?.map((match) => match.status)).toEqual(['matched', 'unmatched']);
    const cast = result!.characters![0];
    expect(cast.status === 'matched' && cast.files.map((file) => file.relativePath)).toEqual(['Cast/Alice.md', 'Cast/Mad Hatter.md']);
    expect(result?.locations?.map((match) => match.status)).toEqual(['matched', 'unmatched']);
    const place = result!.locations![0];
    expect(place.status === 'matched' && place.files.map((file) => file.relativePath)).toEqual(['Wonderland/Rabbit Hole.md', 'Wonderland/notes.txt']);
    // A bare name is normalized as the catalog normalizes it.
    expect(result?.projectBrief?.[0].status).toBe('matched');
  });

  it('agrees with the catalog for the same patterns', async () => {
    const { project, resolver } = resolverFor({ settings: { 'contextPaths.characters': 'Cast/**/*', 'contextPaths.locations': 'Wonderland/**/*' } });
    const catalog = (await resolver.createProvider(['characters', 'locations'])).listResources();
    const checked = await resolver.matchPatterns({ characters: ['Cast/**/*'], locations: ['Wonderland/**/*'] });
    const fromCheck = (['characters', 'locations'] as const).flatMap((group) =>
      checked![group]!.flatMap((match) => (match.status === 'matched' ? match.files.map((file) => `${group}:${file.relativePath}`) : [])));
    expect(fromCheck.sort()).toEqual(catalog.map((each) => `${each.group}:${each.path}`).sort());
    // The settings were read for the catalog only.
    expect(project.settings.writes).toEqual([]);
  });

  it('never reads a pattern from settings', async () => {
    const { project, resolver } = resolverFor({ settings: { 'contextPaths.characters': 'Wonderland/**/*' } });
    await resolver.matchPatterns({ characters: ['Cast/**/*'] });
    expect(project.searches).toEqual(['Cast/**/*']);
  });

  it('reports a failed search as incomplete, never as no matches (D22a)', async () => {
    const { resolver } = resolverFor({ failingGlobs: ['People/**/*'] });
    const result = await resolver.matchPatterns({ characters: ['People/**/*', 'Cast/**/*'] });
    expect(result?.characters?.map((match) => match.status)).toEqual(['incomplete', 'matched']);
  });

  it('reports an unreadable match as incomplete (D22a)', async () => {
    const { resolver } = resolverFor({ unreadable: ['Cast/Alice.md'] });
    const result = await resolver.matchPatterns({ characters: ['Cast/**/*'] });
    expect(result?.characters?.[0].status).toBe('incomplete');
  });

  it('answers nothing when no folder is open', async () => {
    const project = aliceProject({ roots: {} });
    const resolver = new ContextResourceResolver(project.settings, project.fileSystem, project.workspace, project.log);
    expect(await resolver.matchPatterns({ characters: ['Cast/**/*'] })).toBeUndefined();
  });

  it('names each root when several are open, and keys a file by its root', async () => {
    const project = aliceProject({ roots: { '/one': ['Cast/Alice.md'], '/two': ['Cast/Alice.md'] } });
    const resolver = new ContextResourceResolver(project.settings, project.fileSystem, project.workspace, project.log);
    const result = await resolver.matchPatterns({ characters: ['Cast/**/*'] });
    const match = result!.characters![0];
    expect(match.status === 'matched' && match.files.map((file) => file.rootName)).toEqual(['one', 'two']);
    expect(match.status === 'matched' && new Set(match.files.map((file) => file.key)).size).toBe(2);
  });

  it('logs counts only: no pattern, path or host message', async () => {
    const { project, resolver } = resolverFor({ failingGlobs: ['People/**/*'], unreadable: ['Wonderland/notes.txt'] });
    await resolver.matchPatterns({ characters: ['People/**/*', 'Cast/**/*'], locations: ['Wonderland/**/*', 'Linked/**/*'] });
    expect(project.lines).toHaveLength(1);
    expect(project.lines[0]).toMatch(/Pattern check: \d+ match\(es\), \d+ excluded match\(es\), \d+ incomplete read\(s\)\./);
    for (const name of [...ALICE_NAMES, 'Linked', 'failed', ROOT]) {
      expect(project.lines.join('\n')).not.toContain(name);
    }
  });
});
