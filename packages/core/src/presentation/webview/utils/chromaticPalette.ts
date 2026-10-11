/**
 * Chromatic Palette parser — the pure half of the Dictionary's `pm-palette`
 * fence renderer.
 *
 * Model output is untrusted, and the swatch value is the one field that ever
 * reaches a style. So the value grammar is strict (`#RRGGBB`, nothing else)
 * while the metadata around it is tolerant: unknown headers, stray prose,
 * half-streamed lines, and malformed swatches are skipped rather than fatal.
 * This function never throws, including on truncated mid-stream input.
 *
 * Grammar (feature spec: .todo/features/feature-dictionary-chromatic-palettes):
 *
 *   title: Warm Copper            ← optional headers, before the first swatch
 *   kind: literal | evocative
 *   note: One sentence on the palette.
 *   Copper | #B87333 | the reddish-orange of the bare metal
 *   ^name    ^value    ^definition (optional; may itself contain `|`)
 */

import { CHROMATIC_PALETTE_LIMITS } from '@shared/constants/chromaticPalettes';

export type ChromaticPaletteKind = 'literal' | 'evocative';

export interface ChromaticSwatch {
  /** Writer-facing color name: never empty and never a bare color code. */
  name: string;
  /** Validated `#RRGGBB`, uppercase. The only parsed value that reaches a style. */
  hex: string;
  /** Short definition of the name; absent when the model omitted it. */
  definition?: string;
}

export interface ChromaticPalette {
  /** Header `title`, or `'Palette'` when absent. */
  title: string;
  /** Absent when the header is missing or is neither `literal` nor `evocative`. */
  kind?: ChromaticPaletteKind;
  note?: string;
  /** One to `maxSwatchesPerPalette` swatches, in source order. */
  swatches: ChromaticSwatch[];
}

const DEFAULT_PALETTE_TITLE = 'Palette';

/** The single anchored form a swatch value may take. */
const SWATCH_HEX_PATTERN = /^#[0-9A-Fa-f]{6}$/;

/** Headers are a closed set, matched case-insensitively. */
const HEADER_LINE_PATTERN = /^(title|kind|note)\s*:(.*)$/i;

/**
 * A name that is only a color code carries no vocabulary, so the swatch is
 * dropped: `#B87333 | #B87333` must never render as an "unnamed" color.
 */
const COLOR_CODE_NAME_PATTERN = /^(?:#[0-9A-Fa-f]*|(?:rgb|rgba|hsl|hsla)\s*\(.*)$/i;

const LINE_BREAK_PATTERN = /\r\n|\r|\n/;

export function parseChromaticPalette(source: string): ChromaticPalette | null {
  if (typeof source !== 'string') {
    return null;
  }

  let title = DEFAULT_PALETTE_TITLE;
  let kind: ChromaticPaletteKind | undefined;
  let note: string | undefined;
  let seenSwatchLine = false;
  const swatches: ChromaticSwatch[] = [];

  for (const rawLine of source.split(LINE_BREAK_PATTERN)) {
    if (swatches.length >= CHROMATIC_PALETTE_LIMITS.maxSwatchesPerPalette) {
      break;
    }

    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const header = seenSwatchLine ? null : HEADER_LINE_PATTERN.exec(line);
    if (header) {
      const value = header[2].trim();
      switch (header[1].toLowerCase()) {
        case 'title':
          title = value || DEFAULT_PALETTE_TITLE;
          break;
        case 'kind':
          kind = toPaletteKind(value);
          break;
        case 'note':
          note = value || undefined;
          break;
      }
      continue;
    }

    if (!line.includes('|')) {
      continue;
    }

    seenSwatchLine = true;
    const swatch = parseSwatchLine(line);
    if (swatch) {
      swatches.push(swatch);
    }
  }

  if (swatches.length === 0) {
    return null;
  }

  return {
    title,
    ...(kind ? { kind } : {}),
    ...(note ? { note } : {}),
    swatches
  };
}

function toPaletteKind(value: string): ChromaticPaletteKind | undefined {
  const normalized = value.toLowerCase();
  return normalized === 'literal' || normalized === 'evocative' ? normalized : undefined;
}

function parseSwatchLine(line: string): ChromaticSwatch | null {
  const [rawName, rawValue, ...definitionParts] = line.split('|');
  const name = rawName.trim();
  const value = (rawValue ?? '').trim();

  if (name.length === 0 || COLOR_CODE_NAME_PATTERN.test(name)) {
    return null;
  }
  if (!SWATCH_HEX_PATTERN.test(value)) {
    return null;
  }

  const definition = capLength(
    definitionParts.join('|').trim(),
    CHROMATIC_PALETTE_LIMITS.maxDefinitionLength
  );

  return {
    name: capLength(name, CHROMATIC_PALETTE_LIMITS.maxNameLength),
    hex: value.toUpperCase(),
    ...(definition ? { definition } : {})
  };
}

/**
 * Caps by code point rather than UTF-16 unit, so a cut never leaves half of
 * an emoji's surrogate pair behind.
 */
function capLength(text: string, maxLength: number): string {
  const codePoints = Array.from(text);
  if (codePoints.length <= maxLength) {
    return text;
  }
  return codePoints.slice(0, maxLength).join('').trimEnd();
}

/**
 * Derives the `rgb(r, g, b)` display string for a validated swatch value.
 * Throws on anything but `#RRGGBB`: callers only ever hold parser output, so
 * an invalid value here is a programming error, not model noise.
 */
export function hexToRgbString(hex: string): string {
  if (!SWATCH_HEX_PATTERN.test(hex)) {
    throw new RangeError(`Expected a #RRGGBB color, received "${hex}".`);
  }
  const channel = (offset: number): number => parseInt(hex.slice(offset, offset + 2), 16);
  return `rgb(${channel(1)}, ${channel(3)}, ${channel(5)})`;
}
