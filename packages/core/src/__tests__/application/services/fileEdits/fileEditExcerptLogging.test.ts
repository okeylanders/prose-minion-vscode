/**
 * PR #229 N-01, the excerpt route (ADR 2026-11-05 D13): staging and Apply
 * reach the real excerpt adapter, which authorizes through the intake
 * service and the resolver's catalog. Composed as `extension.ts` composes it
 * (the intake service over `resolver.countsOnly()`), no pattern, path or host
 * message reaches the log on either path, while the writer's own catalog
 * keeps its diagnostics. Paths and markers are synthetic. *Alice*.
 */
import { DraftEditApplier } from '@/application/services/draftEdit/DraftEditApplier';
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import { fileEditBaseline } from '@/application/services/fileEdits/fileEditIdentity';
import { ProjectFileEditGateway } from '@/application/services/fileEdits/ProjectFileEditGateway';
import { WorkshopContextIntakeService } from '@/application/services/workshop/WorkshopContextIntakeService';
import { workshopExcerptFileEditDocument } from '@/application/services/workshop/WorkshopExcerptFileEditDocument';
import { ContextResourceResolver } from '@/infrastructure/context/ContextResourceResolver';
import { FileType } from '@/platform';
import { createFakeFileSystem, createFakeSettings, createFakeWorkspace } from '../../../mocks/platform';
import { FakeDocuments } from '../draftEdit/fakeDocuments';

const URI = 'file:///workspace/chapter.md';
const SOURCE = { kind: 'file' as const, sourceUri: URI, relativePath: 'chapter.md' };

function setup(failing: boolean) {
  const lines: string[] = [];
  const log = { appendLine: (line: string) => lines.push(line), show: () => undefined, clear: () => undefined };
  const workspace = createFakeWorkspace({
    workspaceFolders: () => [{ path: '/workspace', name: 'workspace' }],
    findFiles: async () => {
      if (failing) {
        throw new Error('FAILED /private/AliceSentinel.md');
      }
      return ['/workspace/chapter.md', '/workspace/LinkedSentinel.md'];
    }
  });
  const fileSystem = createFakeFileSystem({
    stat: async (filePath: string) => ({ type: filePath.includes('LinkedSentinel') ? FileType.SymbolicLink : FileType.File, size: 10, ctime: 0, mtime: 0 })
  });
  const resolver = new ContextResourceResolver(createFakeSettings(Object.fromEntries([['contextPaths.general', 'PrivateSentinel/*.md']])), fileSystem, workspace, log);
  const excerpt = workshopExcerptFileEditDocument(
    { getExcerpt: () => ({ text: 'Alice.', version: 1, pinnedAt: 0, source: SOURCE }) },
    new WorkshopContextIntakeService(resolver.countsOnly(), fileSystem, workspace)
  );
  const documents = new FakeDocuments('Alice.', URI);
  const shared = { candidates: resolver, excerpt, documents, fileSystem, workspace, log };
  return {
    lines,
    resolver,
    documents,
    staging: new FileEditStagingService(shared),
    gateway: new ProjectFileEditGateway({ ...shared, applier: new DraftEditApplier(documents), epoch: { current: () => 0 } })
  };
}

const leaks = (lines: readonly string[]) => lines.filter((line) => /Sentinel|\/private|\/workspace|file:/.test(line));

describe('the excerpt route logs no pattern, path or host message (PR #229 N-01)', () => {
  it('staging through a failing search, with a file excerpt present', async () => {
    const { lines, staging } = setup(true);
    await expect(staging.stage({ kind: 'resource', group: 'general', path: 'chapter.md' })).resolves.toMatchObject({ reason: 'catalog-unreadable' });
    await staging.stage({ kind: 'excerpt' });
    expect(lines.length).toBeGreaterThan(0);
    expect(leaks(lines)).toEqual([]);
  });

  it('an otherwise successful Apply over a catalog holding a linked match', async () => {
    const { lines, gateway, documents } = setup(false);
    const outcome = await gateway.apply({
      target: { kind: 'file', documentUri: URI, relativePath: 'chapter.md' },
      class: 'prose',
      baseline: fileEditBaseline('Alice.', '/workspace/chapter.md'),
      operations: [{ op: 'append', text: 'The Rabbit ran.' }],
      source: { kind: 'proposal', turnId: 'turn-1', index: 0 }
    }, { review: 'direct', stillCurrent: () => true });
    expect(outcome.state).toBe('applied');
    expect(documents.text).toBe('Alice.\n\nThe Rabbit ran.');
    expect(leaks(lines)).toEqual([]);
  });

  it('control: the writer\'s own catalog keeps its detailed diagnostics', async () => {
    const { lines, resolver } = setup(true);
    await resolver.createProvider(['general']);
    expect(lines.join('\n')).toContain('PrivateSentinel/*.md');
  });
});
