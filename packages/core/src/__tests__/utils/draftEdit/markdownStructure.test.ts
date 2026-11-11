/**
 * A fix may change a paragraph's text, never what the paragraph is (PR #172
 * F-03). Text is synthetic, around *Alice*.
 */
import { MAX_VERIFIED_BLOCK_LENGTH, editsChangingStructure, type StructureEdit } from '@/utils/draftEdit/markdownStructure';

function edit(text: string, quote: string, replacement: string, from = 0): StructureEdit {
  const start = text.indexOf(quote, from);
  if (start < 0) {
    throw new Error(`no ${quote}`);
  }
  return { start, end: start + quote.length, replacement };
}

const refused = (text: string, edits: StructureEdit[], languageId = 'markdown') => [...editsChangingStructure(text, languageId, edits)].sort();

describe('editsChangingStructure', () => {
  it.each([
    ['turns prose into a tag', 'Alice wrote < Rabbit > in her notebook.', '< Rabbit >', '<Rabbit>'],
    ['turns prose into a link', 'Go to htps://example.invalid now.', 'htps', 'https'],
    ['turns a word into a heading', '#Title\n\nAlice ran.', '#Title', '# Title'],
    ['turns a line into a list item', '1.Alice ran.\n', '1.Alice', '1. Alice'],
    ['removes a hard line break', 'Alice ran.  \nShe stopped.', 'ran.  ', 'ran.'],
    ['joins backtick runs into a fence opener', '` ``text\nAlice saw the rabbit.', '` ``', '```']
  ])('refuses a fix that %s', (_name, text, quote, replacement) => {
    expect(refused(text, [edit(text, quote, replacement)])).toEqual([0]);
  });

  it('refuses a fix that makes a reference link the document defines elsewhere', () => {
    const text = 'See [Alcie] go.\n\n[alice]: https://example.invalid\n';
    expect(refused(text, [edit(text, 'Alcie', 'Alice')])).toEqual([0]);
  });

  it('control: the same bracketed word stays prose with no definition', () => {
    const text = 'See [Alcie] go.\n';
    expect(refused(text, [edit(text, 'Alcie', 'Alice')])).toEqual([]);
  });

  it('keeps ordinary fixes, beside markup they leave alone', () => {
    const text = '# A Mad Tea-Party\n\nAlice was *vrey* tired, and [the Rabbit](rabbit.md) ran.\n\n- teh Hatter\n';
    expect(refused(text, [edit(text, 'vrey', 'very'), edit(text, 'teh', 'the')])).toEqual([]);
  });

  it('refuses the edit that makes structure together with another, and keeps the rest of the block', () => {
    // Either space removed alone leaves "*a *" or "* a*", neither emphasis; both together make "*a*".
    const text = 'Then * a * here, and teh end.';
    const edits = [edit(text, '* ', '*'), edit(text, ' *', '*', text.indexOf('a ')), edit(text, 'teh', 'the')];
    expect(refused(text, edits)).toEqual([1]);
  });

  it('refuses the edit that makes a fence, and keeps the spelling fix it would have swallowed', () => {
    const text = '` ``text\nAlice saw teh rabbit.';
    expect(refused(text, [edit(text, '` ``', '```'), edit(text, 'teh', 'the')])).toEqual([0]);
  });

  it('refuses every edit in a block too long to verify', () => {
    const text = `${'Alice ran. '.repeat(Math.ceil(MAX_VERIFIED_BLOCK_LENGTH / 11) + 1)}teh end.`;
    expect(refused(text, [edit(text, 'teh', 'the')])).toEqual([0]);
  });

  describe('inside a table (PR #172 F-03 re-review)', () => {
    it.each([
      ['a body cell', '| Note |\n| --- |\n| Alice wrote < Rabbit > here. |\n'],
      ['a header cell', '| Alice wrote < Rabbit > here. |\n| --- |\n| Note |\n'],
      ['a table in a quote', '> | Note |\n> | --- |\n> | Alice wrote < Rabbit > here. |\n'],
      ['a table in a list item', '- item\n\n  | Note |\n  | --- |\n  | Alice wrote < Rabbit > here. |\n']
    ])('refuses a fix that makes a tag in %s', (_name, text) => {
      expect(refused(text, [edit(text, '< Rabbit >', '<Rabbit>')])).toEqual([0]);
    });

    it('refuses a fix that makes a reference link in a cell', () => {
      const text = '| Note |\n| --- |\n| See [Alcie] go. |\n\n[alice]: https://example.invalid\n';
      expect(refused(text, [edit(text, 'Alcie', 'Alice')])).toEqual([0]);
    });

    it('refuses a fix that changes a column\'s alignment', () => {
      const text = '| Note |\n| --- |\n| Alice ran. |\n';
      expect(refused(text, [edit(text, '---', ':--')])).toEqual([0]);
    });

    it('keeps ordinary fixes in cells, beside markup they leave alone', () => {
      const text = '| *Note* | Who |\n| --- | --- |\n| Alice was vrey tired. | teh Hatter |\n';
      expect(refused(text, [edit(text, 'vrey', 'very'), edit(text, 'teh', 'the')])).toEqual([]);
    });
  });

  describe('where a link or image goes (PR #183 F-01)', () => {
    const DEFINITIONS = '\n\n[teh]: https://example.invalid/first\n[the]: https://example.invalid/second\n';

    it.each([
      ['a shortcut reference', 'Alice reads [teh].'],
      ['a collapsed reference', 'Alice reads [teh][].'],
      ['a full reference\'s label', 'Alice reads [chapter][teh].'],
      ['a reference image', 'Alice sees ![a picture][teh].']
    ])('refuses a fix that sends %s to another definition', (_name, prose) => {
      // Still a link either way: only where it goes moves.
      const text = `${prose}${DEFINITIONS}`;
      expect(refused(text, [edit(text, 'teh', 'the')])).toEqual([0]);
    });

    it('refuses a fix that makes a link\'s title another definition\'s', () => {
      const text = 'Alice reads [teh].\n\n[teh]: https://example.invalid/same "One"\n[the]: https://example.invalid/same "Two"\n';
      expect(refused(text, [edit(text, 'teh', 'the')])).toEqual([0]);
    });

    it('controls: keeps fixes to visible text that leave every target where it was', () => {
      const text = `Alice reads [chpater][teh], ![a pictur][teh], [teh book](chapter.md) and [Teh].${DEFINITIONS}`;
      const edits = [edit(text, 'chpater', 'chapter'), edit(text, 'pictur', 'picture'), edit(text, 'teh book', 'the book'), edit(text, 'Teh', 'teh')];
      expect(refused(text, edits)).toEqual([]);
    });
  });

  it('refuses a fix that ticks a task', () => {
    const text = '- [ ] Alice ran.\n';
    expect(refused(text, [edit(text, '[ ]', '[x]')])).toEqual([0]);
  });

  it('refuses nothing in plain text, which has no structure', () => {
    const text = 'Alice wrote < Rabbit > in her notebook.';
    expect(refused(text, [edit(text, '< Rabbit >', '<Rabbit>')], 'plaintext')).toEqual([]);
  });
});

