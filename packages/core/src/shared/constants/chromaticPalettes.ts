/**
 * Chromatic Palettes wire contract.
 *
 * The dictionary prompts teach models to emit one fenced block per palette
 * using this language tag; the Dictionary webview renders those fences as
 * named swatches, and host diagnostics count them. Keep the tag here so the
 * prompt-facing grammar, the renderer, and the logs cannot drift apart.
 *
 * Grammar (see .todo/features/feature-dictionary-chromatic-palettes/README.md):
 *   title: / kind: / note: header lines, then `Color Name | #RRGGBB | short definition`.
 */
export const CHROMATIC_PALETTE_FENCE_LANGUAGE = 'pm-palette';

/** Renderer safety bounds; the prompt targets well below them. */
export const CHROMATIC_PALETTE_LIMITS = {
  maxSwatchesPerPalette: 8,
  maxNameLength: 40,
  maxDefinitionLength: 160
} as const;
