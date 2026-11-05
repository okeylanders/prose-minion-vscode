/**
 * PR #208's review findings, as regressions (Slice 2b), through the real
 * store, intake service, library and seed:
 *
 * - F01: every seed read is bound to the workspace `prepare` captured. A
 *   switch to another project and back (A→B→A) while the list read is
 *   queued, while a catalog opens or loads, or while a file read is held,
 *   installs nothing from B, and the report says why. `describe()` holds
 *   one root the same way.
 * - F02: on POSIX a backslash is a file-name character, not a separator.
 * - F03: the exact catalog path wins; an ambiguous normalized match is
 *   left out, never picked by order.
 * - F04: a carried copy known by its source is kept, and said so, when its
 *   re-read is missing or unreadable.
 *
 * Astra's probes (`docs/pr-reviews/probes/pr-208-*.test.ts.txt`) are
 * promoted here. *Alice*, with made-up paths and text.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { workshopSessionStartResult } from '@/application/handlers/domain/workshop/WorkshopSessionStartResult';
import type { WorkshopSessionRecallScope } from '@/application/services/workshop/WorkshopSessionPersistenceCoordinator';
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';
import { deferred } from '@/__tests__/application/handlers/domain/lightboxHandlerHarness';
import { OTHER_ROOT, ROOT, seedHost } from './pinnedContextSeedHost';

const room = () => new WorkshopSessionService(() => Date.parse('2026-11-05T10:00:00.000Z'));
const MOVED = { pinnedCount: 0, attachedCount: 0, attachedWords: 0, leftOut: [{ label: 'pinned-context.json', reason: 'workspace-changed' }] };

/** Two projects: A pins Alice; B pins a private file of its own, and has an Alice of its own too. */
function twoProjects(catalog: Array<{ group: 'characters'; path: string }> = []) {
  const folders = [{ path: ROOT, name: 'novel' }];
  const host = seedHost({
    folders,
    catalog,
    // As the coordinator answers: its accepted workspace is A.
    scope: (): WorkshopSessionRecallScope => folders[0].path === ROOT
      ? { available: true, liveSessionId: 'room-A' }
      : { available: false, reason: 'workspace-changed' }
  });
  host.pin('Characters/alice.md');
  host.write('Characters/alice.md', 'Alice belongs to project A.');
  host.pinIn(OTHER_ROOT, 'Private/queen.md');
  host.write('Private/queen.md', 'Private facts from project B.', OTHER_ROOT);
  host.write('Characters/alice.md', 'Project B’s private Alice.', OTHER_ROOT);
  return host;
}

const fromB = (session: WorkshopSessionService) => session.getContextAttachments()
  .filter((attachment) => attachment.sourceUri?.startsWith(`file://${OTHER_ROOT}/`) || /project B/.test(attachment.content));

