/**
 * The room's excerpt document for file edits (ADR 2026-11-05 D4.4, D5):
 * from session state when asked, authorized as "Re-read from file"
 * authorizes it. *Alice*.
 */
import type { WorkshopExcerpt } from '@messages';
import { workshopExcerptFileEditDocument } from '@/application/services/workshop/WorkshopExcerptFileEditDocument';

const FILE: WorkshopExcerpt = {
  text: 'Alice sat by her sister.',
  version: 4,
  pinnedAt: 0,
  source: { kind: 'file', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md' }
};

describe('workshopExcerptFileEditDocument', () => {
  it('reads none, a pasted excerpt, an authorized file, an editor selection and a refused one', async () => {
    const authorize = jest.fn(async () => ({ kind: 'authorized' as const, fsPath: '/workspace/chapters/one.md', source: FILE.source as never }));
    let excerpt: WorkshopExcerpt | undefined;
    const port = workshopExcerptFileEditDocument({ getExcerpt: () => excerpt }, { authorizeExcerptReread: authorize });

    await expect(port.currentDocument()).resolves.toBeUndefined();
    excerpt = { ...FILE, source: { kind: 'manual' } };
    await expect(port.currentDocument()).resolves.toBeUndefined();
    excerpt = FILE;
    await expect(port.currentDocument()).resolves.toEqual({ fsPath: '/workspace/chapters/one.md', relativePath: 'chapters/one.md' });
    excerpt = { ...FILE, source: { kind: 'editor-selection', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md', startLine: 1, endLine: 1 } };
    await port.currentDocument();
    expect(authorize).toHaveBeenLastCalledWith({ kind: 'file', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md' });
    authorize.mockResolvedValueOnce({ kind: 'refused', message: 'outside' } as never);
    await expect(port.currentDocument()).resolves.toBeUndefined();
  });
});
