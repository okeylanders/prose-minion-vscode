/**
 * Staging against a run's bound excerpt document (ADR 2026-11-10 D2; PR
 * #252 F-03), through the real `FileEditStagingService`: an excerpt offer
 * keeps the document it was bound to, so the answer's `<excerpt/>` stages
 * against that document whatever the room's excerpt is now, including a
 * file outside the resource catalog. The bound document is held to every
 * rule the current excerpt is. *Alice*.
 */
import { FileEditStagingService } from '@/application/services/fileEdits/FileEditStagingService';
import type { FileEditIdentity } from '@/domain/models/FileEditStaging';
import { candidate, expectNoLeaks, hostFakes, ports, ROOT, uriOf, type HostFakes } from './fileEditFixtures';

const A = `${ROOT}/drafts/pool-of-tears.md`;
const B = `${ROOT}/chapters/one.md`;
const bound = (fsPath: string, relativePath: string): FileEditIdentity => ({ kind: 'excerpt', documentUri: uriOf(fsPath), relativePath });

function staging(fakes: HostFakes) {
  const { candidates, excerpt, workspace, fileSystem, log } = ports(fakes);
  return new FileEditStagingService({ candidates, excerpt, workspace, fileSystem, documents: { peek: () => undefined }, log });
}

describe('FileEditStagingService: a run bound to an excerpt document', () => {
  // The room's excerpt is B now; A was pinned when the offer's reply was read, and is in no catalog group.
  const room = () => hostFakes({
    candidates: [candidate('chapters', 'chapters/one.md')],
    files: { [A]: 'Alice was begining to cry.\n', [B]: 'Alice sat on the bank.\n' },
    excerpt: { fsPath: B, relativePath: 'chapters/one.md' }
  });

  it('stages <excerpt/> against the bound document, not the room\'s excerpt now, catalog or not', async () => {
    const fakes = room();
    const unbound = await staging(fakes).stage({ kind: 'excerpt' });
    expect(unbound).toMatchObject({ kind: 'staged', target: { kind: 'excerpt', documentUri: uriOf(B), relativePath: 'chapters/one.md' } });

    const staged = await staging(fakes).stage({ kind: 'excerpt' }, { boundExcerpt: bound(A, 'drafts/pool-of-tears.md') });
    expect(staged).toMatchObject({
      kind: 'staged',
      target: { kind: 'excerpt', documentUri: uriOf(A), relativePath: 'drafts/pool-of-tears.md' },
      class: 'prose'
    });
    // The baseline is A's own text, read now.
    expect(staged.kind === 'staged' && staged.baseline.length).toBe('Alice was begining to cry.'.length);
    expectNoLeaks(fakes.log);
  });

  it('leaves a resource target alone: it is found in the catalog, and its class reads the room\'s excerpt', async () => {
    const staged = await staging(room()).stage({ kind: 'resource', group: 'chapters', path: 'chapters/one.md' }, { boundExcerpt: bound(A, 'drafts/pool-of-tears.md') });
    expect(staged).toMatchObject({ kind: 'staged', target: { kind: 'file', documentUri: uriOf(B) }, class: 'prose' });
  });

  it.each([
    ['outside the workspace', bound('/elsewhere/pool-of-tears.md', 'pool-of-tears.md'), {}, 'outside-workspace'],
    ['behind a symbolic link', bound(A, 'drafts/pool-of-tears.md'), { linked: new Set([A]) }, 'outside-workspace'],
    ['not a text file', bound(`${ROOT}/drafts/pool.pdf`, 'drafts/pool.pdf'), {}, 'not-text'],
    ['no longer readable', bound(`${ROOT}/drafts/gone.md`, 'drafts/gone.md'), {}, 'unreadable'],
    ['not a file URI', { kind: 'excerpt', documentUri: 'untitled:Untitled-1', relativePath: 'Untitled-1' } as FileEditIdentity, {}, 'excerpt-not-a-file']
  ])('holds the bound document to the excerpt\'s rules: %s', async (_name, identity, overrides, reason) => {
    const fakes = { ...room(), ...overrides };
    await expect(staging(fakes).stage({ kind: 'excerpt' }, { boundExcerpt: identity })).resolves.toEqual({ kind: 'refused', reason });
  });

  it('never falls back to the room\'s excerpt when the bound document is refused', async () => {
    const fakes = room();
    const result = await staging(fakes).stage({ kind: 'excerpt' }, { boundExcerpt: bound(`${ROOT}/drafts/gone.md`, 'drafts/gone.md') });
    expect(result.kind).toBe('refused');
  });
});
