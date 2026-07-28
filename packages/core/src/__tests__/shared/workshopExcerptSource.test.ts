/**
 * Excerpt-source wire contract (Sprint 12): the ONE parser for provenance
 * claims crossing the webview IPC boundary. A claim that cannot prove its
 * shape degrades to `{ kind: 'manual' }` — it never borrows a source.
 */

import {
  coerceWorkshopExcerptSource,
  workshopExcerptSourcePath,
  workshopExcerptSourceUri
} from '@messages';

describe('coerceWorkshopExcerptSource', () => {
  it('degrades non-objects and unknown kinds to manual', () => {
    expect(coerceWorkshopExcerptSource(undefined)).toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource(null)).toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource('editor-selection')).toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource({ kind: 'clipboard' })).toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource({ kind: 'manual' })).toEqual({ kind: 'manual' });
  });

  it('degrades sourced kinds that cannot prove uri and path to manual', () => {
    expect(coerceWorkshopExcerptSource({ kind: 'file', sourceUri: 'file:///a.md' }))
      .toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource({ kind: 'editor-selection', relativePath: 'a.md' }))
      .toEqual({ kind: 'manual' });
    expect(coerceWorkshopExcerptSource({ kind: 'file', sourceUri: '  ', relativePath: 'a.md' }))
      .toEqual({ kind: 'manual' });
  });

  it('accepts a file claim and drops an unprovable configuredResource', () => {
    expect(coerceWorkshopExcerptSource({
      kind: 'file',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'not-a-group', path: 'chapters/05.md' }
    })).toEqual({
      kind: 'file',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md'
    });
  });

  it('keeps a provable configuredResource key', () => {
    expect(coerceWorkshopExcerptSource({
      kind: 'file',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'chapters', path: 'chapters/05.md' }
    })).toEqual({
      kind: 'file',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      configuredResource: { group: 'chapters', path: 'chapters/05.md' }
    });
  });

  it('keeps a sane 1-based line range and drops an invalid one without losing the kind', () => {
    expect(coerceWorkshopExcerptSource({
      kind: 'editor-selection',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      startLine: 143,
      endLine: 151
    })).toEqual({
      kind: 'editor-selection',
      sourceUri: 'file:///chapters/05.md',
      relativePath: 'chapters/05.md',
      startLine: 143,
      endLine: 151
    });

    for (const range of [
      { startLine: 0, endLine: 5 },        // zero-based leak
      { startLine: 5, endLine: 3 },        // inverted
      { startLine: 1.5, endLine: 3 },      // non-integer
      { startLine: 3 },                    // half a range
      { startLine: '3', endLine: '5' }     // stringly typed
    ]) {
      expect(coerceWorkshopExcerptSource({
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md',
        ...range
      })).toEqual({
        kind: 'editor-selection',
        sourceUri: 'file:///chapters/05.md',
        relativePath: 'chapters/05.md'
      });
    }
  });

  it('never lets a file claim smuggle a line range', () => {
    expect(coerceWorkshopExcerptSource({
      kind: 'file',
      sourceUri: 'file:///a.md',
      relativePath: 'a.md',
      startLine: 1,
      endLine: 5
    })).toEqual({ kind: 'file', sourceUri: 'file:///a.md', relativePath: 'a.md' });
  });
});

describe('excerpt source accessors', () => {
  it('expose path and uri only for sourced kinds', () => {
    expect(workshopExcerptSourcePath({ kind: 'manual' })).toBeUndefined();
    expect(workshopExcerptSourceUri({ kind: 'manual' })).toBeUndefined();
    const file = { kind: 'file' as const, sourceUri: 'file:///a.md', relativePath: 'a.md' };
    expect(workshopExcerptSourcePath(file)).toBe('a.md');
    expect(workshopExcerptSourceUri(file)).toBe('file:///a.md');
  });
});
