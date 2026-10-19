/**
 * LightboxTileFrame — the box every board tile is drawn in (ADR 2026-10-19 D3).
 *
 * The frame's register (solid measured, dashed read, neutral counted-read)
 * comes from `LIGHTBOX_TILE_REGISTER` by kind, or is passed explicitly for a
 * reading placeholder; a tile cannot choose a register of its own.
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

export type LightboxTileFrameProps = {
  title: string;
  /** Grid span on the six-column board (3 or 6). */
  span: 3 | 6;
  /** A hint beside the badge, e.g. "sized by count". */
  footnote?: React.ReactNode;
  children: React.ReactNode;
} & ({ kind: LightboxTileKind; register?: never } | { kind?: never; register: LightboxRegister });

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxTileFrame: React.FC<LightboxTileFrameProps> = ({
  title,
  span,
  footnote,
  children,
  ...registerSource
}) => {
  const register = registerSource.kind !== undefined
    ? LIGHTBOX_TILE_REGISTER[registerSource.kind]
    : registerSource.register;
  return (
    <section
      className={`pm-lb-tile pm-lb-span${span} pm-lb-reg-${register}`}
      aria-label={title}
      data-register={register}
    >
      <div className="pm-lb-tile-head">
        <p className="pm-lb-tile-eyebrow">{title}</p>
        <span className="pm-lb-badge">{LIGHTBOX_REGISTER_BADGES[register]}</span>
      </div>
      {children}
      {footnote && <p className="pm-lb-foot">{footnote}</p>}
    </section>
  );
};
