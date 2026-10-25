/**
 * LightboxTileFrame — the box every board tile is drawn in (ADR 2026-10-19 D3).
 *
 * The frame's register (solid measured, dashed read, neutral counted-read)
 * comes from `LIGHTBOX_TILE_REGISTER` by kind, or is passed explicitly for a
 * reading placeholder; a tile cannot choose a register of its own.
 *
 * A reading's frame may carry its call's control (Slice 4I, epic decision
 * 43): the Analyze button then marks the tile as an AI reading in place of
 * the bare "read" badge, and a counted-read tile keeps a "counted" chip
 * beside it, since its count is free and always there. A measured tile has
 * no control and keeps its badge.
 */
import * as React from 'react';
import type { LightboxRegister, LightboxTileKind } from '@messages';
import { LIGHTBOX_TILE_REGISTER } from '@shared/constants/lightbox';

export const LIGHTBOX_REGISTER_BADGES: Readonly<Record<LightboxRegister, string>> = {
  measured: 'measured',
  read: 'read',
  // eslint-disable-next-line @typescript-eslint/naming-convention -- register ids are kebab-case protocol literals.
  'counted-read': 'counted · read'
};

/** What a counted-read tile's chip says beside its Analyze: the counted half of its register (Slice 4I). */
export const LIGHTBOX_COUNTED_CHIP = 'counted';

export type LightboxTileFrameProps = {
  title: string;
  /** Grid span on the six-column board (3 or 6). */
  span: 3 | 6;
  /** A hint beside the badge, e.g. "sized by count". */
  footnote?: React.ReactNode;
  /** A chip before the register badge, for a tile with a place of its own (the Opinion's "The one evaluative tile"). */
  chip?: React.ReactNode;
  /** A class of the tile's own, for its frame's colors (`is-opinion`). */
  className?: string;
  /** A reading's call control (its Analyze), drawn in place of the read badge (Slice 4I). */
  action?: React.ReactNode;
  /** The id of what describes the tile beyond its name: an earlier reading's note (Slice 4J). */
  describedBy?: string;
  children: React.ReactNode;
} & ({ kind: LightboxTileKind; register?: never } | { kind?: never; register: LightboxRegister });

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTileFrame: React.FC<LightboxTileFrameProps> = ({
  title,
  span,
  footnote,
  chip,
  className,
  action,
  describedBy,
  children,
  ...registerSource
}) => {
  const register = registerSource.kind !== undefined
    ? LIGHTBOX_TILE_REGISTER[registerSource.kind]
    : registerSource.register;
  // With its Analyze, a reading names only what is counted; the button says the rest.
  const badge = !action
    ? <span className="pm-lb-badge">{LIGHTBOX_REGISTER_BADGES[register]}</span>
    : register === 'read'
      ? null
      : <span className="pm-lb-badge">{register === 'counted-read' ? LIGHTBOX_COUNTED_CHIP : LIGHTBOX_REGISTER_BADGES[register]}</span>;
  return (
    <section
      className={`pm-lb-tile pm-lb-span${span} pm-lb-reg-${register}${className ? ` ${className}` : ''}`}
      aria-label={title}
      aria-describedby={describedBy}
      data-register={register}
    >
      <div className="pm-lb-tile-head">
        <p className="pm-lb-tile-eyebrow">{title}</p>
        {chip || action ? (
          <span className="pm-lb-tile-badges">
            {chip}
            {badge}
            {action}
          </span>
        ) : (
          badge
        )}
      </div>
      {children}
      {footnote && <p className="pm-lb-foot">{footnote}</p>}
    </section>
  );
};
