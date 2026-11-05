/**
 * The one rule for which attachments are pinned (ADR 2026-11-04 D4; Slice
 * 2b). Made-up paths.
 */
import { workshopPinnedContextMatches } from '@shared/constants/workshopPinnedContext';

const entry = (entryPath: string) => ({ path: entryPath });

describe('workshopPinnedContextMatches', () => {
  it('matches by the catalog key\'s path', () => {
    expect(workshopPinnedContextMatches(
      entry('Characters/alice.md'),
      { kind: 'file', relativePath: 'elsewhere/alice.md', configuredResource: { group: 'characters', path: 'Characters/alice.md' } },
      'posix'
    )).toBe(true);
  });

  it('failing that, by the relative path', () => {
    expect(workshopPinnedContextMatches(entry('Project/brief.md'), { kind: 'file', relativePath: 'Project/brief.md' }, 'posix')).toBe(true);
    expect(workshopPinnedContextMatches(
      entry('Project/brief.md'),
      { kind: 'file', relativePath: 'Project/brief.md', configuredResource: { group: 'projectBrief', path: 'Other/brief.md' } },
      'posix'
    )).toBe(true);
  });

  it('two different paths never match, and a text note never does', () => {
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), { kind: 'file', relativePath: 'Characters/the-hatter.md' }, 'posix')).toBe(false);
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), { kind: 'file', relativePath: 'Characters/alice.md.bak' }, 'posix')).toBe(false);
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), { kind: 'file' }, 'posix')).toBe(false);
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), { kind: 'text', relativePath: 'Characters/alice.md' }, 'posix')).toBe(false);
  });

  it('folds case on Windows only, as Slice 1\'s key does', () => {
    const attachment = { kind: 'file' as const, relativePath: 'characters/ALICE.md' };
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), attachment, 'windows')).toBe(true);
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), attachment, 'posix')).toBe(false);
  });

  it('reads a Windows separator in the attachment\'s path, and NFD as NFC', () => {
    expect(workshopPinnedContextMatches(entry('Characters/alice.md'), { kind: 'file', relativePath: 'Characters\\alice.md' }, 'windows')).toBe(true);
    expect(workshopPinnedContextMatches(entry('Places/café.md'), { kind: 'file', relativePath: 'Places/café.md' }, 'posix')).toBe(true);
  });
});
