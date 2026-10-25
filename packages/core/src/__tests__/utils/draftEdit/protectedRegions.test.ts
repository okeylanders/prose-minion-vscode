/**
 * Protected regions (ADR 2026-10-21 D4): no pass may quote or change front
 * matter, code, link targets, URLs, reference definitions, HTML comments, or
 * tags. Indented paragraphs stay prose. Fixtures are public domain.
 */
import {
  PROTECTED_PLACEHOLDER,
  findProtectedRegions,
  maskProtectedRegions,
  mergeRanges
} from '@/utils/draftEdit/protectedRegions';
import { ALICE_MARKDOWN_CHAPTER } from '@/__tests__/utils/draftEdit/proofreadFixtures';

const regionsText = (text: string, languageId = 'markdown') =>
  findProtectedRegions(text, languageId).map((region) => text.slice(region.start, region.end));

describe('findProtectedRegions', () => {
  it('finds nothing in plain text, whatever it contains', () => {
    expect(findProtectedRegions('---\ntitle: x\n---\n`code` <b>tag</b>', 'plaintext')).toEqual([]);
  });

  it('protects front matter only at the very start, and only when closed', () => {
    expect(regionsText('---\ntitle: Alice\n---\nShe fell.')).toEqual(['---\ntitle: Alice\n---']);
    expect(regionsText('---\ntitle: Alice\n...\nShe fell.')).toEqual(['---\ntitle: Alice\n...']);
    expect(regionsText('She fell.\n---\nnot front matter\n---')).toEqual([]);
    expect(regionsText('---\nnever closed, so prose')).toEqual([]);
  });

  it('protects fenced code, closed or running to the end, with backticks or tildes', () => {
    expect(regionsText('Before.\n```js\nteh code\n```\nAfter.')).toEqual(['```js\nteh code\n```']);
    expect(regionsText('Before.\n~~~\nteh code\n~~~\nAfter.')).toEqual(['~~~\nteh code\n~~~']);
    expect(regionsText('Before.\n```\nteh code never closes')).toEqual(['```\nteh code never closes']);
  });

  it('protects inline code, but never across a blank line', () => {
    expect(regionsText('Call `teh()` now, or ``a `b` c``.')).toEqual(['`teh()`', '``a `b` c``']);
    expect(regionsText('One ` tick.\n\nAnother ` tick.')).toEqual([]);
  });

  it('protects a link or image destination, keeping its visible text as prose', () => {
    const text = 'Read [teh book](https://example.org/a "Title") and ![a pictur](img/alice.png).';
    expect(regionsText(text)).toEqual(['(https://example.org/a "Title")', '(img/alice.png)']);
  });

  it('protects autolinks, bare URLs, reference definitions, HTML comments, and tags', () => {
    expect(regionsText('See <https://example.org/teh> now.')).toEqual(['<https://example.org/teh>']);
    expect(regionsText('See https://example.org/teh now.')).toEqual(['https://example.org/teh']);
    expect(regionsText('Text.\n[alice]: https://example.org/teh "Teh"\nMore.')).toEqual(['[alice]: https://example.org/teh "Teh"']);
    expect(regionsText('A <!-- teh\nnote --> b.')).toEqual(['<!-- teh\nnote -->']);
    expect(regionsText('She <em class="x">fell</em>.')).toEqual(['<em class="x">', '</em>']);
  });

  it('leaves indented paragraphs as prose (writers indent; protecting them would skip prose)', () => {
    expect(regionsText('\tAlice was beginning to get very tired.\n\n    So she was considering.')).toEqual([]);
  });

  it('never extends an inline match out of a fenced block', () => {
    expect(regionsText('```\na `tick\n```\nprose` after')).toEqual(['```\na `tick\n```']);
  });

  it('handles CRLF line endings', () => {
    expect(regionsText('---\r\ntitle: Alice\r\n---\r\nShe fell.\r\n```\r\ncode\r\n```\r\n'))
      .toEqual(['---\r\ntitle: Alice\r\n---', '```\r\ncode\r\n```']);
  });

  it('finds every protected part of a Markdown chapter and none of its prose', () => {
    const protectedText = regionsText(ALICE_MARKDOWN_CHAPTER);
    expect(protectedText).toEqual([
      '---\ntitle: Down the Rabbit-Hole\n---',
      '```text\nteh rabbit-hole went straight on like a tunnel\n```',
      '(https://www.gutenberg.org/ebooks/11)',
      '<!-- note: teh draft continues -->'
    ]);
  });
});

describe('mergeRanges', () => {
  it('sorts, and merges ranges that overlap or touch', () => {
    expect(mergeRanges([{ start: 5, end: 8 }, { start: 0, end: 2 }, { start: 2, end: 3 }, { start: 7, end: 10 }]))
      .toEqual([{ start: 0, end: 3 }, { start: 5, end: 10 }]);
  });
});

describe('maskProtectedRegions', () => {
  const text = 'Alpha `code` beta [link](https://x.org) gamma.';
  const masked = maskProtectedRegions(text, findProtectedRegions(text, 'markdown'));

  it('replaces each region with one placeholder', () => {
    expect(masked.text).toBe(`Alpha ${PROTECTED_PLACEHOLDER} beta [link]${PROTECTED_PLACEHOLDER} gamma.`);
    expect(masked.placeholders.map((p) => masked.text.slice(p.start, p.end)))
      .toEqual([PROTECTED_PLACEHOLDER, PROTECTED_PLACEHOLDER]);
  });

  it('maps offsets outside placeholders back to the source, and refuses offsets inside one', () => {
    const at = (word: string) => masked.text.indexOf(word);
    for (const word of ['Alpha', 'beta', '[link]', 'gamma']) {
      expect(masked.toSource(at(word))).toBe(text.indexOf(word));
      expect(masked.toSource(at(word) + word.length)).toBe(text.indexOf(word) + word.length);
    }
    expect(masked.toSource(masked.placeholders[0].start + 1)).toBeUndefined();
    expect(masked.toSource(masked.text.length)).toBe(text.length);
  });

  it('reports whether a masked range touches a placeholder', () => {
    const first = masked.placeholders[0];
    expect(masked.touchesPlaceholder({ start: first.start - 2, end: first.start })).toBe(false);
    expect(masked.touchesPlaceholder({ start: first.start - 2, end: first.start + 1 })).toBe(true);
    expect(masked.touchesPlaceholder({ start: first.end, end: first.end + 3 })).toBe(false);
  });

  it('is the identity with no regions', () => {
    const plain = maskProtectedRegions('Alice fell.', []);
    expect(plain.text).toBe('Alice fell.');
    expect(plain.toSource(6)).toBe(6);
  });
});
