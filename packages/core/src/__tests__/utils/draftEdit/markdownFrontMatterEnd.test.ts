/** Where front matter ends, by the rule that protects it (ADR 2026-11-05 D2: a rewrite keeps it). *Alice*. */
import { markdownFrontMatterEnd } from '@/utils/draftEdit/markdownBlockRegions';

describe('markdownFrontMatterEnd', () => {
  it('ends just past the closing line, in LF and CRLF', () => {
    expect(markdownFrontMatterEnd('---\ntitle: Alice\n---\nAlice sat.')).toBe('---\ntitle: Alice\n---\n'.length);
    expect(markdownFrontMatterEnd('---\r\ntitle: Alice\r\n...\r\n\r\nAlice sat.')).toBe('---\r\ntitle: Alice\r\n...\r\n'.length);
    expect(markdownFrontMatterEnd('---\ntitle: Alice\n---')).toBe('---\ntitle: Alice\n---'.length);
  });

  it('is 0 without front matter, or when it never closes', () => {
    expect(markdownFrontMatterEnd('Alice sat.')).toBe(0);
    expect(markdownFrontMatterEnd('---\ntitle: Alice\nAlice sat.')).toBe(0);
  });
});
