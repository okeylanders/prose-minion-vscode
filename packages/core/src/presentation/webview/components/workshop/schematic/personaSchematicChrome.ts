/**
 * Presentation-only chrome for the persona schematic — accent colors and panel
 * labels. These are DESIGN concerns, deliberately kept out of the authored
 * persona JSON (which carries only expression content). See
 * `@/shared/personas/personaSchematic` and
 * docs/design/Prose Minion - Persona Schematic.html.
 */

import type { WorkshopPersonaId } from '@messages';

/** Panel titles, indexed 1..9 to match the schematic's numbered sections. */
export const SCHEMATIC_CATEGORIES = [
  null,
  'Identity',
  'Trait tensions',
  'Turn-taking signature',
  'Personal aperture',
  'Verbal palette',
  'Lexical gravity',
  'Communication gradients',
  'Trait pressure',
  'Signature floor'
] as const;

/** The hub node → panel wiring (which category circles surround the core). */
export const SCHEMATIC_HUB_NODES: ReadonlyArray<{ section: number; x: number; y: number }> = [
  { section: 2, x: 170, y: 75 },
  { section: 7, x: 95, y: 215 },
  { section: 8, x: 170, y: 355 },
  { section: 3, x: 790, y: 75 },
  { section: 5, x: 865, y: 215 },
  { section: 6, x: 790, y: 355 },
  { section: 4, x: 480, y: 48 },
  { section: 9, x: 480, y: 392 }
];

/** Warm blueprint accent (base + highlight) per persona. `soft`/`line` are derived. */
export const PERSONA_SCHEMATIC_ACCENTS: Record<WorkshopPersonaId, { a: string; hi: string }> = {
  jill: { a: '#e0673a', hi: '#ee7d49' },
  agnes: { a: '#d9a94e', hi: '#ecc370' },
  cliff: { a: '#c97b5a', hi: '#dd9877' },
  dev: { a: '#d98a6a', hi: '#eaa587' },
  edna: { a: '#d85f45', hi: '#ea7d64' },
  felix: { a: '#e0a94a', hi: '#f0c46e' },
  harper: { a: '#cb9a5e', hi: '#e0b67e' },
  margot: { a: '#e8b45a', hi: '#f4cd83' },
  penny: { a: '#d9cba9', hi: '#ecdfc2' },
  quinn: { a: '#d2a659', hi: '#e6c17e' },
  theo: { a: '#e8873a', hi: '#f4a259' },
  wren: { a: '#d8a583', hi: '#ecc2a6' }
};

/** #rrggbb → rgba(r,g,b,alpha). Accent hexes are static (no user input). */
export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** The four `--pa*` CSS custom properties the schematic surface expects. */
export function schematicAccentVars(id: WorkshopPersonaId): React.CSSProperties {
  const accent = PERSONA_SCHEMATIC_ACCENTS[id] ?? PERSONA_SCHEMATIC_ACCENTS.margot;
  return {
    ['--pa' as string]: accent.a,
    ['--pa-hi' as string]: accent.hi,
    ['--pa-soft' as string]: hexToRgba(accent.a, 0.12),
    ['--pa-line' as string]: hexToRgba(accent.a, 0.32)
  } as React.CSSProperties;
}
