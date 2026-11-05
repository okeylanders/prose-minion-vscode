/**
 * Astra's PR #208 nested-workspace probe
 * (`docs/pr-reviews/probes/pr-208-nested-workspace-binding.test.ts.txt`),
 * promoted as a regression. The only change from the probe is braces on its
 * four one-line `if`s, for the lint rule `curly`; its behavior and
 * assertions are as Astra wrote them.
 */
import { WorkshopSessionService } from '@/application/services/workshop/WorkshopSessionService';
import { ROOT, LIST_FILE, seedHost } from './pinnedContextSeedHost';

it('does not install a nested workspace catalog after A to nested B to A during preparation', async () => {
  const nested = `${ROOT}/other-project`;
  const folders = [{ path: ROOT, name: 'novel' }];
  const host = seedHost({ folders, scope: () => folders[0].path === ROOT
    ? { available: true, liveSessionId: 'room-A' }
    : { available: false, reason: 'workspace-changed' } });
  host.pin('Characters/alice.md');
  host.write('Characters/alice.md', 'Alice belongs to project A.');
  const otherFile = `${nested}/Characters/alice.md`;
  host.fileSystem.files.set(otherFile, new TextEncoder().encode('Private facts from project B.'));
  const reads: string[] = [];
  const read = host.fileSystem.readFile.bind(host.fileSystem);
  jest.spyOn(host.fileSystem, 'readFile').mockImplementation(async file => {
    reads.push(file);
    const bytes = await read(file);
    if (file === LIST_FILE) {
      folders.splice(0, 1, { path: nested, name: 'other' });
    }
    if (file === otherFile) {
      folders.splice(0, 1, { path: ROOT, name: 'novel' });
    }
    return bytes;
  });
  host.providerFactory.createProvider.mockImplementation(async () => {
    const root = folders[0].path;
    const summary = { group: 'characters' as const, path: 'Characters/alice.md', label: 'alice.md',
      sizeBytes: 30, absolutePath: `${root}/Characters/alice.md`, workspaceFolder: root };
    return {
      listResources: () => [summary],
      loadResources: async () => [{ ...summary,
        content: new TextDecoder().decode(await host.fileSystem.readFile(summary.absolutePath)) }]
    };
  });
  const plan = await host.seed.prepare('new');
  const room = new WorkshopSessionService(() => Date.now());
  host.seed.install(plan, room);
  expect(reads).not.toContain(otherFile);
  expect(room.getContextAttachments().some(a => a.sourceUri?.startsWith(`file://${nested}/`))).toBe(false);
});

it('does not follow workspace recovery into a nested project after A to nested B to A', async () => {
  const nested = `${ROOT}/other-project`;
  const folders = [{ path: ROOT, name: 'novel' }];
  const host = seedHost({ folders, scope: () => folders[0].path === ROOT
    ? { available: true, liveSessionId: 'room-A' }
    : { available: false, reason: 'workspace-changed' } });
  host.pin('Characters/alice.md');
  host.write('Characters/alice.md', 'Alice belongs to project A.');
  const otherFile = `${nested}/Characters/alice.md`;
  host.fileSystem.files.set(otherFile, new TextEncoder().encode('Private facts from project B.'));
  const reads: string[] = [];
  const read = host.fileSystem.readFile.bind(host.fileSystem);
  jest.spyOn(host.fileSystem, 'readFile').mockImplementation(async file => {
    reads.push(file);
    const bytes = await read(file);
    if (file === LIST_FILE) {
      folders.splice(0, 1, { path: nested, name: 'other' });
    }
    if (file === otherFile) {
      folders.splice(0, 1, { path: ROOT, name: 'novel' });
    }
    return bytes;
  });
  const plan = await host.seed.prepare('new');
  const room = new WorkshopSessionService(() => Date.now());
  host.seed.install(plan, room);
  expect(reads).not.toContain(otherFile);
  expect(room.getContextAttachments().some(a => a.sourceUri?.startsWith(`file://${nested}/`))).toBe(false);
});
