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

  it('refuses nothing in plain text, which has no structure', () => {
    const text = 'Alice wrote < Rabbit > in her notebook.';
    expect(refused(text, [edit(text, '< Rabbit >', '<Rabbit>')], 'plaintext')).toEqual([]);
  });
});
