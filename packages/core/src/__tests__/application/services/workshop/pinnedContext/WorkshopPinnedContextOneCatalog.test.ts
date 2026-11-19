/**
 * One project catalog per pinned-context read (tech debt 2026-11-18): a New
 * room's seed, a full reset and Attach missing each build the catalog once,
 * however many pinned files are read through the workspace door. Before, each
 * workspace file's authorization built a catalog of its own. The reads'
 * outcomes are unchanged. *Alice*, with made-up paths and text.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { seedHost } from './pinnedContextSeedHost';

const room = () => new WorkshopSessionService(() => Date.parse('2026-11-05T10:00:00.000Z'));

const PINNED = [
  'Characters/alice.md',
  'Characters/the-hatter.md',
  'Characters/the-queen.md',
  'Places/garden.md',
  'Places/tea-party.md',
  'Project/brief.md'
];

function pinnedHost() {
  // One catalog row, so both doors are read: five through the workspace, one through the catalog.
  const host = seedHost({ catalog: [{ group: 'characters', path: 'Characters/alice.md' }] });
  for (const entry of PINNED) {
    host.write(entry, `Alice remembers ${entry.split('/').pop()}.`);
  }
  host.pin(...PINNED);
  return host;
}

describe('pinned context reads build one catalog each', () => {
  it.each(['first', 'new', 'full-reset'] as const)('a %s seed opens the catalog once for six pinned files', async (kind) => {
    const host = pinnedHost();
    const session = room();

    const report = host.seed.install(await host.seed.prepare(kind), session);

    expect(host.providerFactory.createProvider).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({ pinnedCount: 6, attachedCount: 6, leftOut: [] });
    expect(session.getContextAttachments().map((attachment) => attachment.configuredResource?.group))
      .toEqual(['characters', undefined, undefined, undefined, undefined, undefined]);
  });

  it('Attach missing reads the list against one catalog', async () => {
    const host = pinnedHost();

    const { read } = await host.library.readForRoom();

    expect(host.providerFactory.createProvider).toHaveBeenCalledTimes(1);
    expect(read).toMatchObject({ state: 'listed' });
  });

  it('a catalog that cannot be opened is tried once, and every file still reads as a workspace file', async () => {
    const host = pinnedHost();
    host.providerFactory.createProvider.mockRejectedValue(new Error('catalog unreadable'));
    const session = room();

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(host.providerFactory.createProvider).toHaveBeenCalledTimes(1);
    expect(report).toMatchObject({ pinnedCount: 6, attachedCount: 6, leftOut: [] });
  });

  it('the next read opens a fresh catalog: nothing is kept across operations', async () => {
    const host = pinnedHost();

    await host.seed.prepare('new');
    await host.seed.prepare('new');

    expect(host.providerFactory.createProvider).toHaveBeenCalledTimes(2);
  });
});
