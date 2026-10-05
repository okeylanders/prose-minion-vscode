/**
 * Icon — Lucide-style line icons ported from the Pass-2 design handoff
 * (`.temp/Prose Minion-handoff.zip` → `icons.js`). Stroke uses `currentColor`
 * so icons inherit the surrounding text color; a few glyphs carry inline
 * `fill="currentColor"` accents (bot eyes, bolt, target, palette dots).
 *
 * Inner SVG markup is held as static, hand-authored constants (no user input)
 * in `@shared/constants/iconPaths`, rendered via dangerouslySetInnerHTML to
 * preserve exact path fidelity from the design without transcribing dozens of
 * glyphs into JSX.
 */
import * as React from 'react';
import { ICON_PATHS, IconName } from '@shared/constants/iconPaths';

export type { IconName } from '@shared/constants/iconPaths';

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 18,
  strokeWidth = 2,
  className,
  'aria-hidden': ariaHidden = true
}) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden={ariaHidden}
    dangerouslySetInnerHTML={{ __html: ICON_PATHS[name] ?? '' }}
  />
);