describe('editsChangingStructure: prose-paragraphs (ADR 2026-11-05 D5, PR #226 F-05)', () => {
  const PROSE = { mode: 'prose-paragraphs' } as const;
  // Astra's witnesses (docs/pr-reviews/probes/pr-226-*): refused under strict, free under prose-paragraphs.
  const WITNESSES: Array<[string, string, StructureEdit]> = [
    ['split paragraph', 'Alice ran. She stopped.', { start: 10, end: 11, replacement: '\n\n' }],
    ['append new paragraph', 'Alice ran.', { start: 10, end: 10, replacement: '\n\nShe stopped.' }],
    ['prepend new paragraph', 'Alice ran.', { start: 0, end: 0, replacement: 'She looked.\n\n' }],
    ['merge paragraphs', 'Alice ran.\n\nShe stopped.', { start: 10, end: 12, replacement: ' ' }]
  ];

  it.each(WITNESSES)('%s: refused under strict, kept under prose-paragraphs', (_name, text, edit) => {
    expect(editsChangingStructure(text, 'markdown', [edit])).toEqual(new Set([0]));
    expect(editsChangingStructure(text, 'markdown', [edit], { mode: 'strict' })).toEqual(new Set([0]));
    expect(editsChangingStructure(text, 'markdown', [edit], PROSE)).toEqual(new Set());
  });

  it('keeps the single-newline control under both', () => {
    const control: StructureEdit = { start: 10, end: 11, replacement: '\n' };
    expect(editsChangingStructure('Alice ran. She stopped.', 'markdown', [control])).toEqual(new Set());
    expect(editsChangingStructure('Alice ran. She stopped.', 'markdown', [control], PROSE)).toEqual(new Set());
  });

  it('lets prose take or lose emphasis and strong, which strict still refuses', () => {
    const text = 'Alice ran.\n\nShe stopped.';
    const italics: StructureEdit = { start: 0, end: 5, replacement: '*Alice*' };
    const appended: StructureEdit = { start: text.length, end: text.length, replacement: '\n\nShe was **very** late.' };
    expect(editsChangingStructure(text, 'markdown', [italics])).toEqual(new Set([0]));
    expect(editsChangingStructure(text, 'markdown', [italics, appended], PROSE)).toEqual(new Set());
    const list = '- Alice ran.\n';
    expect(editsChangingStructure(list, 'markdown', [{ start: 2, end: 7, replacement: '_Alice_' }], PROSE)).toEqual(new Set());
  });

  it('lets a plain paragraph appear or go at a structural boundary (PR #229 F-02)', () => {
    const insert = (text: string, at: number, replacement: string): StructureEdit => ({ start: at, end: at, replacement });
    expect(editsChangingStructure('', 'markdown', [insert('', 0, 'Alice entered.')], PROSE)).toEqual(new Set());
    expect(editsChangingStructure('# One\n', 'markdown', [insert('# One\n', 5, '\n\nAlice entered.')], PROSE)).toEqual(new Set());
    expect(editsChangingStructure('# One\n', 'markdown', [insert('# One\n', 0, 'Alice entered.\n\n')], PROSE)).toEqual(new Set());
    expect(editsChangingStructure('Alice.\n\n---\n', 'markdown', [insert('Alice.\n\n---\n', 11, '\n\nAlice entered.')], PROSE)).toEqual(new Set());
    expect(editsChangingStructure('Alice entered.', 'markdown', [{ start: 0, end: 14, replacement: '' }], PROSE)).toEqual(new Set());
    // Strict still reads each of these as a change.
    expect(editsChangingStructure('# One\n', 'markdown', [insert('# One\n', 5, '\n\nAlice entered.')])).toEqual(new Set([0]));
  });

  it('lets a plain paragraph go', () => {
    const text = 'Alice ran.\n\nShe stopped.\n\nThe Rabbit waited.';
    expect(editsChangingStructure(text, 'markdown', [{ start: 10, end: 24, replacement: '' }], PROSE)).toEqual(new Set());
  });

  it('still refuses every other block and the inline constructs strict reads', () => {
    const text = 'Alice sat by her sister.\n\nThe White Rabbit ran by.\n';
    const at = (find: string, replacement: string): StructureEdit => {
      const start = text.indexOf(find);
      return { start, end: start + find.length, replacement };
    };
    for (const edit of [
      at('The White', '# The White'),
      at('sat by', 'sat\n\n- by'),
      at('sat by', 'sat\n\n> by'),
      at('sat by', 'sat\n\n---\n\nby'),
      at('sat by', 'sat [by](https://example.com)'),
      at('sat by', 'sat `by`'),
      at('sat by', 'sat <b>by</b>'),
      { start: text.length - 1, end: text.length - 1, replacement: '\n\n```\ncode\n```' }
    ]) {
      expect(editsChangingStructure(text, 'markdown', [edit], PROSE)).toEqual(new Set([0]));
    }
  });
});
