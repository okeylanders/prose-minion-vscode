/**
 * pathContainment Tests — the traversal guard behind UIHandler's open-file joins.
 */

import { isPathWithinRoot } from '@/infrastructure/storage/pathContainment';

describe('isPathWithinRoot', () => {
  const root = '/ws/project';

  it('accepts the root itself and descendants', () => {
    expect(isPathWithinRoot(root, '/ws/project')).toBe(true);
    expect(isPathWithinRoot(root, '/ws/project/notes.md')).toBe(true);
    expect(isPathWithinRoot(root, '/ws/project/sub/dir/file.txt')).toBe(true);
  });

  it('rejects parent-traversal escapes', () => {
    expect(isPathWithinRoot(root, '/ws/project/../secret.md')).toBe(false);
    expect(isPathWithinRoot(root, '/ws/project/../../etc/passwd')).toBe(false);
    expect(isPathWithinRoot(root, '/ws/project/a/../../b')).toBe(false);
  });

  it('rejects unrelated absolute paths and sibling-prefix tricks', () => {
    expect(isPathWithinRoot(root, '/etc/passwd')).toBe(false);
    expect(isPathWithinRoot(root, '/ws/project-evil/x')).toBe(false);
  });
});
