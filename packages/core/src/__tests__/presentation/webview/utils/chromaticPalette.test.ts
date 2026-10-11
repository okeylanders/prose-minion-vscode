import { CHROMATIC_PALETTE_LIMITS } from '@shared/constants/chromaticPalettes';
import { hexToRgbString, parseChromaticPalette } from '@utils/chromaticPalette';

const WARM_COPPER = [
  'title: Warm Copper',
  'kind: literal',
  'note: Polished, metallic warmth (new pennies, sunlit pans, a lamp-lit forge).',
  'Copper | #B87333 | the reddish-orange of the bare metal, freshly polished',
  'Bronze | #CD7F32 | the warmer, yellower brown of copper alloyed with tin',
  'Sienna | #A0522D | a reddish-brown earth pigment named for Siena, Italy'
].join('\n');

describe('parseChromaticPalette', () => {
  describe('valid fences', () => {
    it('parses headers and named, defined swatches in source order', () => {
      expect(parseChromaticPalette(WARM_COPPER)).toEqual({
        title: 'Warm Copper',
        kind: 'literal',
        note: 'Polished, metallic warmth (new pennies, sunlit pans, a lamp-lit forge).',
        swatches: [
          { name: 'Copper', hex: '#B87333', definition: 'the reddish-orange of the bare metal, freshly polished' },
          { name: 'Bronze', hex: '#CD7F32', definition: 'the warmer, yellower brown of copper alloyed with tin' },
          { name: 'Sienna', hex: '#A0522D', definition: 'a reddish-brown earth pigment named for Siena, Italy' }
        ]
      });
    });

    it('normalizes swatch values to uppercase', () => {
      const palette = parseChromaticPalette('Verdigris | #43b3ae | blue-green crust');
      expect(palette?.swatches[0].hex).toBe('#43B3AE');
    });
  });

  describe('headers', () => {
    it('falls back to "Palette" and omits kind and note when no headers are given', () => {
      const palette = parseChromaticPalette('Copper | #B87333 | bare metal');
      expect(palette).toEqual({
        title: 'Palette',
        swatches: [{ name: 'Copper', hex: '#B87333', definition: 'bare metal' }]
      });
      expect(palette).not.toHaveProperty('kind');
      expect(palette).not.toHaveProperty('note');
    });

    it('falls back to "Palette" for an empty title', () => {
      expect(parseChromaticPalette('title:   \nCopper | #B87333')?.title).toBe('Palette');
    });

    it('matches header keys case-insensitively', () => {
      const palette = parseChromaticPalette('TITLE: Dusk\nKind: Evocative\nNote: Late light.\nAsh | #6E6E6E');
      expect(palette).toMatchObject({ title: 'Dusk', kind: 'evocative', note: 'Late light.' });
    });

    it('drops a kind other than literal or evocative', () => {
      expect(parseChromaticPalette('kind: moody\nAsh | #6E6E6E')).not.toHaveProperty('kind');
      expect(parseChromaticPalette('kind: constructor\nAsh | #6E6E6E')).not.toHaveProperty('kind');
    });

    it('matches headers only before the first swatch line', () => {
      const palette = parseChromaticPalette([
        'title: Before',
        'Copper | #B87333 | bare metal',
        'title: After',
        'note: Too late'
      ].join('\n'));
      expect(palette?.title).toBe('Before');
      expect(palette).not.toHaveProperty('note');
      expect(palette?.swatches).toHaveLength(1);
    });
  });

  describe('field splitting', () => {
    it('keeps every `|` after the second as part of the definition', () => {
      const palette = parseChromaticPalette('Oxblood | #4A0000 | dark red | the color of dried blood | ox');
      expect(palette?.swatches[0]).toEqual({
        name: 'Oxblood',
        hex: '#4A0000',
        definition: 'dark red | the color of dried blood | ox'
      });
    });

    it('keeps a valid named swatch without a definition, with no definition field', () => {
      const palette = parseChromaticPalette('Copper | #B87333\nBronze | #CD7F32 |   ');
      expect(palette?.swatches).toEqual([
        { name: 'Copper', hex: '#B87333' },
        { name: 'Bronze', hex: '#CD7F32' }
      ]);
      expect(palette?.swatches[0]).not.toHaveProperty('definition');
      expect(palette?.swatches[1]).not.toHaveProperty('definition');
    });

    it('trims names, values, and definitions', () => {
      const palette = parseChromaticPalette('   Deep Patina   |   #577E73   |   folds of an old copper roof   ');
      expect(palette?.swatches[0]).toEqual({
        name: 'Deep Patina',
        hex: '#577E73',
        definition: 'folds of an old copper roof'
      });
    });
  });

  describe('length caps', () => {
    it(`caps names at ${CHROMATIC_PALETTE_LIMITS.maxNameLength} characters`, () => {
      const longName = 'N'.repeat(CHROMATIC_PALETTE_LIMITS.maxNameLength + 25);
      const palette = parseChromaticPalette(`${longName} | #B87333 | def`);
      expect(palette?.swatches[0].name).toBe('N'.repeat(CHROMATIC_PALETTE_LIMITS.maxNameLength));
    });

    it(`caps definitions at ${CHROMATIC_PALETTE_LIMITS.maxDefinitionLength} characters`, () => {
      const longDefinition = 'd'.repeat(CHROMATIC_PALETTE_LIMITS.maxDefinitionLength + 50);
      const palette = parseChromaticPalette(`Copper | #B87333 | ${longDefinition}`);
      expect(palette?.swatches[0].definition).toBe('d'.repeat(CHROMATIC_PALETTE_LIMITS.maxDefinitionLength));
    });

    it('caps by character, never splitting an emoji surrogate pair', () => {
      const name = `${'a'.repeat(CHROMATIC_PALETTE_LIMITS.maxNameLength - 1)}🎨🎨`;
      const capped = parseChromaticPalette(`${name} | #B87333`)?.swatches[0].name ?? '';
      expect(Array.from(capped)).toHaveLength(CHROMATIC_PALETTE_LIMITS.maxNameLength);
      expect(capped.endsWith('🎨')).toBe(true);
    });
  });

  describe('value validation', () => {
    it.each([
      ['3-digit hex', '#B73'],
      ['8-digit hex with alpha', '#B87333FF'],
      ['rgb()', 'rgb(184, 115, 51)'],
      ['CSS color keyword', 'peru'],
      ['missing #', 'B87333'],
      ['non-hex digits', '#G87333'],
      ['a trailing semicolon', '#B87333;'],
      ['a CSS injection', '#B87333; background:url(x)'],
      ['url()', 'url(https://attacker.example/beacon)'],
      ['an empty value', '']
    ])('rejects %s', (_label, value) => {
      expect(parseChromaticPalette(`Copper | ${value} | the bare metal`)).toBeNull();
    });

    it('skips only the invalid line and keeps valid siblings', () => {
      const palette = parseChromaticPalette([
        'Copper | #B87333; background:url(x) | injected',
        'Bronze | #CD7F32 | alloyed with tin'
      ].join('\n'));
      expect(palette?.swatches).toEqual([{ name: 'Bronze', hex: '#CD7F32', definition: 'alloyed with tin' }]);
    });
  });

  describe('names', () => {
    it.each([
      ['an empty name', ' | #B87333 | definition'],
      ['a name that is only a hex code', '#B87333 | #B87333'],
      ['a name that is only a short hex code', '#B73 | #B87333 | definition'],
      ['a name that is only an rgb() code', 'rgb(184, 115, 51) | #B87333 | definition']
    ])('skips a swatch with %s', (_label, line) => {
      expect(parseChromaticPalette(line)).toBeNull();
    });

    it('keeps a real name that merely starts with a hex-like word', () => {
      expect(parseChromaticPalette('#1 Brown Study | #5C4033')?.swatches[0].name).toBe('#1 Brown Study');
    });
  });

  describe('robustness', () => {
    it(`stops at ${CHROMATIC_PALETTE_LIMITS.maxSwatchesPerPalette} swatches`, () => {
      const lines = Array.from({ length: 12 }, (_, index) =>
        `Shade ${index + 1} | #${(index + 1).toString(16).padStart(6, '0')} | shade ${index + 1}`
      );
      const palette = parseChromaticPalette(lines.join('\n'));
      expect(palette?.swatches).toHaveLength(CHROMATIC_PALETTE_LIMITS.maxSwatchesPerPalette);
      expect(palette?.swatches.map(swatch => swatch.name)).toEqual(
        lines.slice(0, CHROMATIC_PALETTE_LIMITS.maxSwatchesPerPalette).map((_, index) => `Shade ${index + 1}`)
      );
    });

    it('counts only valid swatches toward the cap', () => {
      const invalid = Array.from({ length: 10 }, () => 'Bad | #XYZ');
      const palette = parseChromaticPalette([...invalid, 'Copper | #B87333'].join('\n'));
      expect(palette?.swatches).toEqual([{ name: 'Copper', hex: '#B87333' }]);
    });

    it('returns null when no swatch is valid', () => {
      expect(parseChromaticPalette('title: Empty\nkind: literal\nnote: Nothing here.')).toBeNull();
      expect(parseChromaticPalette('')).toBeNull();
      expect(parseChromaticPalette('Just prose, no swatches at all.')).toBeNull();
    });

    it('tolerates CRLF line endings, blank lines, stray prose, and trailing whitespace', () => {
      const palette = parseChromaticPalette(
        'title: Warm Copper  \r\n\r\nkind: literal\t\r\nHere are the colors:\r\n\r\nCopper | #B87333 | bare metal   \r\n\r\n'
      );
      expect(palette).toEqual({
        title: 'Warm Copper',
        kind: 'literal',
        swatches: [{ name: 'Copper', hex: '#B87333', definition: 'bare metal' }]
      });
    });

    it.each([
      ['a half-arrived value', 'title: Warm Copper\nCopper | #B8'],
      ['a value with no separator yet', 'title: Warm Copper\nCopper |'],
      ['a lone name', 'title: Warm Copper\nCopp'],
      ['a half-arrived header', 'tit'],
      ['only a pipe', '|'],
      ['pipes only', '||||']
    ])('returns null without throwing on truncated input: %s', (_label, source) => {
      expect(() => parseChromaticPalette(source)).not.toThrow();
      expect(parseChromaticPalette(source)).toBeNull();
    });

    it('keeps a half-arrived definition as partial text', () => {
      expect(parseChromaticPalette('Copper | #B87333 | the reddi')?.swatches).toEqual([
        { name: 'Copper', hex: '#B87333', definition: 'the reddi' }
      ]);
    });

    it('renders complete swatches and skips the incomplete last line mid-stream', () => {
      const palette = parseChromaticPalette('title: Warm Copper\nCopper | #B87333 | bare metal\nBronze | #CD7');
      expect(palette?.swatches).toEqual([{ name: 'Copper', hex: '#B87333', definition: 'bare metal' }]);
    });

    it('returns null rather than throwing for a non-string at runtime', () => {
      expect(parseChromaticPalette(undefined as unknown as string)).toBeNull();
      expect(parseChromaticPalette(null as unknown as string)).toBeNull();
    });
  });
});

describe('hexToRgbString', () => {
  it('derives rgb(r, g, b) from a validated hex', () => {
    expect(hexToRgbString('#B87333')).toBe('rgb(184, 115, 51)');
    expect(hexToRgbString('#000000')).toBe('rgb(0, 0, 0)');
    expect(hexToRgbString('#ffffff')).toBe('rgb(255, 255, 255)');
  });

  it('refuses anything but #RRGGBB', () => {
    expect(() => hexToRgbString('#B73')).toThrow(RangeError);
    expect(() => hexToRgbString('#B87333; background:url(x)')).toThrow(RangeError);
  });
});
