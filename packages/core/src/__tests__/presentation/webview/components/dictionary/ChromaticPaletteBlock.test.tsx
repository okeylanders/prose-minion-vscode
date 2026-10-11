/**
 * @jest-environment jsdom
 */

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import { CHROMATIC_PALETTE_FENCE_LANGUAGE } from '@shared/constants/chromaticPalettes';
import {
  ChromaticPaletteBlock,
  DICTIONARY_FENCED_BLOCKS
} from '@components/dictionary/ChromaticPaletteBlock';
import { ChromaticPalette } from '@utils/chromaticPalette';

const AGED_COPPER: ChromaticPalette = {
  title: 'Aged Copper & Patina',
  kind: 'literal',
  note: 'Oxidation and weathering; roofs, statues, and old pipes after decades of rain.',
  swatches: [
    { name: 'Russet', hex: '#80461B', definition: 'a reddish brown, named for a coarse homespun cloth' },
    { name: 'Verdigris', hex: '#43B3AE', definition: 'the blue-green crust that forms on weathered copper' },
    { name: 'Ecru', hex: '#C2B280' }
  ]
};

const rowTextLines = (row: Element): string[] =>
  Array.from(row.querySelectorAll('.pm-palette-swatch-text > *')).map(line => line.textContent ?? '');

describe('ChromaticPaletteBlock', () => {
  it('renders a figure named by its title, with the kind badge', () => {
    render(<ChromaticPaletteBlock palette={AGED_COPPER} />);

    expect(screen.getByRole('figure', { name: 'Aged Copper & Patina' })).toBeTruthy();
    expect(document.querySelector('.pm-palette-kind')?.textContent).toBe('Literal');
  });

  it('labels an evocative palette and omits the badge when kind is absent', () => {
    const { rerender } = render(<ChromaticPaletteBlock palette={{ ...AGED_COPPER, kind: 'evocative' }} />);
    expect(document.querySelector('.pm-palette-kind')?.textContent).toBe('Evocative');

    rerender(<ChromaticPaletteBlock palette={{ title: 'Palette', swatches: AGED_COPPER.swatches }} />);
    expect(document.querySelector('.pm-palette-kind')).toBeNull();
  });

  it('renders each row as name, then definition, then hex, all as visible text', () => {
    render(<ChromaticPaletteBlock palette={AGED_COPPER} />);
    const rows = screen.getAllByRole('listitem');

    expect(rows).toHaveLength(3);
    expect(rowTextLines(rows[0])).toEqual(['Russet', 'a reddish brown, named for a coarse homespun cloth', '#80461B']);
    expect(rowTextLines(rows[1])).toEqual(['Verdigris', 'the blue-green crust that forms on weathered copper', '#43B3AE']);
  });

  it('renders no definition element for a swatch without a definition', () => {
    render(<ChromaticPaletteBlock palette={AGED_COPPER} />);
    const ecruRow = screen.getAllByRole('listitem')[2];

    expect(rowTextLines(ecruRow)).toEqual(['Ecru', '#C2B280']);
    expect(ecruRow.querySelector('.pm-palette-swatch-definition')).toBeNull();
  });

  it('gives every chip an accessible name, rgb tooltip, and only a background color', () => {
    render(<ChromaticPaletteBlock palette={AGED_COPPER} />);
    const chips = screen.getAllByRole('img');

    expect(chips.map(chip => chip.getAttribute('aria-label'))).toEqual([
      'Russet, #80461B, rgb(128, 70, 27)',
      'Verdigris, #43B3AE, rgb(67, 179, 174)',
      'Ecru, #C2B280, rgb(194, 178, 128)'
    ]);
    expect(chips.map(chip => chip.getAttribute('title'))).toEqual([
      'rgb(128, 70, 27)',
      'rgb(67, 179, 174)',
      'rgb(194, 178, 128)'
    ]);
    for (const chip of chips) {
      expect(chip.textContent).toBe('');
      expect(Array.from(chip.style)).toEqual(['background-color']);
    }
    expect(chips[0].style.backgroundColor).toBe('rgb(128, 70, 27)');
  });

  it('renders an aria-hidden strip with one segment per swatch, in order', () => {
    render(<ChromaticPaletteBlock palette={AGED_COPPER} />);
    const strip = document.querySelector('.pm-palette-strip');
    const segments = Array.from(strip?.children ?? []) as HTMLElement[];

    expect(strip?.getAttribute('aria-hidden')).toBe('true');
    expect(segments.map(segment => segment.style.backgroundColor)).toEqual([
      'rgb(128, 70, 27)',
      'rgb(67, 179, 174)',
      'rgb(194, 178, 128)'
    ]);
  });

  it('puts the note in a figcaption, and omits the figcaption without one', () => {
    const { rerender } = render(<ChromaticPaletteBlock palette={AGED_COPPER} />);
    expect(document.querySelector('figcaption')?.textContent).toBe(AGED_COPPER.note);

    rerender(<ChromaticPaletteBlock palette={{ title: 'Palette', swatches: AGED_COPPER.swatches }} />);
    expect(document.querySelector('figcaption')).toBeNull();
  });

  it('renders model-authored text as escaped text, never as markup', () => {
    render(
      <ChromaticPaletteBlock palette={{
        title: '<img src=x onerror="window.__pwned = true">',
        note: '<script>window.__pwned = true</script>',
        swatches: [{ name: '<b>Bold</b>', hex: '#B87333', definition: '<a href="javascript:alert(1)">x</a>' }]
      }} />
    );

    expect(document.querySelector('img, script, b, a')).toBeNull();
    expect(screen.getByText('<b>Bold</b>')).toBeTruthy();
  });
});

describe('DICTIONARY_FENCED_BLOCKS', () => {
  const paletteRenderer = DICTIONARY_FENCED_BLOCKS[CHROMATIC_PALETTE_FENCE_LANGUAGE];

  it('registers only the palette fence language', () => {
    expect(Object.keys(DICTIONARY_FENCED_BLOCKS)).toEqual([CHROMATIC_PALETTE_FENCE_LANGUAGE]);
    expect(Object.isFrozen(DICTIONARY_FENCED_BLOCKS)).toBe(true);
  });

  it('renders a palette block for a fence with a valid swatch', () => {
    const element = paletteRenderer?.render('title: Warm Copper\nCopper | #B87333 | bare metal');
    expect(element).not.toBeNull();

    render(<>{element}</>);
    expect(screen.getByRole('figure', { name: 'Warm Copper' })).toBeTruthy();
  });

  it('returns null for a fence with no valid swatch, so the code block fallback applies', () => {
    expect(paletteRenderer?.render('title: Nothing\n#B87333 | #B87333')).toBeNull();
  });
});