describe('F01: every seed read is bound to the workspace prepare captured', () => {
  it('Astra\'s probe: A→B→A during preparation installs nothing from B', async () => {
    const host = twoProjects();
    const read = host.fileSystem.readFile.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'readFile').mockImplementation(async (filePath) => {
      const bytes = await read(filePath);
      if (filePath === `${OTHER_ROOT}/Private/queen.md`) {
        host.moveTo(ROOT);
      }
      return bytes;
    });

    const preparing = host.seed.prepare('new');
    host.moveTo(OTHER_ROOT);
    const plan = await preparing;
    host.moveTo(ROOT);
    const session = room();
    const report = host.seed.install(plan, session);

    expect(fromB(session)).toEqual([]);
    expect(session.getContextAttachments()).toEqual([]);
    expect(report).toEqual(MOVED);
  });

  it('A→B→A while the list read is queued: the store reads nothing from B, and the report says why', async () => {
    const host = twoProjects();
    const preparing = host.seed.prepare('full-reset');
    host.moveTo(OTHER_ROOT);
    await Promise.resolve();
    const plan = await preparing;
    host.moveTo(ROOT);
    const session = room();

    const report = host.seed.install(plan, session);

    expect(session.getContextAttachments()).toEqual([]);
    expect(report).toEqual(MOVED);
    expect(workshopSessionStartResult('full-reset', report)).toBe(
      'Started a new Workshop session with the excerpt and context cleared. ' +
      'No pinned context attached: pinned-context.json (the project folder changed while it was read).'
    );
    expect(host.lines).toContain('[WorkshopPinnedContext] Seed read withdrawn: the workspace changed before the list was read');
    expect(host.lines.join('\n')).not.toMatch(/\/workspace|alice|queen/);
  });

  it('A→B→A while the catalog opens: B\'s rows are never read, and nothing is installed', async () => {
    const host = twoProjects([{ group: 'characters', path: 'Characters/alice.md' }]);
    const opening = deferred<void>();
    const create = host.providerFactory.createProvider.getMockImplementation()!;
    host.providerFactory.createProvider.mockImplementationOnce(async () => {
      await opening.promise;
      return create();
    });

    const preparing = host.seed.prepare('new');
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.moveTo(OTHER_ROOT);
    opening.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.moveTo(ROOT);
    const session = room();
    const report = host.seed.install(await preparing, session);

    expect(fromB(session)).toEqual([]);
    expect(report).toEqual(MOVED);
    expect(host.fileSystem.readFileCalls).not.toContain(`${OTHER_ROOT}/Characters/alice.md`);
  });

  it('A→B→A while a catalog load is held: the load reads the file A\'s catalog listed', async () => {
    const host = twoProjects([{ group: 'characters', path: 'Characters/alice.md' }]);
    const loading = deferred<void>();
    const catalogOf = host.intake.openCatalog.bind(host.intake);
    jest.spyOn(host.intake, 'openCatalog').mockImplementation(async () => {
      const catalog = await catalogOf();
      const load = catalog.load.bind(catalog);
      jest.spyOn(catalog, 'load').mockImplementation(async (ref, bounds) => {
        await loading.promise;
        return load(ref, bounds);
      });
      return catalog;
    });

    const preparing = host.seed.prepare('new');
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.moveTo(OTHER_ROOT);
    loading.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.moveTo(ROOT);
    const session = room();
    host.seed.install(await preparing, session);

    expect(fromB(session)).toEqual([]);
    expect(session.getContextAttachments().map((attachment) => attachment.content)).toEqual(['Alice belongs to project A.']);
  });

  it('A→B→A while a workspace file read is held: authorization can\'t move the read to B, and nothing is installed', async () => {
    const host = twoProjects();
    const statting = deferred<void>();
    const reached = deferred<void>();
    const stat = host.fileSystem.stat.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'stat').mockImplementation(async (filePath) => {
      if (filePath === `${ROOT}/Characters/alice.md`) {
        reached.resolve();
        await statting.promise;
      }
      return stat(filePath);
    });

    const preparing = host.seed.prepare('new');
    await reached.promise;
    host.moveTo(OTHER_ROOT);
    statting.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    host.moveTo(ROOT);
    const session = room();
    const report = host.seed.install(await preparing, session);

    expect(fromB(session)).toEqual([]);
    expect(report).toEqual(MOVED);
    expect(host.lines).toContain('[WorkshopPinnedContext] Seed read withdrawn: the workspace changed while pinned files were read (files=1)');
  });

  it('describe() holds one root: a switch while the list is queued describes nothing of B', async () => {
    const host = twoProjects();
    const describing = host.library.describe();
    host.moveTo(OTHER_ROOT);
    const description = await describing;
    host.moveTo(ROOT);

    expect(description).toMatchObject({ state: 'unavailable', reason: 'workspace-changed' });
    expect(JSON.stringify(description)).not.toMatch(/queen/);
  });

  it('describe() withdraws a description whose files would come from B', async () => {
    const host = twoProjects();
    const reached = deferred<void>();
    const statting = deferred<void>();
    const stat = host.fileSystem.stat.bind(host.fileSystem);
    jest.spyOn(host.fileSystem, 'stat').mockImplementation(async (filePath) => {
      if (filePath === `${ROOT}/Characters/alice.md`) {
        reached.resolve();
        await statting.promise;
      }
      return stat(filePath);
    });

    const describing = host.library.describe();
    await reached.promise;
    host.moveTo(OTHER_ROOT);
    statting.resolve();

    expect(await describing).toMatchObject({ state: 'unavailable', reason: 'workspace-changed' });
  });
});

