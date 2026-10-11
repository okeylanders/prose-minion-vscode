import {
  closeUnterminatedFence,
  closesFence,
  findUnterminatedFence,
  parseFenceOpener,
  startsMarkdownSection
} from '@/utils/markdownFences';

describe('markdownFences', () => {
  it.each([
    ['```', { char: '`', length: 3 }],
    ['````pm-palette', { char: '`', length: 4 }],
    ['   ~~~ info', { char: '~', length: 3 }],
    ['~~~~~', { char: '~', length: 5 }]
  ] as const)('reads the opener %j', (line, delimiter) => {
    expect(parseFenceOpener(line)).toEqual(delimiter);
  });

  it.each(['``', '    ```', '``` has `backtick` info', 'text ```', '# heading'])('does not treat %j as an opener', (line) => {
    expect(parseFenceOpener(line)).toBeUndefined();
  });

  it('closes only with the same character, at least as long, and no info string', () => {
    const opener = { char: '`', length: 4 } as const;
    expect(closesFence('````', opener)).toBe(true);
    expect(closesFence('`````  ', opener)).toBe(true);
    expect(closesFence('```', opener)).toBe(false);
    expect(closesFence('~~~~', opener)).toBe(false);
    expect(closesFence('```` js', opener)).toBe(false);
  });

  it.each([
    ['no fence', '# Heading\nText', undefined],
    ['a closed fence', '```pm-palette\nCopper | #B87333\n```', undefined],
    ['an unclosed fence', '# 🎨\n\n```pm-palette\nCopper | #B87333', { char: '`', length: 3 }],
    ['a shorter closer inside a longer fence', '````\n```\nstill inside', { char: '`', length: 4 }],
    ['the other character inside a fence', '~~~\n```\nstill inside', { char: '~', length: 3 }],
    ['a second fence left open', '```\na\n```\n\n~~~~\nb', { char: '~', length: 4 }],
    ['CRLF line endings', '```\r\na\r\n```\r\n', undefined]
  ] as const)('finds the open fence in %s', (_label, markdown, expected) => {
    expect(findUnterminatedFence(markdown)).toEqual(expected);
  });

  it('appends a matching closer only when a fence is left open', () => {
    expect(closeUnterminatedFence('````pm-palette\nCopper | #B87333')).toBe('````pm-palette\nCopper | #B87333\n````');
    expect(closeUnterminatedFence('~~~\nx')).toBe('~~~\nx\n~~~');
    const closed = '```\nx\n```';
    expect(closeUnterminatedFence(closed)).toBe(closed);
    expect(findUnterminatedFence(closeUnterminatedFence('```\nx') + '\n\n# Next')).toBeUndefined();
  });

  it.each([
    ['# 📂 Topic & Related Lexicon', true],
    ['   ### Phonetics', true],
    ['#', true],
    ['```pm-palette', true],
    ['~~~', true],
    ['#1 Brown Study | #5A3D2B | a dim study', false],
    ['#B87333', false],
    ['Copper | #B87333 | polished', false],
    ['Bronz', false]
  ] as const)('startsMarkdownSection(%j) is %s', (line, expected) => {
    expect(startsMarkdownSection(line)).toBe(expected);
  });
});
