/**
 * Icon — Lucide-style line icons ported from the Pass-2 design handoff
 * (`.temp/Prose Minion-handoff.zip` → `icons.js`). Stroke uses `currentColor`
 * so icons inherit the surrounding text color; a few glyphs carry inline
 * `fill="currentColor"` accents (bot eyes, bolt, target, palette dots).
 *
 * Inner SVG markup is held as static, hand-authored constants (no user input),
 * rendered via dangerouslySetInnerHTML to preserve exact path fidelity from the
 * design without transcribing dozens of glyphs into JSX.
 */
import * as React from 'react';

export type IconName =
  | 'gear' | 'chevDown' | 'chevRight' | 'bot' | 'search' | 'bars' | 'book'
  | 'clipboard' | 'save' | 'copy' | 'send' | 'sparkle' | 'plus' | 'check'
  | 'x' | 'bolt' | 'grid' | 'refresh' | 'pin' | 'doc' | 'panelRight' | 'cards'
  | 'dialogue' | 'pen' | 'hand' | 'repeat' | 'branch' | 'scale' | 'move'
  | 'stamp' | 'palette' | 'link' | 'sprout' | 'eye' | 'target' | 'list' | 'wave'
  | 'stop' | 'person';

const PATHS: Record<IconName, string> = {
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  chevDown: '<polyline points="6 9 12 15 18 9"/>',
  chevRight: '<polyline points="9 18 15 12 9 6"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M12 4h-1.5M12 4h1.5"/><circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"/><path d="M2 13v2M22 13v2"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  bars: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="5"/><line x1="18" y1="20" x2="18" y2="9"/>',
  book: '<path d="M2 5a2 2 0 0 1 2-2h6v17H4a2 2 0 0 0-2 2z"/><path d="M22 5a2 2 0 0 0-2-2h-6v17h6a2 2 0 0 1 2 2z"/>',
  clipboard: '<rect x="8" y="4" width="8" height="4" rx="1"/><path d="M9 4H7a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-2"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" stroke="none"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  pin: '<path d="M12 17v5M9 3h6l-1 7 3 3H7l3-3z"/>',
  doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  panelRight: '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="15" y1="4" x2="15" y2="20"/>',
  cards: '<rect x="3" y="5" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v12"/>',
  dialogue: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z"/>',
  pen: '<path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>',
  hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14M7 22l-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  branch: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5a6 6 0 0 1-6 6H8.5"/>',
  scale: '<path d="M12 3v18M5 21h14"/><path d="m3 9 4-4 4 4M3 9l1.8 4a2.2 2.2 0 0 0 4.4 0L11 9M21 9l-4-4-4 4M21 9l-1.8 4a2.2 2.2 0 0 1-4.4 0L13 9"/>',
  move: '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/>',
  stamp: '<path d="M5 22h14M6 18h12v-2a2 2 0 0 0-2-2h-1l.6-3.6A3 3 0 0 0 12.7 5h-1.4a3 3 0 0 0-2.9 2.4L9 11H8a2 2 0 0 0-2 2z"/>',
  palette: '<circle cx="13.5" cy="6.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r="1.3" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6 2 11c0 4.4 3.6 8 8 8 1.1 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3c3.1 0 5.7-2.5 5.7-5.7C21 5.5 17 2 12 2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
  sprout: '<path d="M7 20h10M12 20v-9"/><path d="M12 11c0-3-2-5-5-5-1 0-2 .3-2 .3S5 9 5 11c2.8 0 5-1.3 7 0zM12 11c0-2.5 2-4.5 4.5-4.5 1 0 1.8.3 1.8.3S18 9 18 11c-2.4 0-4.4-1-6 0z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
  list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.5" y2="6"/><line x1="3" y1="12" x2="3.5" y2="12"/><line x1="3" y1="18" x2="3.5" y2="18"/>',
  wave: '<path d="M2 12h2l2-6 3 14 3-18 3 14 2-4h5"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>'
};

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
    dangerouslySetInnerHTML={{ __html: PATHS[name] ?? '' }}
  />
);