describe('F02: on POSIX a backslash is a file-name character', () => {
  it('Astra\'s probe: an unpinned Characters\\alice.md is never overwritten by a pinned Characters/alice.md', async () => {
    const host = seedHost({ platform: 'posix' });
    host.pin('Characters/alice.md');
    host.write('Characters/alice.md', 'Alice is nine.');
    host.write('Characters\\alice.md', 'The unrelated Alice notes.');
    const session = room();
    const carried = session.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'Characters\\alice.md', content: 'The unrelated Alice notes.', words: 4,
      sourceUri: `file://${ROOT}/Characters%5Calice.md`, relativePath: 'Characters\\alice.md'
    });
    if (!carried.ok) {
      throw new Error('fixture');
    }

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(workshopPinnedContextMatches({ path: 'Characters/alice.md' }, carried.attachment, 'posix')).toBe(false);
    expect(session.getContextAttachments()).toHaveLength(2);
    expect(session.getContextAttachment(carried.attachment.id)?.content).toBe('The unrelated Alice notes.');
    expect(report.attachedCount).toBe(1);
  });
});

describe('F03: the exact catalog path wins; an ambiguous one is never picked by order', () => {
  it('Astra\'s probe: loads the exact pinned POSIX path when distinct catalog names share an NFC key', async () => {
    const nfd = 'Characters/café.md';
    const nfc = 'Characters/café.md';
    const host = seedHost({ platform: 'posix', catalog: [{ group: 'characters', path: nfd }, { group: 'characters', path: nfc }] });
    host.write(nfd, 'The decomposed filename has different content.');
    host.write(nfc, 'The exact pinned filename is this one.');
    host.pin(nfc);
    const session = room();

    host.seed.install(await host.seed.prepare('new'), session);

    expect(session.getContextAttachments()[0]).toMatchObject({ content: 'The exact pinned filename is this one.', relativePath: nfc });
  });

  it('a single normalized match is still read, under the catalog\'s spelling', async () => {
    const nfd = 'Characters/café.md';
    const host = seedHost({ platform: 'posix', catalog: [{ group: 'characters', path: nfd }] });
    host.write(nfd, 'The café at the end of the lane.');
    host.pin('Characters/café.md');
    const session = room();

    host.seed.install(await host.seed.prepare('new'), session);

    expect(session.getContextAttachments()[0]).toMatchObject({ relativePath: nfd, configuredResource: { group: 'characters', path: nfd } });
  });

  it('several distinct rows under one key, and none exact: left out as ambiguous, nothing attached', async () => {
    const host = seedHost({
      platform: 'windows',
      catalog: [{ group: 'characters', path: 'Characters/Alice.md' }, { group: 'characters', path: 'Characters/ALICE.md' }]
    });
    host.write('Characters/Alice.md', 'One Alice.');
    host.write('Characters/ALICE.md', 'Another Alice.');
    host.pin('Characters/alice.md');
    const session = room();

    const report = host.seed.install(await host.seed.prepare('first'), session);

    expect(session.getContextAttachments()).toEqual([]);
    expect(report.leftOut).toEqual([{ label: 'alice.md', reason: 'unreadable' }]);
    const description = await host.library.describe();
    expect(description.state === 'listed' && description.rows[0]).toMatchObject({ state: 'unreadable', fault: 'ambiguous' });
  });
});

describe('F04: a carried copy known by its source is kept when its re-read fails', () => {
  it.each(['missing', 'unreadable'] as const)('Astra\'s probe: the same-source carried alias stays identifiable when its read is %s', async (state) => {
    const host = seedHost();
    host.pin('Characters/alice.md');
    if (state === 'unreadable') {
      host.write('Characters/alice.md', '   ');
    }
    const session = room();
    session.addContextAttachment({
      kind: 'file', origin: 'writer', label: 'alice.md', content: 'Alice is seven.', words: 3,
      sourceUri: `file://${ROOT}/Characters/alice.md`, relativePath: 'External file: alice.md'
    });

    const report = host.seed.install(await host.seed.prepare('new'), session);

    expect(session.getContextAttachments()[0].content).toBe('Alice is seven.');
    expect(report.leftOut).toEqual([{ label: 'alice.md', reason: state, kept: true }]);
    expect(workshopSessionStartResult('carry', report)).not.toContain('not attached');
  });
});
