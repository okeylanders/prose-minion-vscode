/**
 * The Lightbox tile map is exhaustive (ADR 2026-10-19 D3): every tile kind has
 * exactly one renderer and one register, and the board places every counted
 * and reading kind. The type-level checks fail to compile if a kind is added without a
 * renderer, or a renderer for a kind that does not exist.
 */

import type { LightboxMeasuredTileKind, LightboxTileKind } from '@messages';
import { LIGHTBOX_TILE_REGISTER } from '@shared/constants/lightbox';
import {
  LIGHTBOX_MEASURED_LAYOUT,
  LIGHTBOX_READING_LAYOUT,
  LIGHTBOX_TILE_RENDERERS,
  LightboxTileRenderer
} from '@components/lightbox/LightboxTiles';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
const assertType = <T extends true>(): T => true as T;

describe('the Lightbox tile map', () => {
  it('is keyed by exactly the tile kinds, at the type level', () => {
    assertType<Equal<keyof typeof LIGHTBOX_TILE_RENDERERS, LightboxTileKind>>();
    assertType<Equal<keyof typeof LIGHTBOX_TILE_REGISTER, LightboxTileKind>>();
    // A map missing a kind is a compile error, not a runtime guess.
    // @ts-expect-error -- 'parts-of-speech' has no renderer here.
    const partial: Record<LightboxTileKind, LightboxTileRenderer> = {
      stats: LIGHTBOX_TILE_RENDERERS.stats,
      // eslint-disable-next-line @typescript-eslint/naming-convention -- tile kinds are kebab-case protocol literals.
      'top-words': LIGHTBOX_TILE_RENDERERS['top-words']
    };
    expect(partial).toBeDefined();
  });

  it('gives every kind a renderer and a register at run time', () => {
    const kinds = Object.keys(LIGHTBOX_TILE_RENDERERS).sort();
    expect(Object.keys(LIGHTBOX_TILE_REGISTER).sort()).toEqual(kinds);
    expect(kinds.every((kind) => typeof LIGHTBOX_TILE_RENDERERS[kind as LightboxTileKind] === 'function')).toBe(true);
  });

  it('draws every counted tile in the measured register, each placed once', () => {
    const placed: LightboxMeasuredTileKind[] = [...LIGHTBOX_MEASURED_LAYOUT.rows, ...LIGHTBOX_MEASURED_LAYOUT.grid];
    const measuredKinds = (Object.keys(LIGHTBOX_TILE_RENDERERS) as LightboxTileKind[])
      .filter((kind) => LIGHTBOX_TILE_REGISTER[kind] === 'measured');
    expect([...placed].sort()).toEqual(measuredKinds.sort());
    expect(placed.map((kind) => LIGHTBOX_TILE_REGISTER[kind])).toEqual(placed.map(() => 'measured'));
  });

  it('places every reading kind once, and never in the measured register', () => {
    const placed = [
      LIGHTBOX_READING_LAYOUT.heading,
      LIGHTBOX_READING_LAYOUT.underRibbon,
      LIGHTBOX_READING_LAYOUT.lane,
      LIGHTBOX_READING_LAYOUT.last,
      ...LIGHTBOX_READING_LAYOUT.grid,
      ...Object.keys(LIGHTBOX_READING_LAYOUT.within)
    ];
    const readingKinds = (Object.keys(LIGHTBOX_TILE_RENDERERS) as LightboxTileKind[])
      .filter((kind) => LIGHTBOX_TILE_REGISTER[kind] !== 'measured');
    expect([...placed].sort()).toEqual(readingKinds.sort());
    // A nested kind sits inside a kind the grid draws.
    expect(Object.values(LIGHTBOX_READING_LAYOUT.within).every((host) => host !== undefined && LIGHTBOX_READING_LAYOUT.grid.includes(host))).toBe(true);
  });
});
