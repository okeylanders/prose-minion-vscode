/**
 * Protected regions (ADR 2026-10-21 D4): no pass may quote or change front
 * matter, code, link targets, URLs, reference definitions, HTML comments, or
 * tags. Indented paragraphs stay prose. Fixtures are public domain.
 */
import {
  PROTECTED_PLACEHOLDER,
  findProtectedRegions,
  maskProtectedRegions,
  mergeRanges,
  readDocumentRegions
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

describe('findProtectedRegions: complete constructs (PR #171 F-02)', () => {
  const masked = (text: string) => maskProtectedRegions(text, findProtectedRegions(text, 'markdown')).text;
  const P = PROTECTED_PLACEHOLDER;

  it('protects a fence inside a block quote or a list item, to its container\'s end', () => {
    expect(masked('> ~~~txt\n> teh\n> ~~~')).toBe(P);
    expect(masked('- ~~~txt\n  teh\n  ~~~')).toBe(P);
    expect(masked('1. Alice\n\n   ```js\n   teh\n   ```\n2. Rabbit')).toBe(`1. Alice\n\n${P}\n2. Rabbit`);
    expect(masked('* > ~~~\n  > teh\n  > ~~~\n\nAlice.')).toBe(`${P}\n\nAlice.`);
    // An unclosed fence in a quote ends with the quote, not the document.
    expect(masked('> ~~~\n> teh\n\nAlice fell.')).toBe(`${P}\n\nAlice fell.`);
  });

  it('protects a fence in a list item indented with a tab', () => {
    expect(masked('-\tAlice\n\t~~~\n\tteh\n\t~~~')).toBe(`-\tAlice\n${P}`);
  });

  it('protects a destination with balanced or escaped parentheses, or on the next line', () => {
    expect(masked('[chapter](chap(one)/teh.md)')).toBe(`[chapter]${P}`);
    expect(masked('[chapter](chap\\)teh.md)')).toBe(`[chapter]${P}`);
    expect(masked('[chapter](\n  secret/teh.md\n)')).toBe(`[chapter]${P}`);
    expect(masked('[chapter](<secret/teh one.md>)')).toBe(`[chapter]${P}`);
    expect(masked('> [a](\n> secret/teh.md "T\n> itle") b')).toBe(`> [a]${P} b`);
    // A blank line ends it: not a link, so prose.
    expect(masked('[chapter](\n\nteh.md)')).toBe('[chapter](\n\nteh.md)');
  });

  it('keeps a link\'s visible text as prose', () => {
    expect(masked('[teh](chapter.md)')).toBe(`[teh]${P}`);
  });

  it('protects a reference definition on several lines, and inside a block quote', () => {
    expect(masked('[chapter]:\n  secret/teh.md\n\nA chapter.')).toBe(`${P}\n\nA chapter.`);
    expect(masked('[chapter]: secret/teh.md\n  "The teh title"\n\nA chapter.')).toBe(`${P}\n\nA chapter.`);
    expect(masked('> [x]: secret/teh.md\n> "Title"\n\nAfter.')).toBe(`${P}\n\nAfter.`);
  });

  it('protects email autolinks, any scheme\'s autolink, and bare emails and www. links', () => {
    expect(masked('Contact <teh@example.invalid>.')).toBe(`Contact ${P}.`);
    expect(masked('Open <irc://example.invalid/teh>.')).toBe(`Open ${P}.`);
    expect(masked('Mail teh@example.invalid or www.example.invalid/teh now.')).toBe(`Mail ${P} or ${P} now.`);
  });

  it('reads backtick runs whole: a run nothing closes is literal, and never steals a later span\'s opener', () => {
    expect(masked('A `` b `teh` c')).toBe(`A \`\` b ${P} c`);
    expect(masked('An escaped \\` tick, then `teh`.')).toBe(`An escaped \\\` tick, then ${P}.`);
    // Two list items: no span runs from one into the other.
    expect(masked('- a `b\n- teh` c')).toBe('- a `b\n- teh` c');
    // A line that only looks like a list item continues the paragraph, and the span.
    expect(masked('Prose `a\n1999. teh` more')).toBe(`Prose ${P} more`);
  });

  it('reads a tag\'s quoted attributes whole, even holding `>`, and a backtick inside one opens nothing', () => {
    expect(masked('See <a title="x>y" href="teh.html">link</a> now.')).toBe(`See ${P}link${P} now.`);
    expect(masked('<a title="`">x</a> then `teh`')).toBe(`${P}x${P} then ${P}`);
    expect(masked('<!-- ` --> then `teh`')).toBe(`${P} then ${P}`);
  });

  it('protects a raw script or style block, but not a writer\'s HTML block of prose', () => {
    expect(masked('<script>\nvar teh;\n</script>\n\nAlice.')).toBe(`${P}\n\nAlice.`);
    expect(masked('<div class="note">\nAlice fell.\n</div>')).toBe(`${P}\nAlice fell.\n${P}`);
  });

  it('protects a document nested deeper than any manuscript whole, rather than read it', () => {
    const deepQuote = `${'> '.repeat(33)}teh`;
    expect(masked(deepQuote)).toBe(P);
    const deepList = Array.from({ length: 40 }, (_, level) => `${' '.repeat(level * 2)}- teh`).join('\n');
    expect(masked(deepList)).toBe(P);
    // Ordinary nesting is read.
    expect(masked(`${'> '.repeat(3)}Alice fell.`)).toBe(`${'> '.repeat(3)}Alice fell.`);
  });

  it('still reads indented paragraphs as prose, protecting the inline constructs inside them', () => {
    expect(masked('\tIndented teh with `code` and <https://example.invalid/teh>.')).toBe(`\tIndented teh with ${P} and ${P}.`);
  });
});

describe('findProtectedRegions: inline constructs stay inside their block (PR #171 F-02 re-review)', () => {
  const masked = (text: string) => maskProtectedRegions(text, findProtectedRegions(text, 'markdown')).text;
  const P = PROTECTED_PLACEHOLDER;

  it.each<[string, string, string]>([
    ['the next numbered item', '1. One `unclosed\n2. `teh` end', `1. One \`unclosed\n2. ${P} end`],
    ['a block quote that interrupts the paragraph', 'Before ` unclosed\n> `teh` after', `Before \` unclosed\n> ${P} after`],
    ['a nested quote\'s next paragraph', '> > a ` x\n> > b\n>\n> `teh` c', `> > a \` x\n> > b\n>\n> ${P} c`],
    ['a thematic break', 'Para ` x\n***\n`teh` y', `Para \` x\n***\n${P} y`],
    ['a setext heading', 'Title ` x\n===\n`teh` y', `Title \` x\n===\n${P} y`],
    ['a paragraph after a lone carriage return', 'Para ` x\r\rNext `teh` y', `Para \` x\r\rNext ${P} y`]
  ])('never lets an unmatched backtick take a code opener across %s', (_name, text, expected) => {
    expect(masked(text)).toBe(expected);
  });

  it('reads each table cell alone, across cells and rows', () => {
    expect(masked('| a ` x | `teh` |\n|---|---|\n| ` y | z |\n| `teh` | ok |'))
      .toBe(`| a \` x | ${P} |\n|---|---|\n| \` y | z |\n| ${P} | ok |`);
  });

  it('never reads a block quote\'s marker as the end of a tag', () => {
    expect(masked('> <a\n> href="teh.html">label</a>')).toBe(`> ${P}label${P}`);
  });

  it.each<[string, string, string]>([
    ['no trailing pipe', 'Column | Other\n--- | ---\nplain | `teh` \\', `Column | Other\n--- | ---\nplain | ${P} \\`],
    ['a final newline', 'Column | Other\n--- | ---\nplain | `teh` \\\n', `Column | Other\n--- | ---\nplain | ${P} \\\n`],
    ['a trailing pipe', 'Column | Other\n--- | ---\nplain | `teh` \\|', `Column | Other\n--- | ---\nplain | ${P} \\|`],
    ['two trailing backslashes', 'Column | Other\n--- | ---\nplain | `teh` \\\\', `Column | Other\n--- | ---\nplain | ${P} \\\\`],
    ['a link target', 'Column | Other\n--- | ---\nplain | [x](teh.md) \\', `Column | Other\n--- | ---\nplain | [x]${P} \\`],
    ['a tag attribute', 'Column | Other\n--- | ---\nplain | <a href="teh.html">x</a> \\', `Column | Other\n--- | ---\nplain | ${P}x${P} \\`]
  ])('reads a row\'s last cell however the row ends: %s (second re-review)', (_name, text, expected) => {
    expect(masked(text)).toBe(expected);
  });

  it.each<[number, string]>([
    [31, 'link'],
    [32, 'link'],
    [33, 'past the bound']
  ])('protects a destination nested %i deep (%s), never reading it as prose (second re-review)', (depth) => {
    const text = `[chapter](${'('.repeat(depth)}teh${')'.repeat(depth)}) after`;
    const result = masked(text);
    expect(result).not.toContain('teh');
    expect(result.startsWith(`[chapter]${P}`)).toBe(true);
  });

  it('protects an empty destination before a title', () => {
    expect(masked('[label]( "hidden title")')).toBe(`[label]${P}`);
  });

  it('controls: a label stays prose, a code span may run over a line, and prose in containers is read whole', () => {
    expect(masked('[teh](chapter.md)')).toBe(`[teh]${P}`);
    expect(masked('A `multi\nline` code span')).toBe(`A ${P} code span`);
    expect(masked('Prose `a\n1999. teh` more')).toBe(`Prose ${P} more`);
    for (const prose of [
      '> Alice was beginning to get very tired.\n> She had peeped into the book.',
      '- Alice fell.\n  - Down, down, down.\n    Would the fall never come to an end?',
      '-\tAlice fell.\n\tStill falling.',
      '> - A nested item.\n>   Continued, lazily.',
      '1. Alice\n2. The Rabbit'
    ]) {
      expect(masked(prose)).toBe(prose);
    }
  });

  it('protects a document nesting quotes and list items, mixed, deeper than any manuscript', () => {
    expect(masked(`${'> - '.repeat(65)}Prose sentinel`)).toBe(P);
    expect(masked(`${'> - '.repeat(8)}Prose sentinel`)).toBe(`${'> - '.repeat(8)}Prose sentinel`);
    // Lists nested line by line inside a block quote count their indentation too (second re-review).
    const quotedLists = (levels: number) => Array.from({ length: levels }, (_, level) => `> ${'  '.repeat(level)}- prose`).join('\n');
    expect(masked(quotedLists(40))).toBe(P);
    expect(masked(quotedLists(8))).toBe(quotedLists(8));
  });

  it('reads unmatched destinations in bounded work, protecting what nests past the bound', () => {
    const adversarial = '](x'.repeat(20000);
    const started = Date.now();
    // The 33rd nested `(` is past the bound: from the first `(` on, nothing is read as prose.
    expect(masked(adversarial)).toBe(`]${P}`);
    // Generous: linear work takes a few milliseconds; a rescan per opener takes seconds.
    expect(Date.now() - started).toBeLessThan(1500);
  });

  it('reads a long list in work that grows with it, not with its square', () => {
    const list = '- item `x` text\n'.repeat(20000);
    const started = Date.now();
    expect(findProtectedRegions(list, 'markdown')).toHaveLength(20000);
    // Generous: about 0.2 s here; recounting every earlier item per item took over 2 s.
    expect(Date.now() - started).toBeLessThan(1500);
  });
});

describe('readDocumentRegions: headings, wherever Markdown puts them (Slice 3b; PR #176 F-02)', () => {
  const headingsText = (text: string, languageId = 'markdown') =>
    readDocumentRegions(text, languageId).headings.map((range) => text.slice(range.start, range.end));
  const prose = 'Alice was beginning to get very tired.';

  it.each([
    ['ATX', '# The Pool of Tears', ['# The Pool of Tears']],
    ['ATX, closed and indented', '   ## The Pool of Tears ##', ['   ## The Pool of Tears ##']],
    ['setext, =', 'The Pool of Tears\n=================', ['The Pool of Tears\n=================']],
    ['setext, -', 'The Pool of Tears\n---', ['The Pool of Tears\n---']],
    ['in a block quote', '> # The Pool of Tears', ['> # The Pool of Tears']],
    ['in a list item', '- # The Pool of Tears', ['- # The Pool of Tears']],
    ['setext in a block quote', '> The Pool of Tears\n> =================', ['> The Pool of Tears\n> =================']],
    ['in a list in a block quote', '> - ## The Pool of Tears', ['> - ## The Pool of Tears']]
  ])('finds a heading: %s', (_kind, heading, expected) => {
    expect(headingsText(`${prose}\n\n${heading}\n\n${prose}`)).toEqual(expected);
  });

  it('finds none in paragraphs, list items or block quotes of prose', () => {
    expect(headingsText(`${prose}\n\n> ${prose}\n\n- ${prose}\n\nThe Pool # of Tears`)).toEqual([]);
  });

  it('finds none in plain text, and keeps the protected regions findProtectedRegions finds', () => {
    const text = `# The Pool of Tears\n\n${prose} \`code\``;
    expect(headingsText(text, 'plaintext')).toEqual([]);
    expect(readDocumentRegions(text, 'markdown').protected).toEqual(findProtectedRegions(text, 'markdown'));
  });

  it('finds none inside fenced code', () => {
    expect(headingsText(`\`\`\`\n# Not a heading\n\`\`\`\n\n${prose}`)).toEqual([]);
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
