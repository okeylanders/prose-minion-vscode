/**
 * The room's excerpt as the file-edit gateway reads it (ADR 2026-11-05
 * D4.2): from session state when asked, its source authorized as "Re-read
 * from file" authorizes it. *Alice*.
 */
import type { WorkshopExcerpt } from '@messages';
import { workshopExcerptFileEditSource } from '@/application/services/workshop/WorkshopExcerptFileEditSource';

const FILE: WorkshopExcerpt = {
  text: 'Alice sat by her sister.',
  version: 4,
  pinnedAt: 0,
  source: { kind: 'file', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md' }
};

describe('workshopExcerptFileEditSource', () => {
  it('reads none, a pasted excerpt, an authorized file and a refused one', async () => {
    const authorize = jest.fn(async () => ({ kind: 'authorized' as const, fsPath: '/workspace/chapters/one.md', source: FILE.source as never }));
    let excerpt: WorkshopExcerpt | undefined;
    const port = workshopExcerptFileEditSource({ getExcerpt: () => excerpt }, { authorizeExcerptReread: authorize });

    await expect(port.current()).resolves.toEqual({ kind: 'none' });
    excerpt = { ...FILE, source: { kind: 'manual' } };
    await expect(port.current()).resolves.toEqual({ kind: 'manual', version: 4 });
    excerpt = FILE;
    await expect(port.current()).resolves.toEqual({ kind: 'file', version: 4, text: FILE.text, fsPath: '/workspace/chapters/one.md' });
    excerpt = { ...FILE, source: { kind: 'editor-selection', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md', startLine: 1, endLine: 1 } };
    await port.current();
    expect(authorize).toHaveBeenLastCalledWith({ kind: 'file', sourceUri: 'file:///workspace/chapters/one.md', relativePath: 'chapters/one.md' });
    authorize.mockResolvedValueOnce({ kind: 'refused', message: 'outside' } as never);
    await expect(port.current()).resolves.toEqual({ kind: 'unauthorized', version: 4 });
  });
});
