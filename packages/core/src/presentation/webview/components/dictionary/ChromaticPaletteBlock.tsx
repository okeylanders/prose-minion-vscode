/**
 * ChromaticPaletteBlock — renders one parsed `pm-palette` fence as a color
 * strip (the palette at a glance) above a list of named, defined swatches.
 *
 * Security boundary: the only value that reaches a style is a swatch hex the
 * parser has already matched against `^#[0-9A-Fa-f]{6}$`, written through
 * React's `style` prop (a CSSOM property write, not sanitized HTML). Titles,
 * names, definitions, and notes are React text nodes, so they are escaped.
 * The Markdown sanitizer's configuration is untouched.
 */

import * as React from 'react';
import { CHROMATIC_PALETTE_FENCE_LANGUAGE } from '@shared/constants/chromaticPalettes';
import type { MarkdownFencedBlocks } from '@components/shared/MarkdownRenderer';
import {
  ChromaticPalette,
  ChromaticPaletteKind,
  ChromaticSwatch,
  hexToRgbString,
  parseChromaticPalette
} from '@utils/chromaticPalette';

export interface ChromaticPaletteBlockProps {
  palette: ChromaticPalette;
}

const PALETTE_KIND_LABELS: Readonly<Record<ChromaticPaletteKind, string>> = {
  literal: 'Literal',
  evocative: 'Evocative'
};

export const ChromaticPaletteBlock: React.FC<ChromaticPaletteBlockProps> = ({ palette }) => {
  const titleId = React.useId();

  return (
    <figure className="pm-palette" aria-labelledby={titleId}>
      <div className="pm-palette-header">
        <span id={titleId} className="pm-palette-title">{palette.title}</span>
        {palette.kind && (
          <span className={`pm-palette-kind pm-palette-kind-${palette.kind}`}>
            {PALETTE_KIND_LABELS[palette.kind]}
          </span>
        )}
      </div>

      {/* The list below carries every color in words; the strip only repeats them. */}
      <div className="pm-palette-strip" aria-hidden="true">
        {palette.swatches.map((swatch, index) => (
          <span
            key={index}
            className="pm-palette-strip-segment"
            style={{ backgroundColor: swatch.hex }}
          />
        ))}
      </div>

      <ul className="pm-palette-swatches">
        {palette.swatches.map((swatch, index) => (
          <ChromaticSwatchRow key={index} swatch={swatch} />
        ))}
      </ul>

      {palette.note && <figcaption className="pm-palette-note">{palette.note}</figcaption>}
    </figure>
  );
};

const ChromaticSwatchRow: React.FC<{ swatch: ChromaticSwatch }> = ({ swatch }) => {
  const rgb = hexToRgbString(swatch.hex);

  return (
    <li className="pm-palette-swatch">
      <span
        className="pm-palette-chip"
        role="img"
        aria-label={`${swatch.name}, ${swatch.hex}, ${rgb}`}
        title={rgb}
        style={{ backgroundColor: swatch.hex }}
      />
      <div className="pm-palette-swatch-text">
        <span className="pm-palette-swatch-name">{swatch.name}</span>
        {swatch.definition && (
          <span className="pm-palette-swatch-definition">{swatch.definition}</span>
        )}
        <span className="pm-palette-swatch-hex">{swatch.hex}</span>
      </div>
    </li>
  );
};

/**
 * The Dictionary's fenced-block registry for `MarkdownRenderer` and
 * `StreamingContent`. Module-level so its identity is stable across renders
 * (the renderer memoizes on it). A fence with no valid swatch returns null,
 * which keeps the raw fence readable as an ordinary code block.
 */
export const DICTIONARY_FENCED_BLOCKS: MarkdownFencedBlocks = Object.freeze({
  [CHROMATIC_PALETTE_FENCE_LANGUAGE]: {
    render: (source: string): React.ReactElement | null => {
      const palette = parseChromaticPalette(source);
      return palette ? <ChromaticPaletteBlock palette={palette} /> : null;
    }
  }
});
