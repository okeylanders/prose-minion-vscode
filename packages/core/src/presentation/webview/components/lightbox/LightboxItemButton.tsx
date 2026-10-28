/**
 * LightboxItemButton — one hoverable, pinnable board item (ADR 2026-10-19 D4).
 *
 * Every item that lights paragraphs renders through this button, so hover,
 * keyboard focus and pinning behave the same everywhere: hover or focus
 * lights the paragraphs, a click pins (or unpins) the item, and the pinned
 * state is exposed as `aria-pressed`.
 */
import * as React from 'react';
import type { LightboxItemBinding } from '@hooks/domain/lightbox/controllers/useLightboxFocus';

export interface LightboxItemButtonProps {
  binding: LightboxItemBinding;
  className: string;
  /** Accessible name when the visible content is not enough (ribbon columns). */
  label?: string;
  title?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export function lightboxItemClassName(base: string, binding: LightboxItemBinding): string {
  return `${base}${binding.isSelected ? ' is-sel' : ''}${binding.isHot ? ' is-hot' : ''}`;
}

// eslint-disable-next-line @typescript-eslint/naming-convention -- React components are PascalCase.
export const LightboxItemButton: React.FC<LightboxItemButtonProps> = ({
  binding,
  className,
  label,
  title,
  style,
  children
}) => (
  <button
    type="button"
    className={lightboxItemClassName(className, binding)}
    aria-pressed={binding.isSelected}
    aria-label={label}
    title={title}
    style={style}
    {...binding.handlers}
  >
    {children}
  </button>
);
