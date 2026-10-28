/**
 * Familiar phrasing: one vocabulary for every surface that names it (ADR
 * 2026-10-21, Amendment 2026-10-26: Slice 3c). The Lightbox's stock and
 * signature lens describes familiar phrases, and familiar is not a fault
 * there. Craft Flags' cliché category flags two of the kinds, and never the
 * other two. Neither defines a kind of its own: both read these, and a sync
 * test holds their prompts to them.
 */

export const FAMILIAR_PHRASE_KINDS = ['idiom', 'cliche', 'stock', 'weighted'] as const;

export type FamiliarPhraseKind = typeof FAMILIAR_PHRASE_KINDS[number];

/** What each kind is, in the words every prompt that defines it uses. */
export const FAMILIAR_PHRASE_DEFINITIONS: Readonly<Record<FamiliarPhraseKind, string>> = {
  idiom: 'an everyday idiom, familiar and carrying no image',
  cliche: 'a phrase worn smooth by use, standing in for something the scene could name exactly',
  stock: 'a stock phrase that orients a reader without drawing notice',
  weighted: 'stock carrying weight, a familiar beat asked to hold a peak, a turn or a coda'
};
